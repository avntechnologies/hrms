import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ThemeService } from '../core/theme.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  badge?: string;
  permission?: string;
  platformOnly?: boolean;
  employeeOnly?: boolean;
}
interface NavSection {
  label: string;
  items: NavItem[];
}

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly themes = inject(ThemeService);
  private readonly breakpoint = inject(BreakpointObserver);
  private readonly router = inject(Router);

  readonly mobile = signal(false);
  readonly collapsed = signal(false);
  readonly initials = computed(() =>
    (this.auth.user()?.displayName ?? 'HR')
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
  );
  readonly tenantLabel = computed(() =>
    this.auth.user()?.roles.includes('PLATFORM_ADMIN') ? 'Platform workspace' : 'Tenant workspace',
  );

  readonly navigation: NavSection[] = [
    {
      label: 'Overview',
      items: [
        {
          label: 'Admin dashboard',
          icon: 'space_dashboard',
          route: '/dashboard',
          permission: 'dashboard.admin',
        },
        { label: 'My workspace', icon: 'home', route: '/my', employeeOnly: true },
        { label: 'My services', icon: 'apps', route: '/my-services', employeeOnly: true },
        { label: 'My team', icon: 'groups', route: '/my-team', permission: 'team.read' },
      ],
    },
    {
      label: 'Platform',
      items: [
        { label: 'Customer companies', icon: 'domain', route: '/companies', platformOnly: true },
      ],
    },
    {
      label: 'People',
      items: [
        { label: 'Employees', icon: 'group', route: '/employees', permission: 'employees.read' },
        {
          label: 'Organization',
          icon: 'account_tree',
          route: '/organization',
          permission: 'employees.read',
        },
        { label: 'Leave', icon: 'beach_access', route: '/leave', permission: 'leave.manage' },
        {
          label: 'Attendance',
          icon: 'schedule',
          route: '/attendance',
          permission: 'attendance.manage',
        },
        {
          label: 'Workforce',
          icon: 'calendar_month',
          route: '/workforce',
          permission: 'workforce.manage',
        },
      ],
    },
    {
      label: 'Compensation',
      items: [
        { label: 'Payroll', icon: 'payments', route: '/payroll', permission: 'payroll.manage' },
        {
          label: 'Expenses',
          icon: 'receipt_long',
          route: '/expenses',
          permission: 'expenses.manage',
        },
      ],
    },
    {
      label: 'Talent',
      items: [
        {
          label: 'Recruitment',
          icon: 'person_search',
          route: '/recruitment',
          permission: 'recruitment.manage',
        },
        {
          label: 'Performance',
          icon: 'monitoring',
          route: '/performance',
          permission: 'performance.manage',
        },
        { label: 'Learning', icon: 'school', route: '/training', permission: 'training.manage' },
      ],
    },
    {
      label: 'Operations',
      items: [
        { label: 'Assets', icon: 'laptop_mac', route: '/assets', permission: 'assets.manage' },
        {
          label: 'Access & roles',
          icon: 'admin_panel_settings',
          route: '/identity',
          permission: 'identity.manage',
        },
        { label: 'Audit log', icon: 'history', route: '/audit', permission: 'audit.read' },
      ],
    },
  ];

  constructor() {
    this.breakpoint
      .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
      .subscribe((state) => this.mobile.set(state.matches));
  }

  toggleNavigation(): void {
    if (!this.mobile()) this.collapsed.update((value) => !value);
  }

  visible(item: NavItem): boolean {
    if (item.platformOnly) return this.auth.isPlatformAdmin();
    if (item.employeeOnly && !this.auth.isEmployee()) return false;
    if (item.permission && !this.auth.hasPermission(item.permission)) return false;
    return true;
  }

  sectionVisible(section: NavSection): boolean {
    return section.items.some((item) => this.visible(item));
  }

  navigateSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    if (value && this.auth.hasPermission('employees.read'))
      void this.router.navigate(['/employees'], { queryParams: { search: value } });
    else if (value) void this.router.navigate(['/my-services']);
  }
}
