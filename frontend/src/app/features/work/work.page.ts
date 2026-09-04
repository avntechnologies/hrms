import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize, forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import {
  Employee,
  PagedResult,
  WorkComment,
  WorkItem,
  WorkItemDetail,
  WorkLog,
  WorkOverview,
  WorkProject,
  WorkProjectMember,
  WorkTimeReport,
} from '../../core/models';
import { DocumentComponent } from '../../shared/document/document.component';

type WorkTab = 'board' | 'list' | 'report' | 'projects';

@Component({
  selector: 'app-work-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    DocumentComponent,
  ],
  templateUrl: './work.page.html',
})
export class WorkPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);

  readonly tabs: { key: WorkTab; label: string; icon: string }[] = [
    { key: 'board', label: 'Board', icon: 'view_kanban' },
    { key: 'list', label: 'All work', icon: 'format_list_bulleted' },
    { key: 'report', label: 'Time report', icon: 'calendar_view_month' },
    { key: 'projects', label: 'Projects & access', icon: 'admin_panel_settings' },
  ];
  readonly boardStatuses = ['Backlog', 'ToDo', 'InProgress', 'InReview', 'Done'];
  readonly statuses = [...this.boardStatuses, 'Cancelled'];
  readonly priorities = ['Lowest', 'Low', 'Medium', 'High', 'Highest', 'Critical'];
  readonly types = ['Epic', 'Story', 'Task', 'Bug', 'Subtask'];

  readonly activeTab = signal<WorkTab>('board');
  readonly projects = signal<WorkProject[]>([]);
  readonly members = signal<WorkProjectMember[]>([]);
  readonly memberDraft = signal<WorkProjectMember[]>([]);
  readonly employees = signal<Employee[]>([]);
  readonly items = signal<PagedResult<WorkItem>>({
    items: [], page: 1, pageSize: 100, total: 0, totalPages: 0,
  });
  readonly overview = signal<WorkOverview>({
    openItems: 0, dueSoon: 0, overdue: 0, completedThisMonth: 0, loggedMinutesThisMonth: 0,
  });
  readonly detail = signal<WorkItemDetail | null>(null);
  readonly report = signal<WorkTimeReport | null>(null);
  readonly selectedProjectId = signal('');
  readonly search = signal('');
  readonly statusFilter = signal('');
  readonly priorityFilter = signal('');
  readonly loading = signal(true);
  readonly itemsLoading = signal(false);
  readonly reportLoading = signal(false);
  readonly saving = signal(false);
  readonly actionBusy = signal('');
  readonly detailLoading = signal(false);
  readonly drawerOpen = signal(false);
  readonly detailOpen = signal(false);
  readonly projectDrawerOpen = signal(false);
  readonly commentDialogOpen = signal(false);
  readonly worklogDialogOpen = signal(false);
  readonly editing = signal<WorkItem | null>(null);
  readonly error = signal('');
  readonly success = signal('');
  readonly newMemberId = signal('');

  readonly selectedProject = computed(() =>
    this.projects().find((project) => project.id === this.selectedProjectId()),
  );
  readonly canManage = computed(() => this.auth.hasPermission('work.manage'));
  readonly canCreate = computed(() => this.auth.hasPermission('work.create'));
  readonly canAssign = computed(() => this.auth.hasPermission('work.assign'));
  readonly canComment = computed(() => this.auth.hasPermission('work.comment'));
  readonly canLog = computed(() => this.auth.hasPermission('work.log'));
  readonly canAttach = computed(() => this.canManage() || this.canComment());

  @ViewChild('itemDocuments') private itemDocuments?: DocumentComponent;

  readonly itemForm = this.fb.nonNullable.group({
    projectId: ['', Validators.required],
    type: ['Task', Validators.required],
    summary: ['', [Validators.required, Validators.maxLength(240)]],
    description: [''],
    assigneeEmployeeId: [''],
    parentId: [''],
    priority: ['Medium', Validators.required],
    dueDate: [''],
    originalEstimateMinutes: [0, Validators.min(0)],
    remainingEstimateMinutes: [0, Validators.min(0)],
    storyPoints: [0, Validators.min(0)],
    labels: [''],
    version: [0],
  });
  readonly commentForm = this.fb.nonNullable.group({ body: ['', Validators.required] });
  readonly worklogForm = this.fb.nonNullable.group({
    workDate: [new Date().toISOString().slice(0, 10), Validators.required],
    hours: [1, [Validators.required, Validators.min(0.02), Validators.max(24)]],
    description: [''],
    remainingEstimateMinutes: [0, Validators.min(0)],
  });
  readonly reportForm = this.fb.nonNullable.group({
    from: [this.monthStart(), Validators.required],
    to: [new Date().toISOString().slice(0, 10), Validators.required],
    projectId: [''],
    employeeId: [''],
  });
  readonly projectForm = this.fb.nonNullable.group({
    key: ['', [Validators.required, Validators.pattern(/^[A-Za-z][A-Za-z0-9]{1,9}$/)]],
    name: ['', Validators.required],
    description: [''],
    leadEmployeeId: [''],
  });

  ngOnInit(): void {
    this.loadWorkspace();
  }

  setTab(tab: WorkTab): void {
    if (tab === 'projects' && !this.canManage()) return;
    this.activeTab.set(tab);
    if (tab === 'report' && !this.report()) this.loadReport();
  }

  loadWorkspace(): void {
    this.loading.set(true);
    this.error.set('');
    const requests: Record<string, ReturnType<ApiService['get']>> = {
      projects: this.api.get<WorkProject[]>('/work/projects'),
      overview: this.api.get<WorkOverview>('/work/overview'),
    };
    if (this.canManage()) {
      requests['employees'] = this.api.get<PagedResult<Employee>>('/employees', { page: 1, pageSize: 200 });
    }
    forkJoin(requests).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (result) => {
        const projects = result['projects'] as WorkProject[];
        this.projects.set(projects);
        this.overview.set(result['overview'] as WorkOverview);
        if (result['employees']) this.employees.set((result['employees'] as PagedResult<Employee>).items);
        if (!this.selectedProjectId() && projects.length) this.selectedProjectId.set(projects[0].id);
        this.loadMembers();
        this.loadItems();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'Unable to load work management.'),
    });
  }

  loadItems(page = 1): void {
    this.itemsLoading.set(true);
    this.api.get<PagedResult<WorkItem>>('/work/items', {
      page, pageSize: 100, search: this.search(), projectId: this.selectedProjectId(),
      status: this.statusFilter(), priority: this.priorityFilter(),
    }).pipe(finalize(() => this.itemsLoading.set(false))).subscribe({
      next: (items) => this.items.set(items),
      error: (error: HttpErrorResponse) => this.setError(error, 'Unable to load work items.'),
    });
  }

  selectProject(id: string): void {
    this.selectedProjectId.set(id);
    this.reportForm.controls.projectId.setValue(id);
    this.loadMembers();
    this.loadItems();
  }

  loadMembers(): void {
    const projectId = this.selectedProjectId();
    if (!projectId) {
      this.members.set([]);
      this.memberDraft.set([]);
      return;
    }
    this.api.get<WorkProjectMember[]>(`/work/projects/${projectId}/members`).subscribe({
      next: (members) => {
        this.members.set(members);
        this.memberDraft.set(members.map((member) => ({ ...member })));
      },
      error: () => {
        this.members.set([]);
        this.memberDraft.set([]);
      },
    });
  }

  itemsFor(status: string): WorkItem[] {
    return this.items().items.filter((item) => item.status === status);
  }

  openCreate(): void {
    if (!this.selectedProjectId()) {
      this.error.set('Create a project before adding work items.');
      return;
    }
    this.editing.set(null);
    this.itemForm.reset({
      projectId: this.selectedProjectId(), type: 'Task', summary: '', description: '',
      assigneeEmployeeId: '', parentId: '', priority: 'Medium', dueDate: '',
      originalEstimateMinutes: 0, remainingEstimateMinutes: 0, storyPoints: 0, labels: '', version: 0,
    });
    this.drawerOpen.set(true);
  }

  openEdit(): void {
    const detail = this.detail();
    if (!detail) return;
    const item = detail.item;
    this.editing.set(item);
    this.itemForm.reset({
      projectId: item.projectId, type: item.type, summary: item.summary,
      description: detail.description ?? '', assigneeEmployeeId: item.assigneeEmployeeId ?? '',
      parentId: item.parentId ?? '', priority: item.priority, dueDate: item.dueDate ?? '',
      originalEstimateMinutes: item.originalEstimateMinutes ?? 0,
      remainingEstimateMinutes: item.remainingEstimateMinutes ?? 0,
      storyPoints: item.storyPoints ?? 0, labels: item.labels.join(', '), version: item.version,
    });
    this.drawerOpen.set(true);
  }

  submitItem(): void {
    if (this.itemForm.invalid) {
      this.itemForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const raw = this.itemForm.getRawValue();
    const optionalNumber = (value: number) => (value > 0 ? Number(value) : null);
    const payload = {
      projectId: raw.projectId, type: raw.type, summary: raw.summary, description: raw.description || null,
      assigneeEmployeeId: raw.assigneeEmployeeId || null, parentId: raw.parentId || null,
      priority: raw.priority, dueDate: raw.dueDate || null,
      originalEstimateMinutes: optionalNumber(raw.originalEstimateMinutes),
      remainingEstimateMinutes: optionalNumber(raw.remainingEstimateMinutes),
      storyPoints: optionalNumber(raw.storyPoints), labels: raw.labels.split(',').map((x) => x.trim()).filter(Boolean),
      version: raw.version,
    };
    const editing = this.editing();
    const request = editing
      ? this.api.put<WorkItem>(`/work/items/${editing.id}`, payload)
      : this.api.post<WorkItem>('/work/items', payload);
    request.pipe(
      switchMap((item) => {
        const documents = this.itemDocuments;
        if (!documents) return of(item);
        return documents.saveDocuments(item.id).pipe(map(() => item));
      }),
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: (item) => {
        this.drawerOpen.set(false);
        this.success.set(editing ? `${item.key} updated.` : `${item.key} created.`);
        if (editing) {
          this.applyItem(item, raw.description || undefined);
          this.refreshDetail(item.id);
        } else {
          this.loadItems();
        }
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'Unable to save the work item.'),
    });
  }

  openItem(id: string): void {
    if (this.detail()?.item.id !== id) this.detail.set(null);
    this.detailOpen.set(true);
    this.detailLoading.set(true);
    this.api.get<WorkItemDetail>(`/work/items/${id}`).pipe(finalize(() => this.detailLoading.set(false))).subscribe({
      next: (detail) => this.detail.set(detail),
      error: (error: HttpErrorResponse) => this.setError(error, 'Unable to load the work item.'),
    });
  }

  transition(item: WorkItem, status: string): void {
    this.runAction('transition', this.api.put<WorkItem>(`/work/items/${item.id}/transition`, {
      status, resolution: status === 'Done' ? 'Done' : status === 'Cancelled' ? 'Cancelled' : null,
      comment: null, version: item.version,
    }), (updated) => {
      this.applyItem(updated);
      this.success.set(`${updated.key} moved to ${this.statusLabel(status)}.`);
      this.refreshDetail(updated.id);
    }, 'Unable to change status.');
  }

  transitionOptions(status: string): string[] {
    const transitions: Record<string, string[]> = {
      Backlog: ['ToDo', 'Cancelled'], ToDo: ['Backlog', 'InProgress', 'Cancelled'],
      InProgress: ['ToDo', 'InReview', 'Done', 'Cancelled'],
      InReview: ['InProgress', 'Done', 'Cancelled'], Done: ['InProgress'], Cancelled: ['Backlog'],
    };
    return transitions[status] ?? [];
  }

  assign(employeeId: string): void {
    const item = this.detail()?.item;
    if (!item) return;
    this.runAction('assign', this.api.put<WorkItem>(`/work/items/${item.id}/assignee`, {
      assigneeEmployeeId: employeeId || null, version: item.version,
    }), (updated) => {
      this.applyItem(updated);
      this.refreshDetail(updated.id);
    }, 'Unable to assign the work item.');
  }

  openCommentDialog(): void {
    if (!this.canComment()) return;
    this.commentForm.reset({ body: '' });
    this.commentDialogOpen.set(true);
  }

  openWorklogDialog(): void {
    if (!this.canLog()) return;
    this.worklogForm.reset({ workDate: new Date().toISOString().slice(0, 10), hours: 1, description: '', remainingEstimateMinutes: 0 });
    this.worklogDialogOpen.set(true);
  }

  addComment(): void {
    const item = this.detail()?.item;
    if (!item || this.commentForm.invalid) return;
    this.runAction('comment', this.api.post<WorkComment>(`/work/items/${item.id}/comments`, this.commentForm.getRawValue()), (comment) => {
      this.detail.update((data) => data ? { ...data, comments: [...data.comments, comment] } : data);
      this.commentForm.reset({ body: '' });
      this.commentDialogOpen.set(false);
      this.refreshDetail(item.id);
    }, 'Unable to add comment.');
  }

  deleteComment(commentId: string): void {
    const item = this.detail()?.item;
    if (!item || !window.confirm('Delete this comment?')) return;
    this.runAction(`comment-${commentId}`, this.api.delete(`/work/items/${item.id}/comments/${commentId}`), () => {
      this.detail.update((data) => data ? { ...data, comments: data.comments.filter((comment) => comment.id !== commentId) } : data);
    }, 'Unable to delete comment.');
  }

  addWorklog(): void {
    const item = this.detail()?.item;
    if (!item || this.worklogForm.invalid) return;
    const raw = this.worklogForm.getRawValue();
    const minutes = Math.round(raw.hours * 60);
    this.runAction('worklog', this.api.post<WorkLog>(`/work/items/${item.id}/worklogs`, {
      workDate: raw.workDate, minutes, description: raw.description || null,
      remainingEstimateMinutes: raw.remainingEstimateMinutes > 0 ? raw.remainingEstimateMinutes : null,
    }), (worklog) => {
      const current = this.detail();
      if (current) {
        const remaining = raw.remainingEstimateMinutes > 0 ? raw.remainingEstimateMinutes
          : Math.max(0, (current.item.remainingEstimateMinutes ?? 0) - minutes);
        const updated = { ...current.item, loggedMinutes: current.item.loggedMinutes + minutes, remainingEstimateMinutes: remaining };
        this.detail.set({ ...current, item: updated, worklogs: [worklog, ...current.worklogs] });
        this.replaceListItem(updated);
      }
      this.worklogForm.reset({ workDate: new Date().toISOString().slice(0, 10), hours: 1, description: '', remainingEstimateMinutes: 0 });
      this.worklogDialogOpen.set(false);
      this.refreshDetail(item.id);
    }, 'Unable to log time.');
  }

  deleteWorklog(worklogId: string): void {
    const item = this.detail()?.item;
    if (!item || !window.confirm('Delete this worklog?')) return;
    const minutes = this.detail()?.worklogs.find((log) => log.id === worklogId)?.minutes ?? 0;
    this.runAction(`worklog-${worklogId}`, this.api.delete(`/work/items/${item.id}/worklogs/${worklogId}`), () => {
      this.detail.update((data) => data ? {
        ...data,
        item: { ...data.item, loggedMinutes: Math.max(0, data.item.loggedMinutes - minutes) },
        worklogs: data.worklogs.filter((log) => log.id !== worklogId),
      } : data);
      const updated = this.detail()?.item;
      if (updated) this.replaceListItem(updated);
    }, 'Unable to delete worklog.');
  }

  loadReport(): void {
    if (this.reportForm.invalid) return;
    const raw = this.reportForm.getRawValue();
    this.reportLoading.set(true);
    this.api.get<WorkTimeReport>('/work/reports/time', raw)
      .pipe(finalize(() => this.reportLoading.set(false))).subscribe({
        next: (report) => this.report.set(report),
        error: (error: HttpErrorResponse) => this.setError(error, 'Unable to generate the time report.'),
      });
  }

  setReportPreset(preset: 'week' | 'month' | 'year'): void {
    const now = new Date();
    const from = preset === 'week' ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
      : preset === 'year' ? new Date(now.getFullYear(), 0, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
    this.reportForm.patchValue({ from: this.localDate(from), to: this.localDate(now) });
    this.loadReport();
  }

  openProjectCreate(): void {
    this.projectForm.reset({ key: '', name: '', description: '', leadEmployeeId: '' });
    this.projectDrawerOpen.set(true);
  }

  createProject(): void {
    if (this.projectForm.invalid) return;
    this.saving.set(true);
    const raw = this.projectForm.getRawValue();
    this.api.post<WorkProject>('/work/projects', { ...raw, leadEmployeeId: raw.leadEmployeeId || null })
      .pipe(finalize(() => this.saving.set(false))).subscribe({
        next: (project) => {
          this.projectDrawerOpen.set(false);
          this.success.set(`${project.name} created.`);
          this.selectedProjectId.set(project.id);
          this.loadWorkspace();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'Unable to create project.'),
      });
  }

  addMember(): void {
    const employee = this.employees().find((x) => x.id === this.newMemberId());
    if (!employee || this.memberDraft().some((x) => x.employeeId === employee.id)) return;
    this.memberDraft.update((members) => [...members, {
      id: '', employeeId: employee.id, employeeNumber: employee.employeeNumber, employeeName: employee.fullName,
      canCreateItems: true, canAssignItems: false, canTransitionItems: true,
      canLogWork: true, canViewAllWorklogs: false,
    }]);
    this.newMemberId.set('');
  }

  updateMember(employeeId: string, key: keyof WorkProjectMember, value: boolean): void {
    this.memberDraft.update((members) => members.map((member) =>
      member.employeeId === employeeId ? { ...member, [key]: value } : member,
    ));
  }

  removeMember(employeeId: string): void {
    this.memberDraft.update((members) => members.filter((member) => member.employeeId !== employeeId));
  }

  saveMembers(): void {
    const projectId = this.selectedProjectId();
    if (!projectId) return;
    const payload = this.memberDraft().map(({ employeeId, canCreateItems, canAssignItems, canTransitionItems, canLogWork, canViewAllWorklogs }) =>
      ({ employeeId, canCreateItems, canAssignItems, canTransitionItems, canLogWork, canViewAllWorklogs }));
    this.saving.set(true);
    this.api.put<WorkProjectMember[]>(`/work/projects/${projectId}/members`, payload)
      .pipe(finalize(() => this.saving.set(false))).subscribe({
        next: (members) => { this.members.set(members); this.memberDraft.set(members); this.success.set('Project access updated.'); },
        error: (error: HttpErrorResponse) => this.setError(error, 'Unable to update project access.'),
      });
  }

  formatMinutes(minutes?: number): string {
    if (!minutes) return '0m';
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return [hours ? `${hours}h` : '', rest ? `${rest}m` : ''].filter(Boolean).join(' ');
  }

  statusLabel(status: string): string {
    return ({ ToDo: 'To do', InProgress: 'In progress', InReview: 'In review' } as Record<string, string>)[status] ?? status;
  }

  priorityIcon(priority: string): string {
    if (['Highest', 'Critical'].includes(priority)) return 'keyboard_double_arrow_up';
    if (priority === 'High') return 'arrow_upward';
    if (priority === 'Low') return 'arrow_downward';
    if (priority === 'Lowest') return 'keyboard_double_arrow_down';
    return 'drag_handle';
  }

  private runAction<T>(key: string, request: Observable<T>, next: (value: T) => void, fallback: string): void {
    this.actionBusy.set(key);
    request.pipe(finalize(() => this.actionBusy.set(''))).subscribe({
      next,
      error: (error: HttpErrorResponse) => this.setError(error, fallback),
    });
  }

  private applyItem(item: WorkItem, description?: string): void {
    this.replaceListItem(item);
    this.detail.update((data) => data?.item.id === item.id
      ? { ...data, item, ...(description !== undefined ? { description } : {}) }
      : data);
  }

  private replaceListItem(item: WorkItem): void {
    this.items.update((result) => ({
      ...result,
      items: result.items.map((current) => current.id === item.id ? item : current),
    }));
  }

  private refreshDetail(id: string): void {
    if (!this.detailOpen() || this.detail()?.item.id !== id) return;
    this.api.get<WorkItemDetail>(`/work/items/${id}`).subscribe({
      next: (detail) => {
        if (this.detailOpen() && this.detail()?.item.id === id) this.detail.set(detail);
      },
    });
  }

  private setError(error: HttpErrorResponse, fallback: string): void {
    this.error.set(error.error?.detail ?? fallback);
    this.loading.set(false);
    this.itemsLoading.set(false);
    this.reportLoading.set(false);
    this.saving.set(false);
    this.actionBusy.set('');
  }

  private monthStart(): string {
    const now = new Date();
    return this.localDate(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  private localDate(date: Date): string {
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  }
}
