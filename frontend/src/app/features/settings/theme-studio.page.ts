import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { AuthService } from '../../core/auth.service';
import { TenantTheme, ThemeService } from '../../core/theme.service';

@Component({
  selector: 'app-theme-studio-page',
  imports: [FormsModule, MatButtonModule, MatIconModule, MatSlideToggleModule],
  templateUrl: './theme-studio.page.html',
  styleUrl: './theme-studio.page.scss',
})
export class ThemeStudioPage {
  readonly themes = inject(ThemeService);
  readonly auth = inject(AuthService);
  readonly saved = signal(false);
  readonly tenantName = signal(localStorage.getItem('peopleflow.tenantName') ?? 'PeopleFlow Demo');
  readonly logoText = signal(localStorage.getItem('peopleflow.logoText') ?? 'PF');
  readonly customPrimary = signal(this.themes.current().primary);
  readonly customAccent = signal(this.themes.current().accent);
  readonly customRadius = signal(this.themes.current().radius);
  readonly compact = signal(this.themes.current().density === 'compact');
  readonly dark = signal(this.themes.current().scheme === 'dark');
  readonly currentName = computed(() => this.themes.current().name);
  select(theme: TenantTheme): void {
    this.themes.select(theme);
    this.customPrimary.set(theme.primary);
    this.customAccent.set(theme.accent);
    this.customRadius.set(theme.radius);
    this.compact.set(theme.density === 'compact');
    this.dark.set(theme.scheme === 'dark');
    this.flashSaved();
  }
  applyCustom(): void {
    this.themes.customize({
      primary: this.customPrimary(),
      primaryRgb: this.hexToRgb(this.customPrimary()),
      accent: this.customAccent(),
      radius: this.customRadius(),
      density: this.compact() ? 'compact' : 'comfortable',
      scheme: this.dark() ? 'dark' : 'light',
      surface: this.dark() ? '#08111f' : '#f5f7fb',
      sidebar: this.dark() ? '#030712' : '#071426',
    });
    localStorage.setItem('peopleflow.tenantName', this.tenantName());
    localStorage.setItem('peopleflow.logoText', this.logoText());
    this.flashSaved();
  }
  private flashSaved(): void {
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 1800);
  }
  private hexToRgb(hex: string): string {
    const clean = hex.replace('#', '');
    const value = parseInt(
      clean.length === 3
        ? clean
            .split('')
            .map((x) => x + x)
            .join('')
        : clean,
      16,
    );
    return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
  }
}
