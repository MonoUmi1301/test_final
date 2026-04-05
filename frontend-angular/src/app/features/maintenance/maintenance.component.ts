import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { FmtDatePipe, FmtThbPipe } from '../../shared/pipes/format.pipes';
import { Maintenance, Alert, Vehicle } from '../../core/models';

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [CommonModule, FormsModule, FmtDatePipe, FmtThbPipe],
  template: `
    <div class="page-body fade-in">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div>
          <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.5px;color:var(--apple-text-primary);">Maintenance</h1>
          <p style="font-size:13px;margin-top:2px;color:var(--apple-text-tertiary);">{{ allMaint.length }} maintenance records</p>
        </div>
        <button *ngIf="isAdmin" class="btn btn-primary" (click)="openCreateModal()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Schedule
        </button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 280px;gap:16px;align-items:start;">
        <!-- Table -->
        <div>
          <div class="chip-group" style="margin-bottom:14px;display:inline-flex;">
            <button class="chip" *ngFor="let s of statusOpts" [class.active]="filterStatus === s.val" (click)="setFilter(s.val)">
              {{ s.label }}
            </button>
          </div>

          <div class="card" style="overflow:hidden;">
            <div class="list-header" style="grid-template-columns:1fr 90px 120px 120px 100px 60px;">
              <div>Vehicle / Type</div><div>Status</div><div>Scheduled</div>
              <div>Technician</div><div>Cost</div><div></div>
            </div>
            <div>
              <div *ngIf="loading" class="empty-state"><p class="empty-state-text">Loading…</p></div>
              <div *ngIf="!loading && !filtered.length" class="empty-state"><p class="empty-state-text">No records found</p></div>
              <div *ngFor="let m of filtered" class="list-row" style="grid-template-columns:1fr 90px 120px 120px 100px 60px;" (click)="openDetail(m)">
                <div>
                  <div style="font-family:var(--font-mono);font-size:13px;font-weight:500;color:var(--apple-text-primary);">{{ m.license_plate || m.vehicle_id }}</div>
                  <div style="font-size:11px;color:var(--apple-text-tertiary);">{{ m.type.replace('_',' ') }}</div>
                </div>
                <div>
                  <span *ngIf="isOverdue(m)" class="badge status-OVERDUE">OVERDUE</span>
                  <span *ngIf="!isOverdue(m)" class="badge" [class]="'status-'+m.status">{{ m.status.replace('_',' ') }}</span>
                </div>
                <div [style.color]="getDateColor(m)">{{ m.scheduled_at | fmtDate }}</div>
                <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ m.technician || '—' }}</div>
                <div>{{ m.cost_thb | fmtThb }}</div>
                <div style="display:flex;justify-content:flex-end;" (click)="$event.stopPropagation()">
                  <button class="btn-icon" (click)="openDetail(m)" title="Details">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Alerts panel -->
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <span class="section-label">Alerts</span>
            <span *ngIf="alerts.length" style="font-size:11px;font-weight:600;color:var(--apple-red);background:var(--apple-red-dim);padding:2px 8px;border-radius:99px;">{{ alerts.length }}</span>
          </div>
          <div *ngIf="loading">
            <div class="skeleton" style="height:60px;border-radius:10px;margin-bottom:8px;"></div>
            <div class="skeleton" style="height:60px;border-radius:10px;"></div>
          </div>
          <div *ngIf="!loading && !alerts.length" class="empty-state"><p class="empty-state-text">No alerts 🎉</p></div>
          <div *ngFor="let a of alerts" class="alert-item" style="margin-bottom:8px;"
            [class.alert-critical]="a.severity==='CRITICAL'"
            [class.alert-warning]="a.severity==='WARNING'">
            <div class="alert-dot" [class]="a.severity"></div>
            <div>
              <div class="alert-msg">{{ a.message }}</div>
              <div class="alert-meta">{{ a.severity }} · {{ a.affected_resource_type }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail/Edit Modal -->
    <div *ngIf="showModal && selectedMaint" class="modal-overlay" (click)="closeModal()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2 class="modal-title">{{ modalTitle }}</h2>
          <button class="modal-close" (click)="closeModal()">×</button>
        </div>
        <div class="modal-body">
          <div *ngIf="modalMode === 'detail'">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group"><label class="form-label">Vehicle</label><div style="font-family:var(--font-mono);font-weight:600;">{{ selectedMaint.license_plate || selectedMaint.vehicle_id }}</div></div>
              <div class="form-group"><label class="form-label">Status</label><div><span class="badge" [class]="'status-'+selectedMaint.status">{{ selectedMaint.status }}</span></div></div>
              <div class="form-group"><label class="form-label">Type</label><div>{{ selectedMaint.type.replace('_',' ') }}</div></div>
              <div class="form-group"><label class="form-label">Technician</label><div>{{ selectedMaint.technician || '—' }}</div></div>
              <div class="form-group"><label class="form-label">Scheduled</label><div>{{ selectedMaint.scheduled_at | fmtDate }}</div></div>
              <div class="form-group"><label class="form-label">Cost</label><div>{{ selectedMaint.cost_thb | fmtThb }}</div></div>
              <div class="form-group" style="grid-column:1/-1;"><label class="form-label">Description</label><div>{{ selectedMaint.description || '—' }}</div></div>
              <div class="form-group" style="grid-column:1/-1;"><label class="form-label">Notes</label><div>{{ selectedMaint.notes || '—' }}</div></div>
            </div>
            <div *ngIf="isAdmin" style="margin-top:16px;border-top:1px solid var(--apple-divider);padding-top:16px;">
              <div class="form-label" style="margin-bottom:8px;">Actions</div>
              <div style="display:flex;gap:8px;">
                <button *ngIf="selectedMaint.status === 'SCHEDULED'" class="btn btn-primary btn-sm" (click)="updateStatus('IN_PROGRESS')">Start</button>
                <button *ngIf="selectedMaint.status === 'IN_PROGRESS'" class="btn btn-primary btn-sm" (click)="updateStatus('COMPLETED')">Complete</button>
              </div>
            </div>
          </div>

          <div *ngIf="modalMode === 'create'">
            <div class="form-group">
              <label class="form-label">Vehicle *</label>
              <select class="form-input form-select" [(ngModel)]="form.vehicle_id">
                <option value="">Select vehicle…</option>
                <option *ngFor="let v of vehicles" [value]="v.id">{{ v.license_plate }} — {{ v.brand }} {{ v.model }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Type *</label>
              <select class="form-input form-select" [(ngModel)]="form.type">
                <option value="OIL_CHANGE">Oil Change</option>
                <option value="TIRE_ROTATION">Tire Rotation</option>
                <option value="BRAKE_SERVICE">Brake Service</option>
                <option value="ENGINE_SERVICE">Engine Service</option>
                <option value="TRANSMISSION_SERVICE">Transmission Service</option>
                <option value="INSPECTION">Inspection</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Scheduled Date *</label>
              <input class="form-input" type="datetime-local" [(ngModel)]="form.scheduled_at"/>
            </div>
            <div class="form-group">
              <label class="form-label">Technician</label>
              <input class="form-input" [(ngModel)]="form.technician" placeholder="Technician name"/>
            </div>
            <div class="form-group">
              <label class="form-label">Cost (฿)</label>
              <input class="form-input" type="number" [(ngModel)]="form.cost_thb" placeholder="0"/>
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <input class="form-input" [(ngModel)]="form.description" placeholder="Work description…"/>
            </div>
          </div>
        </div>
        <div *ngIf="modalMode === 'create'" class="modal-footer">
          <button class="btn btn-ghost" (click)="closeModal()">Cancel</button>
          <button class="btn btn-primary" [disabled]="saving" (click)="saveMaintenance()">{{ saving ? 'Saving…' : 'Save' }}</button>
        </div>
      </div>
    </div>

    <!-- Create Modal trigger for dummy selectedMaint -->
    <div *ngIf="showCreateForm" class="modal-overlay" (click)="showCreateForm=false">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2 class="modal-title">Schedule Maintenance</h2>
          <button class="modal-close" (click)="showCreateForm=false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Vehicle *</label>
            <select class="form-input form-select" [(ngModel)]="form.vehicle_id">
              <option value="">Select vehicle…</option>
              <option *ngFor="let v of vehicles" [value]="v.id">{{ v.license_plate }} — {{ v.brand }} {{ v.model }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Type *</label>
            <select class="form-input form-select" [(ngModel)]="form.type">
              <option value="OIL_CHANGE">Oil Change</option>
              <option value="TIRE_ROTATION">Tire Rotation</option>
              <option value="BRAKE_SERVICE">Brake Service</option>
              <option value="ENGINE_SERVICE">Engine Service</option>
              <option value="INSPECTION">Inspection</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Scheduled Date *</label>
            <input class="form-input" type="datetime-local" [(ngModel)]="form.scheduled_at"/>
          </div>
          <div class="form-group">
            <label class="form-label">Technician</label>
            <input class="form-input" [(ngModel)]="form.technician" placeholder="Technician name"/>
          </div>
          <div class="form-group">
            <label class="form-label">Cost (฿)</label>
            <input class="form-input" type="number" [(ngModel)]="form.cost_thb"/>
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <input class="form-input" [(ngModel)]="form.description" placeholder="Work description…"/>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" (click)="showCreateForm=false">Cancel</button>
          <button class="btn btn-primary" [disabled]="saving" (click)="saveMaintenance()">{{ saving ? 'Saving…' : 'Save' }}</button>
        </div>
      </div>
    </div>
  `
})
export class MaintenanceComponent implements OnInit {
  allMaint: Maintenance[] = [];
  filtered: Maintenance[] = [];
  alerts: Alert[] = [];
  vehicles: Vehicle[] = [];
  loading = true;
  isAdmin = false;

  filterStatus = '';
  statusOptions = ['', 'SCHEDULED', 'IN_PROGRESS', 'OVERDUE', 'COMPLETED'];
  statusOpts = [
    { val: '', label: 'All' },
    { val: 'SCHEDULED', label: 'Scheduled' },
    { val: 'IN_PROGRESS', label: 'In Progress' },
    { val: 'OVERDUE', label: 'Overdue' },
    { val: 'COMPLETED', label: 'Completed' },
  ];
  now = new Date();

  showModal = false;
  showCreateForm = false;
  modalMode: 'detail' | 'create' = 'detail';
  modalTitle = '';
  selectedMaint: Maintenance | null = null;
  saving = false;
  form: Partial<Maintenance> = {};

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private auth: AuthService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.auth.getUser()?.role === 'ADMIN';
    this.route.queryParams.subscribe(p => { this.filterStatus = p['status'] || ''; });
    this.loadAll();
  }

  loadAll(): void {
    forkJoin({
      maint: this.api.getJSON<Maintenance[]>('/maintenance'),
      alerts: this.api.getJSON<Alert[]>('/alerts'),
      vehicles: this.api.getJSON<Vehicle[]>('/vehicles')
    }).subscribe({
      next: ({ maint, alerts, vehicles }: any) => {
        this.allMaint  = Array.isArray(maint)    ? maint    : (maint?.data    ?? []);
        this.alerts    = Array.isArray(alerts)   ? alerts   : (alerts?.data   ?? []);
        this.vehicles  = Array.isArray(vehicles) ? vehicles : (vehicles?.data ?? []);
        this.loading = false;
        this.applyFilter();
      },
      error: () => { this.loading = false; this.toast.show('Failed to load maintenance', 'error'); }
    });
  }

  setFilter(s: string): void { this.filterStatus = s; this.applyFilter(); }

  applyFilter(): void {
    this.filtered = this.filterStatus ? this.allMaint.filter(m => m.status === this.filterStatus) : this.allMaint;
  }

  isOverdue(m: Maintenance): boolean {
    return !['COMPLETED', 'IN_PROGRESS'].includes(m.status) && new Date(m.scheduled_at) < this.now;
  }

  getDateColor(m: Maintenance): string {
    if (this.isOverdue(m)) return 'var(--apple-red)';
    const diff = (new Date(m.scheduled_at).getTime() - this.now.getTime()) / 86400000;
    if (diff <= 7) return 'var(--apple-orange)';
    return 'var(--apple-text-secondary)';
  }

  openDetail(m: Maintenance): void {
    this.selectedMaint = m;
    this.modalMode = 'detail';
    this.modalTitle = m.license_plate || m.vehicle_id;
    this.showModal = true;
  }

  openCreateModal(): void {
    this.form = { type: 'OIL_CHANGE' };
    this.showCreateForm = true;
  }

  closeModal(): void { this.showModal = false; }

  updateStatus(status: string): void {
    if (!this.selectedMaint) return;
    this.api.patchJSON(`/maintenance/${this.selectedMaint.id}`, { status }).subscribe({
      next: () => { this.toast.show(`Status updated to ${status}`); this.closeModal(); this.loadAll(); },
      error: () => this.toast.show('Failed to update status', 'error')
    });
  }

  saveMaintenance(): void {
    if (!this.form.vehicle_id || !this.form.type || !this.form.scheduled_at) {
      this.toast.show('Vehicle, type and scheduled date are required', 'error'); return;
    }
    this.saving = true;
    this.api.postJSON('/maintenance', this.form).subscribe({
      next: () => { this.toast.show('Maintenance scheduled'); this.showCreateForm = false; this.loadAll(); },
      error: (e) => { this.saving = false; this.toast.show(e?.error?.error?.message || 'Save failed', 'error'); },
      complete: () => { this.saving = false; }
    });
  }
}
