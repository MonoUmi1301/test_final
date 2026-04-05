import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-logo-wrap">
          <div class="auth-logo-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <rect x="1" y="3" width="15" height="13" rx="2"/>
              <path d="M16 8h4l3 3v5h-7V8z"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
          <div class="auth-title">Fleet OS</div>
          <div class="auth-sub">Fleet Management Platform</div>
        </div>

        <div *ngIf="errorMsg" class="form-error" style="margin-bottom:16px;">{{ errorMsg }}</div>

        <div class="form-group">
          <label class="form-label">Username</label>
          <input
            type="text" class="form-input"
            placeholder="Enter username"
            autocomplete="username"
            [(ngModel)]="username"
            (keydown.enter)="doLogin()"
          />
        </div>
        <div class="form-group" style="margin-top:12px;">
          <label class="form-label">Password</label>
          <input
            type="password" class="form-input"
            placeholder="Enter password"
            autocomplete="current-password"
            [(ngModel)]="password"
            (keydown.enter)="doLogin()"
          />
        </div>
        <button
          class="btn btn-primary btn-lg btn-full"
          style="margin-top:20px;"
          [disabled]="loading"
          (click)="doLogin()"
        >
          {{ loading ? 'Signing in…' : 'Sign In' }}
        </button>

        <p style="text-align:center;font-size:11px;color:var(--apple-text-tertiary);margin-top:20px;">
          Fleet OS v2.0 — Logistics Management
        </p>
      </div>
    </div>
  `
})
export class LoginComponent implements OnInit {
  username = '';
  password = '';
  loading = false;
  errorMsg = '';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
      return;
    }
    if (this.route.snapshot.queryParams['expired']) {
      this.errorMsg = 'Session expired. Please sign in again.';
    }
  }

  async doLogin(): Promise<void> {
    if (!this.username || !this.password) {
      this.errorMsg = 'Please enter username and password.';
      return;
    }
    this.loading = true;
    this.errorMsg = '';
    try {
      const res: any = await this.http.post(`${environment.apiUrl}/auth/login`, {
        username: this.username,
        password: this.password
      }).toPromise();

      this.auth.setSession(res.data.accessToken, res.data.refreshToken, res.data.user);
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.errorMsg = err?.error?.error?.message || 'Login failed. Check your credentials.';
    } finally {
      this.loading = false;
    }
  }
}
