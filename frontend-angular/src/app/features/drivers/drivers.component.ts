import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { FmtDatePipe } from '../../shared/pipes/format.pipes';
import { Driver } from '../../core/models';

@Component({
  selector: 'app-drivers',
  standalone: true,
  imports: [CommonModule, FormsModule, FmtDatePipe],
  template: `
    <div class="page-body fade-in">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div>
          <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.5px;color:var(--apple-text-primary);">Drivers</h1>
          <p style="font-size:13px;margin-top:2px;color:var(--apple-text-tertiary);">{{ allDrivers.length }} drivers</p>
        </div>
        <button *ngIf="isAdmin" class="btn btn-primary" (click)="openModal(null)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Driver
        </button>
      </div>

      <div class="filter-bar" style="margin-bottom:16px;">
        <div class="search-wrap" style="flex:1;max-width:280px;">
          <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input class="search-input" placeholder="Search name, license, phone…" [(ngModel)]="searchQ" (ngModelChange)="applyFilter()"/>
        </div>
        <div class="chip-group">
          <button class="chip" *ngFor="let s of statusOpts" [class.active]="filterStatus === s.val" (click)="setFilter(s.val)">
            {{ s.label }}
          </button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
        <div *ngIf="loading" class="empty-state" style="grid-column:1/-1;"><p class="empty-state-text">Loading…</p></div>
        <div *ngIf="!loading && !filtered.length" class="empty-state" style="grid-column:1/-1;">
          <p class="empty-state-text">No drivers found</p>
        </div>
        <div *ngFor="let d of filtered" class="entity-card" (click)="openModal(d)">
          <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;">
            <div class="entity-avatar">{{ (d.name[0] || 'D').toUpperCase() }}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:600;color:var(--apple-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ d.name }}</div>
              <div style="font-size:11px;color:var(--apple-text-tertiary);margin-top:1px;">{{ d.phone }}</div>
            </div>
            <span class="badge" [class]="'status-'+d.status">{{ d.status }}</span>
          </div>
          <div style="font-family:var(--font-mono);font-size:11px;color:var(--apple-text-secondary);margin-bottom:4px;">{{ d.license_number }}</div>
          <div [style.color]="getLicenseColor(d.license_expires_at)" style="font-size:11px;">
            {{ getLicenseLabel(d.license_expires_at) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div *ngIf="showModal" class="modal-overlay" (click)="closeModal()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2 class="modal-title">{{ modalTitle }}</h2>
          <button class="modal-close" (click)="closeModal()">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Full Name *</label>
            <input class="form-input" [(ngModel)]="form.name" placeholder="สมชาย ใจดี"/>
          </div>
          <div class="form-group">
            <label class="form-label">License Number *</label>
            <input class="form-input" [(ngModel)]="form.license_number" placeholder="D-1234567"/>
          </div>
          <div class="form-group">
            <label class="form-label">License Expires *</label>
            <input class="form-input" type="date" [(ngModel)]="form.license_expires_at"/>
          </div>
          <div class="form-group">
            <label class="form-label">Phone *</label>
            <input class="form-input" [(ngModel)]="form.phone" placeholder="08X-XXX-XXXX"/>
          </div>
          <div *ngIf="isAdmin && selectedDriver" class="form-group">
            <label class="form-label">Status</label>
            <select class="form-input form-select" [(ngModel)]="form.status">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" (click)="closeModal()">Cancel</button>
          <button class="btn btn-primary" [disabled]="saving" (click)="save()">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class DriversComponent implements OnInit {
  allDrivers: Driver[] = [];
  filtered: Driver[] = [];
  loading = true;
  isAdmin = false;

  filterStatus = '';
  searchQ = '';
  statusOptions = ['', 'ACTIVE', 'INACTIVE', 'SUSPENDED'];
  statusOpts = [
    { val: '', label: 'All' },
    { val: 'ACTIVE', label: 'Active' },
    { val: 'INACTIVE', label: 'Inactive' },
    { val: 'SUSPENDED', label: 'Suspended' },
  ];

  showModal = false;
  modalTitle = '';
  selectedDriver: Driver | null = null;
  saving = false;
  form: Partial<Driver> = {};

  constructor(private api: ApiService, private toast: ToastService, private auth: AuthService) {}

  ngOnInit(): void {
    this.isAdmin = this.auth.getUser()?.role === 'ADMIN';
    this.loadDrivers();
  }

  loadDrivers(): void {
    this.api.getJSON<Driver[]>('/drivers').subscribe({
      next: (d: any) => { this.allDrivers = Array.isArray(d) ? d : (d?.data ?? []); this.loading = false; this.applyFilter(); },
      error: () => { this.loading = false; this.toast.show('Failed to load drivers', 'error'); }
    });
  }

  setFilter(s: string): void { this.filterStatus = s; this.applyFilter(); }

  applyFilter(): void {
    const q = this.searchQ.toLowerCase();
    this.filtered = this.allDrivers.filter(d => {
      if (this.filterStatus && d.status !== this.filterStatus) return false;
      if (q && !`${d.name} ${d.license_number} ${d.phone}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  getLicenseSeverity(dateStr: string): 'expired' | 'warning' | 'ok' {
    const diff = (new Date(dateStr).getTime() - Date.now()) / 86400000;
    if (diff < 0) return 'expired';
    if (diff <= 30) return 'warning';
    return 'ok';
  }

  getLicenseColor(dateStr: string): string {
    const s = this.getLicenseSeverity(dateStr);
    return s === 'expired' ? 'var(--apple-red)' : s === 'warning' ? 'var(--apple-orange)' : 'var(--apple-text-tertiary)';
  }

  getLicenseLabel(dateStr: string): string {
    const s = this.getLicenseSeverity(dateStr);
    if (s === 'expired') return 'License EXPIRED';
    const d = new Date(dateStr).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
    return `Expires ${d}`;
  }

  openModal(d: Driver | null): void {
    this.selectedDriver = d;
    this.form = d ? { ...d, license_expires_at: d.license_expires_at?.slice(0, 10) } : {};
    this.modalTitle = d ? d.name : 'Add Driver';
    this.showModal = true;
  }

  closeModal(): void { this.showModal = false; }

  save(): void {
    if (!this.form.name || !this.form.license_number || !this.form.license_expires_at || !this.form.phone) {
      this.toast.show('All fields are required', 'error'); return;
    }
    this.saving = true;
    const obs = this.selectedDriver
      ? this.api.patchJSON(`/drivers/${this.selectedDriver.id}`, this.form)
      : this.api.postJSON('/drivers', this.form);

    obs.subscribe({
      next: () => { this.toast.show(this.selectedDriver ? 'Driver updated' : 'Driver created'); this.closeModal(); this.loadDrivers(); },
      error: (e) => { this.saving = false; this.toast.show(e?.error?.error?.message || 'Save failed', 'error'); },
      complete: () => { this.saving = false; }
    });
  }
}
