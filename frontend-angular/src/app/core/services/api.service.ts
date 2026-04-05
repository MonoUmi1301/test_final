import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = environment.apiUrl;
  private refreshing$ = new BehaviorSubject<boolean>(false);

  constructor(private http: HttpClient, private auth: AuthService) {}

  private headers(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.auth.getToken()}`
    });
  }

  get<T>(path: string, params?: HttpParams): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}${path}`, {
      headers: this.headers(),
      params
    });
  }

  post<T>(path: string, body: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}${path}`, body, { headers: this.headers() });
  }

  patch<T>(path: string, body: any): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}${path}`, body, { headers: this.headers() });
  }

  delete<T>(path: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}${path}`, { headers: this.headers() });
  }

  // Shorthand methods that unwrap .data
  getJSON<T>(path: string, params?: HttpParams): Observable<T> {
    return new Observable(observer => {
      this.get(path, params).subscribe({
        next: (res: any) => { observer.next(res.data); observer.complete(); },
        error: (err: any) => observer.error(err)
      });
    });
  }

  postJSON<T>(path: string, body: any): Observable<T> {
    return new Observable(observer => {
      this.post(path, body).subscribe({
        next: (res: any) => { observer.next(res.data); observer.complete(); },
        error: (err: any) => observer.error(err)
      });
    });
  }

  patchJSON<T>(path: string, body: any): Observable<T> {
    return new Observable(observer => {
      this.patch(path, body).subscribe({
        next: (res: any) => { observer.next(res.data); observer.complete(); },
        error: (err: any) => observer.error(err)
      });
    });
  }

  deleteJSON<T>(path: string): Observable<T> {
    return new Observable(observer => {
      this.delete(path).subscribe({
        next: (res: any) => { observer.next(res.data); observer.complete(); },
        error: (err: any) => observer.error(err)
      });
    });
  }
}
