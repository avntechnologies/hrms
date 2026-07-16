import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';

export interface TenantTheme {
  id: string;
  name: string;
  description: string;
  scheme: 'light' | 'dark';
  primary: string;
  primaryRgb: string;
  accent: string;
  surface: string;
  sidebar: string;
  radius: number;
  density: 'comfortable' | 'compact';
}

export const THEME_PRESETS: TenantTheme[] = [
  {
    id: 'azure',
    name: 'Azure',
    description: 'Clear, focused and familiar',
    scheme: 'light',
    primary: '#0067b8',
    primaryRgb: '0 103 184',
    accent: '#2b88d8',
    surface: '#f5f7fb',
    sidebar: '#071426',
    radius: 14,
    density: 'comfortable',
  },
  {
    id: 'azure-dark',
    name: 'Azure Night',
    description: 'Low-glare operations view',
    scheme: 'dark',
    primary: '#60a5fa',
    primaryRgb: '96 165 250',
    accent: '#38bdf8',
    surface: '#08111f',
    sidebar: '#030712',
    radius: 14,
    density: 'comfortable',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    description: 'People-first and optimistic',
    scheme: 'light',
    primary: '#047857',
    primaryRgb: '4 120 87',
    accent: '#10b981',
    surface: '#f4f8f6',
    sidebar: '#06251d',
    radius: 18,
    density: 'comfortable',
  },
  {
    id: 'violet',
    name: 'Violet',
    description: 'Confident talent experience',
    scheme: 'light',
    primary: '#6d28d9',
    primaryRgb: '109 40 217',
    accent: '#8b5cf6',
    surface: '#f8f6fc',
    sidebar: '#1c1038',
    radius: 18,
    density: 'comfortable',
  },
  {
    id: 'graphite',
    name: 'Graphite',
    description: 'Dense executive workspace',
    scheme: 'light',
    primary: '#334155',
    primaryRgb: '51 65 85',
    accent: '#64748b',
    surface: '#f3f4f6',
    sidebar: '#111827',
    radius: 8,
    density: 'compact',
  },
];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly auth = inject(AuthService);
  private readonly selected = signal<TenantTheme>(THEME_PRESETS[0]);
  readonly presets = THEME_PRESETS;
  readonly current = this.selected.asReadonly();
  readonly isDark = computed(() => this.current().scheme === 'dark');

  constructor() {
    effect(() => {
      const tenantId = this.auth.tenantId();
      const saved = localStorage.getItem(`peopleflow.theme.${tenantId}`);
      let theme = THEME_PRESETS[0];
      if (saved) {
        try {
          theme = JSON.parse(saved) as TenantTheme;
        } catch {
          localStorage.removeItem(`peopleflow.theme.${tenantId}`);
        }
      }
      this.selected.set(theme);
      this.apply(theme);
    });
  }

  select(theme: TenantTheme): void {
    const tenantId = this.auth.tenantId();
    localStorage.setItem(`peopleflow.theme.${tenantId}`, JSON.stringify(theme));
    this.selected.set(theme);
    this.apply(theme);
  }

  customize(changes: Partial<TenantTheme>): void {
    this.select({ ...this.current(), id: 'custom', name: 'Custom tenant theme', ...changes });
  }

  private apply(theme: TenantTheme): void {
    const root = this.document.documentElement;
    root.dataset['theme'] = theme.id;
    root.dataset['scheme'] = theme.scheme;
    root.dataset['density'] = theme.density;
    root.style.setProperty('--brand', theme.primary);
    root.style.setProperty('--brand-rgb', theme.primaryRgb);
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--app-bg', theme.surface);
    root.style.setProperty('--sidebar-bg', theme.sidebar);
    root.style.setProperty('--radius', `${theme.radius}px`);
    root.style.setProperty('--mat-sys-primary', theme.primary);
    root.style.setProperty('color-scheme', theme.scheme);
  }
}
