import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpParams } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { AuditLog } from '../../core/models';

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'var(--apple-green)', LOGOUT: 'var(--apple-text-tertiary)',
  DELETE_VEHICLE: 'var(--apple-red)', DELETE_DRIVER: 'var(--apple-red)',
  CREATE_VEHICLE: 'var(--apple-blue)', CREATE_DRIVER: 'var(--apple-blue)', CREATE_TRIP: 'var(--apple-blue)',
  COMPLETE_TRIP: 'var(--apple-green)', CANCEL_TRIP: 'var(--apple-orange)',
};

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-body fade-in">
      <div style="margin-bottom:20px;">
        <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.5px;color:var(--apple-text-primary);">Audit Log</h1>
        <p style="font-size:13px;margin-top:2px;color:var(--apple-text-tertiary);">{{ total.toLocaleString() }} entries</p>
      </div>

      <div class="card" style="padding:14px;margin-bottom:14px;">
        <div class="filter-bar" style="flex-wrap:wrap;gap:10px;">
          <select class="form-input form-select" style="width:170px;" [(ngModel)]="fAction">
            <option value="">All Actions</option>
            <option *ngFor="let a of actions" [value]="a">{{ formatAction(a) }}</option>
          </select>
          <select class="form-input form-select" style="width:150px;" [(ngModel)]="fResource">
            <option value="">All Resources</option>
            <option *ngFor="let r of resources" [value]="r">{{ r }}</option>
          </select>
          <input type="date" class="form-input" style="width:150px;" [(ngModel)]="fDateFrom"/>
          <input type="date" class="form-input" style="width:150px;" [(ngModel)]="fDateTo"/>
          <input *ngIf="isAdmin" class="form-input" style="width:160px;" placeholder="User ID" [(ngModel)]="fUser"/>
          <button class="btn btn-primary btn-sm" (click)="applyFilters()">Apply</button>
          <button class="btn btn-ghost btn-sm" (click)="clearFilters()">Clear</button>
          <span *ngIf="!isAdmin" style="margin-left:auto;font-size:11px;color:var(--apple-text-tertiary);">
            Showing your activity only
          </span>
        </div>
      </div>

      <div class="card" style="overflow:hidden;">
        <div class="list-header" style="grid-template-columns:170px 130px 1fr 1fr 80px;">
          <div>Timestamp</div><div>User</div><div>Action</div><div>Resource</div><div>Result</div>
        </div>
        <div>
          <div *ngIf="loading" class="empty-state"><p class="empty-state-text">Loading…</p></div>
          <div *ngIf="!loading && !logs.length" class="empty-state"><p class="empty-state-text">No log entries found</p></div>
          <div *ngFor="let l of logs" class="list-row" style="grid-template-columns:170px 130px 1fr 1fr 80px;">
            <div style="font-family:var(--font-mono);font-size:11px;color:var(--apple-text-tertiary);">
              {{ formatDate(l.created_at) }}
            </div>
            <div style="font-size:13px;color:var(--apple-text-secondary);">{{ l.username || l.user_id.slice(0,8) || '—' }}</div>
            <div>
              <span style="font-family:var(--font-mono);font-size:11px;" [style.color]="getActionColor(l.action)">{{ l.action }}</span>
            </div>
            <div style="font-size:13px;color:var(--apple-text-secondary);">
              {{ l.resource_type }}
              <span *ngIf="l.resource_id" style="font-size:11px;color:var(--apple-text-tertiary);"> · {{ l.resource_id.slice(0,8) }}</span>
            </div>
            <div>
              <span class="badge" [class]="l.success ? 'status-ACTIVE' : 'status-RETIRED'">
                {{ l.success ? 'OK' : 'FAIL' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;">
        <span style="font-size:12px;color:var(--apple-text-tertiary);">
          Page {{ page }} of {{ totalPages }}
        </span>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-ghost btn-sm" [disabled]="page <= 1" (click)="goPage(page-1)">← Previous</button>
          <button class="btn btn-ghost btn-sm" [disabled]="page >= totalPages" (click)="goPage(page+1)">Next →</button>
        </div>
      </div>
    </div>
  `
})
export class AuditComponent implements OnInit {
  logs: AuditLog[] = [];
  loading = true;
  total = 0;
  page = 1;
  perPage = 60;
  totalPages = 1;
  isAdmin = false;

  fAction = '';
  fResource = '';
  fDateFrom = '';
  fDateTo = '';
  fUser = '';

  actions = ['LOGIN','LOGOUT','CREATE_VEHICLE','UPDATE_VEHICLE','DELETE_VEHICLE','ASSIGN_DRIVER',
    'CREATE_DRIVER','UPDATE_DRIVER','CREATE_TRIP','START_TRIP','COMPLETE_TRIP','CANCEL_TRIP',
    'UPDATE_CHECKPOINT','CREATE_MAINTENANCE','UPDATE_MAINTENANCE'];
  resources = ['USER','VEHICLE','DRIVER','TRIP','CHECKPOINT','MAINTENANCE'];

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.auth.getUser()?.role === 'ADMIN';
    this.loadLogs();
  }

  loadLogs(): void {
    this.loading = true;
    let params = new HttpParams()
      .set('page', this.page.toString())
      .set('limit', this.perPage.toString());

    if (this.fAction)   params = params.set('action', this.fAction);
    if (this.fResource) params = params.set('resource_type', this.fResource);
    if (this.fDateFrom) params = params.set('date_from', this.fDateFrom + 'T00:00:00');
    if (this.fDateTo)   params = params.set('date_to', this.fDateTo + 'T23:59:59');
    if (this.fUser && this.isAdmin) params = params.set('user_id', this.fUser);

    this.api.get('/audit-logs', params).subscribe({
      next: (res: any) => {
        this.logs = res.data || [];
        this.total = res.meta?.total || 0;
        this.totalPages = res.meta?.pages || 1;
        this.loading = false;
      },
      error: () => { this.loading = false; this.toast.show('Failed to load audit logs', 'error'); }
    });
  }

  applyFilters(): void { this.page = 1; this.loadLogs(); }

  clearFilters(): void {
    this.fAction = ''; this.fResource = '';
    this.fDateFrom = ''; this.fDateTo = ''; this.fUser = '';
    this.applyFilters();
  }

  goPage(p: number): void { this.page = p; this.loadLogs(); }

  getActionColor(action: string): string {
    return ACTION_COLORS[action] || 'var(--apple-text-primary)';
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleString('th-TH');
  }

  formatAction(a: string): string {
    return a.replace(/_/g, ' ');
  }
}
