import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.accessToken();
  const tenantId = auth.tenantId();

  const secured = token
    ? request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
          ...(tenantId !== 'anonymous' ? { 'X-Tenant-ID': tenantId } : {}),
        },
      })
    : request;

  return next(secured).pipe(
    catchError((error: HttpErrorResponse) => {
      if (
        error.status === 401 &&
        !request.url.endsWith('/auth/login') &&
        !request.url.endsWith('/auth/refresh')
      ) {
        return auth.refreshSession().pipe(
          switchMap((session) =>
            next(
              request.clone({
                setHeaders: {
                  Authorization: `Bearer ${session.accessToken}`,
                  'X-Tenant-ID': session.user.tenantId,
                },
              }),
            ),
          ),
          catchError((refreshError) => {
            auth.logout(false);
            void router.navigate(['/login']);
            return throwError(() => refreshError);
          }),
        );
      }
      if (error.status === 401 && request.url.endsWith('/auth/refresh')) {
        auth.logout(false);
        void router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
