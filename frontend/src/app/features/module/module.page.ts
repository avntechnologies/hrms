import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import {
  ReactiveFormsModule,
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute } from '@angular/router';
import { Subject, finalize, forkJoin, of, takeUntil } from 'rxjs';
import { ApiService } from '../../core/api.service';
import {
  ColumnDefinition,
  FormFieldDefinition,
  ModuleDefinition,
  PagedResult,
  RowActionDefinition,
  WorkspaceViewDefinition,
} from '../../core/models';
import { MODULES } from './module.registry';

type DataRow = Record<string, unknown>;
type SelectOption = { label: string; value: string | number | boolean };

@Component({
  selector: 'app-module-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './module.page.html',
  styleUrl: './module.page.scss',
})
export class ModulePage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(UntypedFormBuilder);
  private readonly destroy$ = new Subject<void>();

  readonly definition = signal<ModuleDefinition>(MODULES['organization']);
  readonly activeTab = signal(0);
  readonly view = computed(
    () => this.definition().views[this.activeTab()] ?? this.definition().views[0],
  );
  readonly rows = signal<DataRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = 25;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly drawerOpen = signal(false);
  readonly detailOpen = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly search = signal('');
  readonly currentAction = signal<RowActionDefinition | null>(null);
  readonly actionRow = signal<DataRow | null>(null);
  readonly detailRows = signal<DataRow[]>([]);
  readonly detailColumns = signal<ColumnDefinition[]>([]);
  readonly detailTitle = signal('Details');
  readonly lookups = signal<Record<string, SelectOption[]>>({});
  readonly lookupLabels = signal<Record<string, string>>({});
  form: UntypedFormGroup = this.fb.group({});
  filterForm: UntypedFormGroup = this.fb.group({});

  ngOnInit(): void {
    this.route.data.pipe(takeUntil(this.destroy$)).subscribe((data) => {
      this.definition.set(MODULES[data['module'] as string] ?? MODULES['organization']);
      this.selectTab(0);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectTab(index: number): void {
    this.activeTab.set(index);
    this.search.set('');
    this.page.set(1);
    this.error.set('');
    this.success.set('');
    this.buildFilterForm();
    this.loadLookups();
    this.load(1);
  }

  load(page = 1): void {
    this.loading.set(true);
    this.error.set('');
    this.page.set(page);
    const view = this.view();
    const params: Record<string, string | number | boolean | undefined> = {
      ...this.filterForm.getRawValue(),
    };
    const requiredPathKeys = [...view.endpoint.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
    if (requiredPathKeys.some((key) => !params[key])) {
      this.rows.set([]);
      this.total.set(0);
      this.loading.set(false);
      return;
    }
    if (view.listShape === 'paged') {
      params['page'] = page;
      params['pageSize'] = this.pageSize;
      if (this.search()) params['search'] = this.search();
    }
    const endpoint = this.interpolatePath(view.endpoint, null, params);
    this.api.get<unknown>(endpoint, params).subscribe({
      next: (response) => {
        if (view.listShape === 'paged') {
          const result = response as PagedResult<DataRow>;
          this.rows.set(result.items ?? []);
          this.total.set(result.total ?? 0);
        } else {
          const all = Array.isArray(response) ? (response as DataRow[]) : [];
          const query = this.search().trim().toLowerCase();
          const filtered = query
            ? all.filter((row) => JSON.stringify(row).toLowerCase().includes(query))
            : all;
          this.rows.set(filtered);
          this.total.set(filtered.length);
        }
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.errorMessage(error, 'Unable to load this workspace.'));
      },
    });
  }

  applyFilters(): void {
    this.load(1);
  }

  clearFilters(): void {
    this.filterForm.reset();
    this.search.set('');
    this.load(1);
  }

  openCreate(): void {
    const view = this.view();
    if (!view.createEndpoint) return;
    this.openForm(
      {
        label: view.createLabel ?? 'Create record',
        icon: 'add',
        method: 'post',
        path: view.createEndpoint,
        fields: view.fields,
      },
      null,
    );
  }

  openToolbarAction(action: RowActionDefinition): void {
    this.runAction(action, null);
  }

  runRowAction(action: RowActionDefinition, row: DataRow): void {
    this.runAction(action, row);
  }

  actionVisible(action: RowActionDefinition, row: DataRow): boolean {
    if (!action.visibleStatuses?.length) return true;
    return action.visibleStatuses.includes(String(row['status'] ?? ''));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const action = this.currentAction();
    if (!action) return;
    const payload = this.normalizePayload(action.fields ?? [], this.form.getRawValue());
    this.execute(action, this.actionRow(), payload);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.currentAction.set(null);
    this.actionRow.set(null);
    this.error.set('');
  }

  closeDetails(): void {
    this.detailOpen.set(false);
    this.detailRows.set([]);
  }

  exportCsv(): void {
    const columns = this.view().columns;
    const quote = (value: unknown) => `"${this.display(value).replaceAll('"', '""')}"`;
    const lines = [
      columns.map((column) => quote(column.label)).join(','),
      ...this.rows().map((row) =>
        columns.map((column) => quote(this.value(row, column.key))).join(','),
      ),
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${this.definition().key}-${this.view().label.toLowerCase().replaceAll(' ', '-')}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  optionsFor(
    field: FormFieldDefinition | { key: string; options?: SelectOption[] },
  ): SelectOption[] {
    return this.lookups()[field.key] ?? field.options ?? [];
  }

  value(row: DataRow, key: string): unknown {
    return key
      .split('.')
      .reduce<unknown>(
        (current, part) =>
          current && typeof current === 'object' ? (current as DataRow)[part] : null,
        row,
      );
  }

  dateValue(row: DataRow, key: string): string | number | Date | null {
    const value = this.value(row, key);
    return typeof value === 'string' || typeof value === 'number' || value instanceof Date
      ? value
      : null;
  }

  display(value: unknown, key?: string): string {
    if (value === null || value === undefined || value === '') return '—';
    if (key && typeof value === 'string' && this.lookupLabels()[value])
      return this.lookupLabels()[value];
    if (Array.isArray(value))
      return value.length
        ? value.map((item) => this.lookupLabels()[String(item)] ?? String(item)).join(', ')
        : 'None';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  statusClass(value: unknown): string {
    const text = String(value).toLowerCase();
    if (
      [
        'active',
        'approved',
        'paid',
        'completed',
        'open',
        'available',
        'verified',
        'present',
        'true',
        'yes',
      ].some((item) => text.includes(item))
    )
      return 'success';
    if (
      [
        'pending',
        'draft',
        'processing',
        'maintenance',
        'probation',
        'submitted',
        'inprogress',
      ].some((item) => text.includes(item))
    )
      return 'warning';
    if (
      ['rejected', 'cancelled', 'terminated', 'lost', 'false', 'no', 'expired'].some((item) =>
        text.includes(item),
      )
    )
      return 'danger';
    return '';
  }

  actionResultHint(): string {
    const row = this.detailRows()[0];
    return row && Object.keys(row).length === 1 ? String(Object.values(row)[0]) : '';
  }

  private runAction(action: RowActionDefinition, row: DataRow | null): void {
    this.error.set('');
    this.success.set('');
    if (action.method === 'get') {
      this.execute(action, row, {});
      return;
    }
    if (action.fields?.length) {
      this.openForm(action, row);
      return;
    }
    if (action.confirm && !window.confirm(action.confirm)) return;
    this.execute(action, row, {});
  }

  private openForm(action: RowActionDefinition, row: DataRow | null): void {
    this.currentAction.set(action);
    this.actionRow.set(row);
    this.buildForm(action.fields ?? [], row);
    this.loadFieldLookups(action.fields ?? []);
    this.drawerOpen.set(true);
  }

  private execute(action: RowActionDefinition, row: DataRow | null, payload: DataRow): void {
    this.saving.set(true);
    this.error.set('');
    const path = this.interpolatePath(action.path, row, payload);
    const request =
      action.method === 'get'
        ? this.api.get<unknown>(path)
        : action.method === 'post'
          ? this.api.post<unknown>(path, payload)
          : action.method === 'put'
            ? this.api.put<unknown>(path, payload)
            : this.api.delete<unknown>(path);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (response) => {
        if (action.method === 'get') {
          const resultRows = Array.isArray(response)
            ? (response as DataRow[])
            : [this.asRow(response)];
          this.detailRows.set(resultRows);
          this.detailColumns.set(action.detailColumns ?? this.inferColumns(resultRows[0]));
          this.detailTitle.set(action.detailTitle ?? action.label);
          this.detailOpen.set(true);
          return;
        }
        const result = this.asRow(response);
        const reference =
          result['id'] ?? (typeof result['result'] === 'string' ? result['result'] : null);
        this.success.set(
          `${action.label} completed successfully.${reference ? ` Reference: ${reference}` : ''}`,
        );
        this.closeDrawer();
        this.load(this.page());
      },
      error: (error: HttpErrorResponse) =>
        this.error.set(this.errorMessage(error, `Unable to complete “${action.label}”.`)),
    });
  }

  private interpolatePath(path: string, row: DataRow | null, payload: DataRow): string {
    return path.replace(/\{([^}]+)\}/g, (_, key: string) =>
      encodeURIComponent(String(payload[key] ?? row?.[key] ?? '')),
    );
  }

  private buildForm(fields: FormFieldDefinition[], row: DataRow | null): void {
    const controls: Record<string, unknown> = {};
    for (const field of fields) {
      const source = field.sourceKey ?? field.key;
      const rowValue = row?.[source];
      const initial =
        rowValue ??
        field.defaultValue ??
        (field.type === 'checkbox' ? false : field.type === 'multiselect' ? [] : '');
      const validators = field.required ? [Validators.required] : [];
      if (field.min !== undefined) validators.push(Validators.min(field.min));
      if (field.type === 'email') validators.push(Validators.email);
      if (field.type === 'password') validators.push(Validators.minLength(12));
      controls[field.key] = [initial, validators];
    }
    this.form = this.fb.group(controls);
  }

  private buildFilterForm(): void {
    const controls: Record<string, unknown> = {};
    for (const filter of this.view().filters ?? []) controls[filter.key] = [''];
    this.filterForm = this.fb.group(controls);
  }

  private loadLookups(): void {
    const view = this.view();
    const fields = [
      ...(view.fields ?? []),
      ...(view.filters ?? []),
      ...(view.toolbarActions ?? []).flatMap((action) => action.fields ?? []),
      ...(view.rowActions ?? []).flatMap((action) => action.fields ?? []),
    ];
    this.loadFieldLookups(fields);
  }

  private loadFieldLookups(
    fields: Array<
      | FormFieldDefinition
      | {
          key: string;
          optionsEndpoint?: string;
          optionsShape?: 'array' | 'paged';
          optionLabel?: string;
          optionValue?: string;
          options?: SelectOption[];
        }
    >,
  ): void {
    const remote = fields.filter((field) => field.optionsEndpoint);
    const staticLookups = { ...this.lookups() };
    fields.forEach((field) => {
      if (field.options) staticLookups[field.key] = field.options;
    });
    this.lookups.set(staticLookups);
    if (!remote.length) return;
    const unique = [
      ...new Map(remote.map((field) => [`${field.key}:${field.optionsEndpoint}`, field])).values(),
    ];
    forkJoin(unique.map((field) => this.api.get<unknown>(field.optionsEndpoint!).pipe())).subscribe(
      {
        next: (responses) => {
          const next = { ...this.lookups() };
          const labels = { ...this.lookupLabels() };
          unique.forEach((field, index) => {
            const response = responses[index];
            const rows =
              field.optionsShape === 'paged'
                ? ((response as PagedResult<DataRow>).items ?? [])
                : Array.isArray(response)
                  ? (response as DataRow[])
                  : [];
            const labelKey = field.optionLabel ?? 'name';
            const valueKey = field.optionValue ?? 'id';
            const choices = rows.map((row) => ({
              label: String(row[labelKey] ?? row[valueKey]),
              value: String(row[valueKey]),
            }));
            next[field.key] = choices;
            choices.forEach((choice) => (labels[String(choice.value)] = choice.label));
          });
          this.lookups.set(next);
          this.lookupLabels.set(labels);
        },
        error: () => undefined,
      },
    );
  }

  private normalizePayload(fields: FormFieldDefinition[], raw: DataRow): DataRow {
    const payload: DataRow = { ...raw };
    for (const field of fields) {
      const value = payload[field.key];
      if (field.type === 'number')
        payload[field.key] = value === '' || value === null ? null : Number(value);
      if (field.type === 'checkbox') payload[field.key] = Boolean(value);
      if (field.type === 'datetime-local')
        payload[field.key] = value ? new Date(String(value)).toISOString() : null;
      if (field.type === 'multiselect' && !Array.isArray(value))
        payload[field.key] = value ? [value] : [];
      if (value === '') payload[field.key] = null;
    }
    return payload;
  }

  private inferColumns(row?: DataRow): ColumnDefinition[] {
    if (!row) return [];
    return Object.keys(row)
      .slice(0, 8)
      .map((key) => ({ key, label: key.replace(/([a-z])([A-Z])/g, '$1 $2') }));
  }

  private asRow(value: unknown): DataRow {
    if (value && typeof value === 'object') return value as DataRow;
    return { result: value ?? 'Completed' };
  }

  private errorMessage(error: HttpErrorResponse, fallback: string): string {
    return (
      error.error?.detail ??
      error.error?.title ??
      (typeof error.error === 'string' ? error.error : fallback)
    );
  }
}
