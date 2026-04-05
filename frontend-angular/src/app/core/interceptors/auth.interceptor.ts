import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

let isRefreshing = false;
const refreshSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const auth = inject(AuthService);
  const http = inject(HttpClient);

  const addToken = (r: HttpRequest<unknown>, token: string) =>
    r.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

  const token = auth.getToken();
  const authReq = token ? addToken(req, token) : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401) return throwError(() => err);

      const code = err.error?.error?.code;
      if (code === 'REFRESH_EXPIRED' || code === 'INVALID_TOKEN' || code === 'UNAUTHORIZED') {
        auth.logout(true);
        return throwError(() => err);
      }

      if (code === 'TOKEN_EXPIRED') {
        if (!isRefreshing) {
          isRefreshing = true;
          refreshSubject.next(null);

          return http.post<any>(`${environment.apiUrl}/auth/refresh`, {
            refreshToken: auth.getRefreshToken()
          }).pipe(
            switchMap(res => {
              isRefreshing = false;
              const newToken = res?.data?.accessToken;
              if (newToken) {
                auth.updateAccessToken(newToken);
                refreshSubject.next(newToken);
                return next(addToken(req, newToken));
              }
              auth.logout(true);
              return throwError(() => new Error('Refresh failed'));
            }),
            catchError(e => {
              isRefreshing = false;
              auth.logout(true);
              return throwError(() => e);
            })
          );
        }

        return refreshSubject.pipe(
          filter(t => t !== null),
          take(1),
          switchMap(t => next(addToken(req, t!)))
        );
      }

      return throwError(() => err);
    })
  );
};
