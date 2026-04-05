import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private router: Router) {}

  getToken(): string | null {
    return sessionStorage.getItem('accessToken');
  }

  getRefreshToken(): string | null {
    return sessionStorage.getItem('refreshToken');
  }

  getUser(): User | null {
    try {
      return JSON.parse(sessionStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    const expiresAt = sessionStorage.getItem('expiresAt');
    if (!token) return false;
    if (expiresAt && Date.now() > parseInt(expiresAt)) {
      this.logout(true);
      return false;
    }
    return true;
  }

  setSession(accessToken: string, refreshToken: string, user: User): void {
    sessionStorage.setItem('accessToken', accessToken);
    sessionStorage.setItem('refreshToken', refreshToken);
    sessionStorage.setItem('user', JSON.stringify(user));
    const expiresIn = 7 * 24 * 60 * 60 * 1000;
    sessionStorage.setItem('expiresAt', (Date.now() + expiresIn).toString());
  }

  updateAccessToken(token: string): void {
    sessionStorage.setItem('accessToken', token);
  }

  logout(expired = false): void {
    sessionStorage.clear();
    this.router.navigate(['/login'], expired ? { queryParams: { expired: 1 } } : {});
  }
}
