import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AttendanceRecord, PagedResult, SelfDashboard } from '../../core/models';

@Component({
  selector: 'app-self-dashboard',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './self-dashboard.page.html',
  styleUrl: './self-dashboard.page.scss',
})
export class SelfDashboardPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);
  readonly loading = signal(true);
  readonly clocking = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly locationStatus = signal('Location is requested only when you clock in or out.');
  readonly dashboard = signal<SelfDashboard | null>(null);
  readonly history = signal<AttendanceRecord[]>([]);
  readonly now = signal(new Date());
  readonly passwordOpen = signal(false);
  readonly passwordSaving = signal(false);
  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required, Validators.minLength(12)]],
    newPassword: ['', [Validators.required, Validators.minLength(12)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(12)]],
  });

  ngOnInit(): void {
    this.load();
    window.setInterval(() => this.now.set(new Date()), 30_000);
  }

  load(): void {
    this.loading.set(true);
    this.api.get<SelfDashboard>('/me/dashboard').subscribe({
      next: (data) => {
        this.dashboard.set(data);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(error.error?.detail ?? 'Unable to load your workspace.');
      },
    });
    this.api
      .get<PagedResult<AttendanceRecord>>('/me/attendance', { page: 1, pageSize: 10 })
      .subscribe({ next: (result) => this.history.set(result.items ?? []) });
  }

  async clock(action: 'clock-in' | 'clock-out'): Promise<void> {
    this.error.set('');
    this.success.set('');
    this.clocking.set(true);
    try {
      const location = await this.getLocation();
      const latitude = Number(location.coords.latitude.toFixed(6));
      const longitude = Number(location.coords.longitude.toFixed(6));
      const accuracyMeters = Number(location.coords.accuracy.toFixed(2));
      this.locationStatus.set(
        `Location captured within approximately ${Math.round(accuracyMeters)} metres.`,
      );
      this.api
        .post<AttendanceRecord>(`/me/attendance/${action}`, {
          latitude,
          longitude,
          accuracyMeters,
          address: `${latitude}, ${longitude}`,
          source: 'web',
        })
        .pipe(finalize(() => this.clocking.set(false)))
        .subscribe({
          next: () => {
            this.success.set(
              action === 'clock-in'
                ? 'You are clocked in. Your time and location were recorded.'
                : 'You are clocked out. Your time and location were recorded.',
            );
            this.load();
          },
          error: (error: HttpErrorResponse) =>
            this.error.set(error.error?.detail ?? `Unable to ${action.replace('-', ' ')}.`),
        });
    } catch (error) {
      this.clocking.set(false);
      this.error.set(
        error instanceof GeolocationPositionError && error.code === error.PERMISSION_DENIED
          ? 'Location permission is required by your attendance policy. Allow location access and try again.'
          : 'Your location could not be captured. Check device location services and try again.',
      );
      this.locationStatus.set('Location was not recorded.');
    }
  }

  mapUrl(record: AttendanceRecord, kind: 'in' | 'out'): string | null {
    const latitude = kind === 'in' ? record.clockInLatitude : record.clockOutLatitude;
    const longitude = kind === 'in' ? record.clockInLongitude : record.clockOutLongitude;
    return latitude != null && longitude != null
      ? `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`
      : null;
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const value = this.passwordForm.getRawValue();
    if (value.newPassword !== value.confirmPassword) {
      this.error.set('New password and confirmation do not match.');
      return;
    }
    this.passwordSaving.set(true);
    this.error.set('');
    this.api
      .post<void>('/me/change-password', {
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
      })
      .pipe(finalize(() => this.passwordSaving.set(false)))
      .subscribe({
        next: () => {
          this.passwordOpen.set(false);
          this.auth.logout(false);
        },
        error: (error: HttpErrorResponse) =>
          this.error.set(error.error?.detail ?? 'Unable to change password.'),
      });
  }

  private getLocation(): Promise<GeolocationPosition> {
    if (!navigator.geolocation) return Promise.reject(new Error('Geolocation is unavailable.'));
    return new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0,
      }),
    );
  }
}
