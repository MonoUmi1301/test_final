import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { FmtDatePipe, FmtKmPipe } from '../../shared/pipes/format.pipes';
import { Vehicle } from '../../core/models';

type VehicleStatus = 'ACTIVE' | 'IDLE' | 'MAINTENANCE' | 'RETIRED';
type VehicleType = 'TRUCK' | 'VAN' | 'MOTORCYCLE' | 'PICKUP';

const VALID_TRANSITIONS: Record<string, string[]> = {
  IDLE: ['ACTIVE', 'MAINTENANCE'],
  ACTIVE: ['IDLE', 'MAINTENANCE'],
  MAINTENANCE: ['IDLE'],
  RETIRED: []
};

@Component({
  selector: 'app-vehicles',
  standalone: true,
  imports: [CommonModule, FormsModule, FmtDatePipe, FmtKmPipe],
  template: `
    <div class="page-body fade-in">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div>
          <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.5px;color:var(--apple-text-primary);">Vehicles</h1>
          <p style="font-size:13px;margin-top:2px;color:var(--apple-text-tertiary);">{{ allVehicles.length }} vehicles total</p>
        </div>
        <button *ngIf="isAdmin" class="btn btn-primary" (click)="openCreateModal()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Vehicle
        </button>
      </div>

      <div class="filter-bar" style="margin-bottom:16px;">
        <div class="search-wrap" style="flex:1;max-width:280px;">
          <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input class="search-input" placeholder="Search plate, brand, driver…" [(ngModel)]="searchQ" (ngModelChange)="applyFilters()"/>
        </div>

        <div class="chip-group">
          <button class="chip" [class.active]="filterStatus === s.val" *ngFor="let s of statusOpts" (click)="setStatus(s.val)">
            {{ s.label }}
          </button>
        </div>

        <div class="chip-group">
          <button class="chip" [class.active]="filterType === t.val" *ngFor="let t of typeOpts" (click)="setType(t.val)">
            {{ t.label }}
          </button>
        </div>
      </div>

      <div class="card" style="overflow:hidden;">
        <div class="list-header" style="grid-template-columns:1.2fr 90px 110px 90px 150px 130px 80px;">
          <div>Vehicle</div><div>Type</div><div>Status</div><div>Mileage</div>
          <div>Driver</div><div>Next Service</div><div></div>
        </div>
        <div>
          <div *ngIf="loading" class="empty-state"><p class="empty-state-text">Loading vehicles…</p></div>
          <div *ngIf="!loading && !filtered.length" class="empty-state">
            <p class="empty-state-text">No vehicles match your filters</p>
          </div>
          <div *ngFor="let v of filtered" class="list-row"
            style="grid-template-columns:1.2fr 90px 110px 90px 150px 130px 80px;"
            (click)="openDetail(v)">
            <div>
              <div style="font-family:var(--font-mono);font-size:13px;font-weight:500;color:var(--apple-text-primary);">{{ v.license_plate }}</div>
              <div style="font-size:11px;color:var(--apple-text-tertiary);margin-top:1px;">{{ joinVehicleInfo(v) }}</div>
            </div>
            <div><span class="badge badge-neutral">{{ v.type }}</span></div>
            <div><span class="badge" [class]="'status-'+v.status">{{ v.status }}</span></div>
            <div style="font-family:var(--font-mono);font-size:11px;color:var(--apple-text-secondary);">{{ (v.mileage_km || 0).toLocaleString() }}</div>
            <div style="font-size:13px;color:var(--apple-text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ v.driver_name || '—' }}</div>
            <div>
              <ng-container *ngIf="v.next_service_km; else noService">
                <div style="font-family:var(--font-mono);font-size:11px;color:var(--apple-text-secondary);margin-bottom:4px;">{{ v.next_service_km.toLocaleString() }} km</div>
                <div class="progress-wrap" style="width:80px;">
                  <div class="progress-fill" [class]="getSvcColor(v)" [style.width]="getSvcPct(v) + '%'"></div>
                </div>
              </ng-container>
              <ng-template #noService>
                <span style="font-size:13px;color:var(--apple-text-tertiary);">—</span>
              </ng-template>
            </div>
            <div style="display:flex;gap:6px;justify-content:flex-end;" (click)="$event.stopPropagation()">
              <button class="btn-icon" (click)="openDetail(v)" title="Details">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
              <button *ngIf="isAdmin" class="btn-icon" (click)="openEditModal(v)" title="Edit">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            </div>
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
          <!-- Detail view -->
          <ng-container *ngIf="modalMode === 'detail' && selectedVehicle">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group"><label class="form-label">License Plate</label><div style="font-family:var(--font-mono);font-weight:600;font-size:16px;color:var(--apple-text-primary);">{{ selectedVehicle.license_plate }}</div></div>
              <div class="form-group"><label class="form-label">Status</label><div><span class="badge" [class]="'status-'+selectedVehicle.status">{{ selectedVehicle.status }}</span></div></div>
              <div class="form-group"><label class="form-label">Brand / Model</label><div>{{ joinVehicleInfo(selectedVehicle) }}</div></div>
              <div class="form-group"><label class="form-label">Type</label><div>{{ selectedVehicle.type }}</div></div>
              <div class="form-group"><label class="form-label">Mileage</label><div>{{ selectedVehicle.mileage_km | fmtKm }}</div></div>
              <div class="form-group"><label class="form-label">Next Service</label><div>{{ selectedVehicle.next_service_km ? selectedVehicle.next_service_km.toLocaleString() + ' km' : '—' }}</div></div>
              <div class="form-group"><label class="form-label">Fuel Type</label><div>{{ selectedVehicle.fuel_type || '—' }}</div></div>
              <div class="form-group"><label class="form-label">Capacity</label><div>{{ selectedVehicle.capacity_kg ? selectedVehicle.capacity_kg.toLocaleString() + ' kg' : '—' }}</div></div>
              <div class="form-group" style="grid-column:1/-1;"><label class="form-label">Assigned Driver</label><div>{{ selectedVehicle.driver_name || '—' }}</div></div>
            </div>
            <div *ngIf="isAdmin" style="display:flex;flex-direction:column;gap:8px;margin-top:16px;border-top:1px solid var(--apple-divider);padding-top:16px;">
              <div class="form-label">Change Status</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button *ngFor="let ns of getAllowedTransitions(selectedVehicle.status)"
                  class="btn btn-ghost btn-sm" (click)="changeStatus(selectedVehicle, ns)">
                  → {{ ns }}
                </button>
                <span *ngIf="!getAllowedTransitions(selectedVehicle.status).length" style="font-size:12px;color:var(--apple-text-tertiary);">No transitions available</span>
              </div>
            </div>
          </ng-container>

          <!-- Create / Edit form -->
          <ng-container *ngIf="modalMode === 'create' || modalMode === 'edit'">
            <div class="form-group">
              <label class="form-label">License Plate *</label>
              <input class="form-input" [(ngModel)]="form.license_plate" placeholder="กข-1234"/>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group">
                <label class="form-label">Brand</label>
                <input class="form-input" [(ngModel)]="form.brand" placeholder="Isuzu"/>
              </div>
              <div class="form-group">
                <label class="form-label">Model</label>
                <input class="form-input" [(ngModel)]="form.model" placeholder="D-Max"/>
              </div>
              <div class="form-group">
                <label class="form-label">Year</label>
                <input class="form-input" type="number" [(ngModel)]="form.year" placeholder="2023"/>
              </div>
              <div class="form-group">
                <label class="form-label">Type *</label>
                <select class="form-input form-select" [(ngModel)]="form.type">
                  <option value="TRUCK">Truck</option>
                  <option value="VAN">Van</option>
                  <option value="MOTORCYCLE">Motorcycle</option>
                  <option value="PICKUP">Pickup</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Mileage (km)</label>
                <input class="form-input" type="number" [(ngModel)]="form.mileage_km" placeholder="0"/>
              </div>
              <div class="form-group">
                <label class="form-label">Next Service (km)</label>
                <input class="form-input" type="number" [(ngModel)]="form.next_service_km" placeholder="10000"/>
              </div>
              <div class="form-group">
                <label class="form-label">Fuel Type</label>
                <select class="form-input form-select" [(ngModel)]="form.fuel_type">
                  <option value="">—</option>
                  <option value="DIESEL">Diesel</option>
                  <option value="GASOLINE">Gasoline</option>
                  <option value="ELECTRIC">Electric</option>
                  <option value="HYBRID">Hybrid</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Capacity (kg)</label>
                <input class="form-input" type="number" [(ngModel)]="form.capacity_kg" placeholder="1000"/>
              </div>
            </div>
            <div class="modal-footer" style="margin-top:8px;">
              <button class="btn btn-ghost" (click)="closeModal()">Cancel</button>
              <button class="btn btn-primary" [disabled]="saving" (click)="saveVehicle()">
                {{ saving ? 'Saving…' : 'Save' }}
              </button>
            </div>
          </ng-container>
        </div>
      </div>
    </div>
  `
})
export class VehiclesComponent implements OnInit {
  allVehicles: Vehicle[] = [];
  filtered: Vehicle[] = [];
  loading = true;
  isAdmin = false;

  filterStatus = '';
  filterType = '';
  searchQ = '';

  statusOptions = ['', 'ACTIVE', 'IDLE', 'MAINTENANCE', 'RETIRED'];
  typeOptions = ['', 'TRUCK', 'VAN', 'MOTORCYCLE', 'PICKUP'];

  statusOpts = [
    { val: '', label: 'All' },
    { val: 'ACTIVE', label: 'Active' },
    { val: 'IDLE', label: 'Idle' },
    { val: 'MAINTENANCE', label: 'Maintenance' },
    { val: 'RETIRED', label: 'Retired' },
  ];
  typeOpts = [
    { val: '', label: 'All Types' },
    { val: 'TRUCK', label: 'Truck' },
    { val: 'VAN', label: 'Van' },
    { val: 'MOTORCYCLE', label: 'Motorcycle' },
    { val: 'PICKUP', label: 'Pickup' },
  ];

  showModal = false;
  modalMode: 'detail' | 'create' | 'edit' = 'detail';
  modalTitle = '';
  selectedVehicle: Vehicle | null = null;
  saving = false;

  form: Partial<Vehicle> = {};

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private auth: AuthService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.auth.getUser()?.role === 'ADMIN';
    this.route.queryParams.subscribe(p => {
      this.filterStatus = p['status'] || '';
      this.filterType = p['type'] || '';
      this.searchQ = p['q'] || '';
    });
    this.loadVehicles();
  }

  loadVehicles(): void {
    this.api.getJSON<Vehicle[]>('/vehicles').subscribe({
      next: (v: any) => { this.allVehicles = Array.isArray(v) ? v : (v?.data ?? []); this.loading = false; this.applyFilters(); },
      error: () => { this.loading = false; this.toast.show('Failed to load vehicles', 'error'); }
    });
  }

  setStatus(s: string): void { this.filterStatus = s; this.applyFilters(); }
  setType(t: string): void { this.filterType = t; this.applyFilters(); }

  applyFilters(): void {
    const q = this.searchQ.toLowerCase();
    this.filtered = this.allVehicles.filter(v => {
      if (this.filterStatus && v.status !== this.filterStatus) return false;
      if (this.filterType && v.type !== this.filterType) return false;
      if (q && !`${v.license_plate} ${v.brand||''} ${v.model||''} ${v.driver_name||''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  joinVehicleInfo(v: Vehicle | null): string {
    if (!v) return '—';
    return [v.brand, v.model, v.year].filter(x => x != null && x !== '').join(' ') || '—';
  }

  getSvcPct(v: Vehicle): number {
    if (!v.next_service_km) return 0;
    return Math.min(100, Math.round(((v.mileage_km || 0) / v.next_service_km) * 100));
  }

  getSvcColor(v: Vehicle): string {
    const p = this.getSvcPct(v);
    return p >= 100 ? 'red' : p >= 80 ? 'orange' : 'green';
  }

  getAllowedTransitions(status: string): string[] {
    return VALID_TRANSITIONS[status] || [];
  }

  openDetail(v: Vehicle): void {
    this.selectedVehicle = v;
    this.modalMode = 'detail';
    this.modalTitle = v.license_plate;
    this.showModal = true;
  }

  openCreateModal(): void {
    this.form = { type: 'TRUCK' };
    this.modalMode = 'create';
    this.modalTitle = 'Add Vehicle';
    this.showModal = true;
  }

  openEditModal(v: Vehicle): void {
    this.selectedVehicle = v;
    this.form = { ...v };
    this.modalMode = 'edit';
    this.modalTitle = 'Edit ' + v.license_plate;
    this.showModal = true;
  }

  closeModal(): void { this.showModal = false; }

  saveVehicle(): void {
    if (!this.form.license_plate || !this.form.type) {
      this.toast.show('License plate and type are required', 'error'); return;
    }
    this.saving = true;
    const obs = this.modalMode === 'create'
      ? this.api.postJSON<Vehicle>('/vehicles', this.form)
      : this.api.patchJSON<Vehicle>(`/vehicles/${this.selectedVehicle?.id}`, this.form);

    obs.subscribe({
      next: () => {
        this.toast.show(this.modalMode === 'create' ? 'Vehicle created' : 'Vehicle updated');
        this.closeModal();
        this.loadVehicles();
      },
      error: (e) => { this.saving = false; this.toast.show(e?.error?.error?.message || 'Save failed', 'error'); },
      complete: () => { this.saving = false; }
    });
  }

  changeStatus(v: Vehicle, newStatus: string): void {
    this.api.patchJSON(`/vehicles/${v.id}`, { status: newStatus }).subscribe({
      next: () => { this.toast.show(`Status changed to ${newStatus}`); this.closeModal(); this.loadVehicles(); },
      error: () => this.toast.show('Failed to update status', 'error')
    });
  }
}
