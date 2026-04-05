import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { FmtDatePipe, FmtDatetimePipe, FmtKmPipe, FmtRelativePipe } from '../../shared/pipes/format.pipes';
import { Trip, Vehicle, Driver, Checkpoint } from '../../core/models';

@Component({
  selector: 'app-trips',
  standalone: true,
  imports: [CommonModule, FormsModule, FmtDatePipe, FmtDatetimePipe, FmtKmPipe, FmtRelativePipe],
  template: `
    <!-- SVG sprite for vehicle icons -->
    <svg style="display:none" xmlns="http://www.w3.org/2000/svg">
      <symbol id="icon-truck" viewBox="0 0 20 14">
        <rect x="1" y="3" width="11" height="8" rx="1.2" fill="currentColor"/>
        <path d="M12 5.5l4.5 1.8V11H12V5.5z" fill="currentColor"/>
        <circle cx="4.5" cy="12.5" r="1.8" fill="currentColor"/>
        <circle cx="14" cy="12.5" r="1.8" fill="currentColor"/>
        <line x1="10" y1="4" x2="10" y2="11" stroke="white" stroke-width="0.7" opacity="0.4"/>
      </symbol>
      <symbol id="icon-van" viewBox="0 0 20 14">
        <rect x="1" y="3" width="14" height="8" rx="1.5" fill="currentColor"/>
        <rect x="2" y="4" width="5.5" height="4" rx="0.8" fill="white" opacity="0.35"/>
        <rect x="8.5" y="4" width="5.5" height="4" rx="0.8" fill="white" opacity="0.35"/>
        <path d="M15 7.5h3l1 3H15V7.5z" fill="currentColor"/>
        <circle cx="4.5" cy="12.5" r="1.8" fill="currentColor"/>
        <circle cx="13" cy="12.5" r="1.8" fill="currentColor"/>
      </symbol>
      <symbol id="icon-motorcycle" viewBox="0 0 20 14">
        <circle cx="4" cy="10" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/>
        <circle cx="16" cy="10" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/>
        <path d="M4 10L7.5 5.5h4.5l2.5-2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
        <path d="M7.5 5.5l3.5 4.5H16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
        <circle cx="10" cy="3" r="1.2" fill="currentColor"/>
      </symbol>
      <symbol id="icon-pickup" viewBox="0 0 20 16">
        <rect x="1" y="5" width="14" height="9" rx="1" fill="currentColor"/>
        <path d="M1 9h14" stroke="white" stroke-width="0.8" opacity="0.3"/>
        <path d="M5 5V3.2C5 2.5 5.7 2 6.5 2h3C10.3 2 11 2.5 11 3.2V5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        <line x1="5.5" y1="11" x2="9.5" y2="11" stroke="white" stroke-width="0.9" opacity="0.35"/>
        <line x1="7.5" y1="9.5" x2="7.5" y2="12.5" stroke="white" stroke-width="0.9" opacity="0.35"/>
      </symbol>
    </svg>

    <div class="page-body fade-in">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div>
          <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.5px;color:var(--apple-text-primary);">Trips</h1>
          <p style="font-size:13px;margin-top:2px;color:var(--apple-text-tertiary);">{{ allTrips.length }} trips total</p>
        </div>
        <button class="btn btn-primary" (click)="openCreateWizard()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Trip
        </button>
      </div>

      <!-- Status filter chips -->
      <div class="chip-group" style="margin-bottom:16px;background:var(--apple-surface-2);border:1px solid var(--apple-border);border-radius:99px;padding:3px;display:inline-flex;">
        <button class="chip" [class.active]="filterStatus === s.val" *ngFor="let s of statusOptions" (click)="filterTrips(s.val)">
          {{ s.label }}
        </button>
      </div>

      <!-- Trip cards grid -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
        <div *ngIf="loading" class="empty-state" style="grid-column:1/-1;">
          <p class="empty-state-text">Loading trips…</p>
        </div>
        <div *ngIf="!loading && !filtered.length" class="empty-state" style="grid-column:1/-1;">
          <div style="font-size:32px;margin-bottom:8px;opacity:0.3;">🗺️</div>
          <p class="empty-state-text">No trips found</p>
        </div>

        <div *ngFor="let t of filtered" class="entity-card" (click)="openDetail(t)">
          <!-- Badge + Distance -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
            <span class="badge" [class]="'status-'+t.status">{{ formatStatus(t.status) }}</span>
            <span class="mono-sm" style="color:var(--apple-text-tertiary);">{{ t.distance_km | fmtKm }}</span>
          </div>

          <!-- Origin → Destination -->
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
            <span style="font-size:13px;font-weight:600;color:var(--apple-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">{{ t.origin }}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--apple-text-tertiary)" stroke-width="2.5">
              <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
            </svg>
            <span style="font-size:13px;font-weight:600;color:var(--apple-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;text-align:right;">{{ t.destination }}</span>
          </div>

          <!-- Progress track (innerHTML for SVG use/href support) -->
          <div [innerHTML]="getProgressHtml(t)"></div>

          <!-- Meta -->
          <div style="font-size:11px;color:var(--apple-text-tertiary);">{{ t.license_plate || '—' }} · {{ t.driver_name || '—' }}</div>
          <div style="font-size:11px;color:var(--apple-text-tertiary);margin-top:2px;">
            <ng-container *ngIf="t.status === 'IN_PROGRESS'">Started {{ t.started_at | fmtRelative }}</ng-container>
            <ng-container *ngIf="t.status !== 'IN_PROGRESS'">{{ (t.started_at || t.scheduled_at || null) | fmtDate }}</ng-container>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Create Wizard Modal ── -->
    <div *ngIf="showCreateModal" class="modal-overlay" (click)="closeCreateModal()">
      <div class="modal modal-lg" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2 class="modal-title">New Trip</h2>
          <button class="modal-close" (click)="closeCreateModal()">×</button>
        </div>

        <!-- Step indicator -->
        <div style="padding:16px 20px 0;">
          <div class="steps-nav">
            <div class="step-dot" [class.active]="wizardStep===1" [class.done]="wizardStep>1">{{ wizardStep > 1 ? '✓' : '1' }}</div>
            <div class="step-connector" [class.done]="wizardStep>1"></div>
            <div class="step-dot" [class.active]="wizardStep===2" [class.done]="wizardStep>2" [class.pending]="wizardStep<2">{{ wizardStep > 2 ? '✓' : '2' }}</div>
            <div class="step-connector" [class.done]="wizardStep>2"></div>
            <div class="step-dot" [class.active]="wizardStep===3" [class.pending]="wizardStep<3">3</div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;padding:0 2px;">
            <span style="font-size:10px;" [style.color]="wizardStep===1?'var(--apple-blue)':wizardStep>1?'var(--apple-green)':'var(--apple-text-tertiary)'" [style.fontWeight]="wizardStep===1?'600':'400'">Vehicle &amp; Driver</span>
            <span style="font-size:10px;" [style.color]="wizardStep===2?'var(--apple-blue)':wizardStep>2?'var(--apple-green)':'var(--apple-text-tertiary)'" [style.fontWeight]="wizardStep===2?'600':'400'">Route &amp; Cargo</span>
            <span style="font-size:10px;" [style.color]="wizardStep===3?'var(--apple-blue)':'var(--apple-text-tertiary)'" [style.fontWeight]="wizardStep===3?'600':'400'">Checkpoints</span>
          </div>
        </div>

        <div class="modal-body">
          <!-- Step 1: Vehicle & Driver -->
          <ng-container *ngIf="wizardStep === 1">
            <div class="form-group">
              <label class="form-label">Vehicle *</label>
              <select class="form-input form-select" [(ngModel)]="tripForm.vehicle_id">
                <option value="">Select vehicle…</option>
                <option *ngFor="let v of availableVehicles" [value]="v.id">
                  {{ v.license_plate }} — {{ v.type }} {{ v.brand || '' }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Driver *</label>
              <select class="form-input form-select" [(ngModel)]="tripForm.driver_id">
                <option value="">Select driver…</option>
                <option *ngFor="let d of availableDrivers" [value]="d.id">{{ d.name }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Scheduled Date</label>
              <input class="form-input" type="datetime-local" [(ngModel)]="tripForm.scheduled_at"/>
            </div>
          </ng-container>

          <!-- Step 2: Route & Cargo -->
          <ng-container *ngIf="wizardStep === 2">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group">
                <label class="form-label">Origin *</label>
                <input class="form-input" [(ngModel)]="tripForm.origin" placeholder="กรุงเทพฯ"/>
              </div>
              <div class="form-group">
                <label class="form-label">Destination *</label>
                <input class="form-input" [(ngModel)]="tripForm.destination" placeholder="เชียงใหม่"/>
              </div>
              <div class="form-group">
                <label class="form-label">Distance (km)</label>
                <input class="form-input" type="number" [(ngModel)]="tripForm.distance_km"/>
              </div>
              <div class="form-group">
                <label class="form-label">Cargo Weight (kg)</label>
                <input class="form-input" type="number" [(ngModel)]="tripForm.cargo_weight_kg"/>
              </div>
              <div class="form-group" style="grid-column:1/-1;">
                <label class="form-label">Cargo Description</label>
                <input class="form-input" [(ngModel)]="tripForm.cargo_description" placeholder="สินค้าทั่วไป…"/>
              </div>
              <div class="form-group" style="grid-column:1/-1;">
                <label class="form-label">Notes</label>
                <input class="form-input" [(ngModel)]="tripForm.notes" placeholder="หมายเหตุ…"/>
              </div>
            </div>
          </ng-container>

          <!-- Step 3: Checkpoints -->
          <ng-container *ngIf="wizardStep === 3">
            <p style="font-size:13px;color:var(--apple-text-secondary);margin-bottom:12px;">เพิ่ม checkpoints ระหว่างทาง (ไม่บังคับ)</p>
            <div *ngFor="let cp of checkpoints; let i = index" style="background:var(--apple-surface-2);border:1px solid var(--apple-border);border-radius:var(--radius-md);padding:12px;margin-bottom:8px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <span style="font-size:11px;font-weight:600;color:var(--apple-text-tertiary);text-transform:uppercase;letter-spacing:0.5px;">Stop {{ i+1 }}</span>
                <button style="background:none;border:none;color:var(--apple-text-tertiary);cursor:pointer;font-size:18px;line-height:1;padding:0;" (click)="checkpoints.splice(i,1)">×</button>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <input class="form-input" placeholder="Location name" [(ngModel)]="checkpoints[i].location" style="font-size:13px;"/>
                <input class="form-input" placeholder="Purpose (e.g. FUEL, REST)" [(ngModel)]="checkpoints[i].purpose" style="font-size:13px;"/>
              </div>
            </div>
            <button
              style="width:100%;padding:10px;border:1.5px dashed var(--apple-border-strong);border-radius:var(--radius-sm);font-size:13px;color:var(--apple-text-tertiary);background:transparent;cursor:pointer;transition:all var(--duration-fast);"
              (mouseover)="$any($event.target).style.borderColor='var(--apple-blue)';$any($event.target).style.color='var(--apple-blue)'"
              (mouseout)="$any($event.target).style.borderColor='var(--apple-border-strong)';$any($event.target).style.color='var(--apple-text-tertiary)'"
              (click)="addCheckpoint()">
              + Add Checkpoint
            </button>
          </ng-container>
        </div>

        <div class="modal-footer">
          <button class="btn btn-ghost" *ngIf="wizardStep > 1" (click)="wizardStep = wizardStep - 1">← Back</button>
          <button class="btn btn-ghost" *ngIf="wizardStep === 1" (click)="closeCreateModal()">Cancel</button>
          <button class="btn btn-primary" *ngIf="wizardStep < 3" (click)="wizardNext()">Next →</button>
          <button class="btn btn-primary" *ngIf="wizardStep === 3" [disabled]="saving" (click)="createTrip()">
            {{ saving ? 'Creating…' : 'Create Trip' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Trip Detail Modal ── -->
    <div *ngIf="showDetailModal && selectedTrip" class="modal-overlay" (click)="showDetailModal=false">
      <div class="modal modal-lg" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2 class="modal-title">{{ selectedTrip.origin }} → {{ selectedTrip.destination }}</h2>
          <button class="modal-close" (click)="showDetailModal=false">×</button>
        </div>
        <div class="modal-body">
          <!-- Info grid -->
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:4px;">
            <div>
              <div class="section-label" style="margin-bottom:4px;">Status</div>
              <span class="badge" [class]="'status-'+selectedTrip.status">{{ formatStatus(selectedTrip.status) }}</span>
            </div>
            <div>
              <div class="section-label" style="margin-bottom:4px;">Vehicle</div>
              <span style="font-family:var(--font-mono);font-size:13px;font-weight:500;color:var(--apple-text-primary);">{{ selectedTrip.license_plate || '—' }}</span>
            </div>
            <div>
              <div class="section-label" style="margin-bottom:4px;">Driver</div>
              <span style="font-size:13px;font-weight:500;color:var(--apple-text-primary);">{{ selectedTrip.driver_name || '—' }}</span>
            </div>
            <div>
              <div class="section-label" style="margin-bottom:4px;">Distance</div>
              <span style="font-size:13px;font-weight:500;color:var(--apple-text-primary);">{{ selectedTrip.distance_km | fmtKm }}</span>
            </div>
            <div>
              <div class="section-label" style="margin-bottom:4px;">Cargo</div>
              <span style="font-size:13px;font-weight:500;color:var(--apple-text-primary);">{{ selectedTrip.cargo_description || '—' }}</span>
            </div>
            <div>
              <div class="section-label" style="margin-bottom:4px;">Started</div>
              <span style="font-size:13px;font-weight:500;color:var(--apple-text-primary);">{{ (selectedTrip.started_at || null) | fmtDatetime }}</span>
            </div>
          </div>

          <!-- Overall Progress -->
          <div>
            <div class="section-label" style="margin-bottom:8px;">Overall Progress</div>
            <div [innerHTML]="getProgressHtml(selectedTrip)"></div>
          </div>

          <!-- Checkpoints -->
          <ng-container *ngIf="selectedTrip.checkpoints?.length">
            <div class="divider"></div>
            <div class="section-label" style="margin-bottom:12px;">Checkpoints</div>
            <div class="cp-track">
              <div *ngFor="let cp of selectedTrip.checkpoints" class="cp-item">
                <div class="cp-dot" [class]="cp.status">
                  <ng-container [ngSwitch]="cp.status">
                    <svg *ngSwitchCase="'ARRIVED'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--apple-orange)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <svg *ngSwitchCase="'DEPARTED'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--apple-green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    <svg *ngSwitchCase="'REACHED'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--apple-green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <svg *ngSwitchCase="'SKIPPED'" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--apple-orange)" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    <svg *ngSwitchDefault width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--apple-text-tertiary)" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>
                  </ng-container>
                </div>
                <div class="cp-body">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;flex-wrap:wrap;">
                    <span class="cp-name">{{ cp.location }}</span>
                    <span class="badge" [class]="'status-'+cp.status">{{ cp.status }}</span>
                    <span *ngIf="cp.notes" class="badge badge-neutral">{{ cp.notes }}</span>
                  </div>
                  <div class="cp-meta" *ngIf="cp.reached_at">
                    Reached {{ fmtDt(cp.reached_at) }}
                  </div>
                  <div style="margin-top:8px;" *ngIf="canUpdateCp(cp)">
                    <button class="btn btn-ghost btn-sm"
                      [disabled]="updatingCp === cp.id"
                      (click)="updateCheckpoint(cp, $event)">
                      {{ updatingCp === cp.id ? 'Updating…' : 'Mark ' + getNextCpStatus(cp.status) }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </ng-container>

          <!-- Trip actions -->
          <ng-container *ngIf="canUpdateTrip(selectedTrip.status)">
            <div class="divider"></div>
            <div style="display:flex;gap:8px;">
              <button *ngIf="selectedTrip.status === 'SCHEDULED'" class="btn btn-primary btn-sm" (click)="startTrip(selectedTrip)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Start Trip
              </button>
              <button *ngIf="selectedTrip.status === 'IN_PROGRESS'" class="btn btn-success btn-sm" (click)="completeTrip(selectedTrip)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Complete Trip
              </button>
              <button class="btn btn-danger btn-sm" (click)="cancelTrip(selectedTrip)">Cancel</button>
            </div>
          </ng-container>
        </div>
      </div>
    </div>
  `
})
export class TripsComponent implements OnInit {
  allTrips: Trip[] = [];
  filtered: Trip[] = [];
  loading = true;

  filterStatus = '';
  statusOptions = [
    { val: '', label: 'All' },
    { val: 'SCHEDULED', label: 'Scheduled' },
    { val: 'IN_PROGRESS', label: 'In Progress' },
    { val: 'COMPLETED', label: 'Completed' },
    { val: 'CANCELLED', label: 'Cancelled' },
  ];

  showCreateModal = false;
  showDetailModal = false;
  selectedTrip: Trip | null = null;
  wizardStep = 1;
  saving = false;
  updatingCp: string | null = null;

  tripForm: Partial<Trip & { cargo_weight_kg?: number }> = {};
  checkpoints: { location: string; purpose: string }[] = [];
  availableVehicles: Vehicle[] = [];
  availableDrivers: Driver[] = [];

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private auth: AuthService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(p => {
      this.filterStatus = p['status'] || '';
      this.applyFilter();
    });
    this.loadTrips();
  }

  loadTrips(): void {
    this.api.getJSON<any>('/trips').subscribe({
      next: (res: any) => {
        // API อาจ return array ตรงๆ หรือ paginated { data: [], meta: {} }
        this.allTrips = Array.isArray(res) ? res : (res?.data ?? []);
        this.loading = false;
        this.applyFilter();
      },
      error: () => { this.loading = false; this.toast.show('Failed to load trips', 'error'); }
    });
  }

  filterTrips(s: string): void { this.filterStatus = s; this.applyFilter(); }

  applyFilter(): void {
    this.filtered = this.filterStatus
      ? this.allTrips.filter(t => t.status === this.filterStatus)
      : this.allTrips;
  }

  formatStatus(s: string): string {
    return s.replace(/_/g, ' ');
  }

  fmtDt(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleString('th-TH', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  // Progress track as innerHTML (needed for SVG <use> href to work)
  getProgressHtml(t: Trip): string {
    const iconMap: Record<string, { w: number; h: number; vb: string; id: string }> = {
      TRUCK:      { w: 22, h: 16, vb: '0 0 20 14', id: 'icon-truck' },
      VAN:        { w: 22, h: 16, vb: '0 0 20 14', id: 'icon-van' },
      MOTORCYCLE: { w: 22, h: 16, vb: '0 0 20 14', id: 'icon-motorcycle' },
      PICKUP:     { w: 19, h: 19, vb: '0 0 20 16', id: 'icon-pickup' },
    };
    const vehicleType = (t as any).vehicle_type || 'TRUCK';
    const icon = iconMap[vehicleType] || iconMap['TRUCK'];

    if (t.status === 'CANCELLED') {
      return `
        <div class="trip-track-mini trk-cancelled">
          <div class="trip-bar-mini bar-cancelled"></div>
          <div class="trip-milestones">
            <div class="t-dot-mini"></div>
            <div class="t-dot-mini"></div>
            <div class="t-dot-mini"></div>
          </div>
        </div>
        <div class="track-labels">
          <span>เริ่มต้น</span>
          <span style="color:var(--apple-red)">ยกเลิก</span>
          <span>ถึงแล้ว</span>
        </div>`;
    }

    const cfg: Record<string, { trk: string; bar: string; color: string; left: string; dots: string[] }> = {
      SCHEDULED:   { trk: 'trk-scheduled',  bar: 'bar-scheduled',  color: '#378ADD', left: '2%',  dots: ['current', '', ''] },
      IN_PROGRESS: { trk: 'trk-inprogress', bar: 'bar-inprogress', color: '#EF9F27', left: '50%', dots: ['passed-i', 'current', ''] },
      COMPLETED:   { trk: 'trk-completed',  bar: 'bar-completed',  color: '#639922', left: '98%', dots: ['passed-c', 'passed-c', 'passed-c'] },
    };
    const c = cfg[t.status] || cfg['SCHEDULED'];
    const dots = c.dots.map(d =>
      `<div class="t-dot-mini ${d}" ${d === 'current' ? `style="border-color:${c.color}"` : ''}></div>`
    ).join('');

    return `
      <div class="trip-track-mini ${c.trk}">
        <div class="trip-bar-mini ${c.bar}"></div>
        <div class="trip-milestones">${dots}</div>
        <div class="vehicle-marker" style="left:${c.left}">
          <svg width="${icon.w}" height="${icon.h}" viewBox="${icon.vb}" xmlns="http://www.w3.org/2000/svg" style="color:${c.color}">
            <use href="#${icon.id}"/>
          </svg>
        </div>
      </div>
      <div class="track-labels">
        <span>เริ่มต้น</span><span>กำลังเดินทาง</span><span>ถึงแล้ว</span>
      </div>`;
  }

  // Checkpoint helpers
  canUpdateCp(cp: Checkpoint): boolean {
    return this.selectedTrip?.status === 'IN_PROGRESS' &&
      !['DEPARTED', 'SKIPPED', 'REACHED'].includes(cp.status);
  }

  getNextCpStatus(status: string): string {
    if (status === 'PENDING') return 'ARRIVED';
    if (status === 'ARRIVED') return 'DEPARTED';
    return '';
  }

  canUpdateTrip(status: string): boolean {
    return ['SCHEDULED', 'IN_PROGRESS'].includes(status);
  }

  updateCheckpoint(cp: Checkpoint, event: Event): void {
    event.stopPropagation();
    const newStatus = this.getNextCpStatus(cp.status);
    if (!newStatus || !this.selectedTrip) return;
    this.updatingCp = cp.id;
    this.api.patchJSON(`/checkpoints/${cp.id}/status`, { status: newStatus }).subscribe({
      next: () => {
        this.toast.show(`Checkpoint marked as ${newStatus}`);
        this.updatingCp = null;
        this.api.getJSON<Trip>(`/trips/${this.selectedTrip!.id}`).subscribe({
          next: trip => { this.selectedTrip = trip; }
        });
      },
      error: () => { this.updatingCp = null; this.toast.show('Failed to update checkpoint', 'error'); }
    });
  }

  // Trip actions
  openDetail(t: Trip): void {
    this.selectedTrip = { ...t };
    this.showDetailModal = true;
    this.api.getJSON<Trip>(`/trips/${t.id}`).subscribe({
      next: trip => { this.selectedTrip = trip; },
      error: () => {}
    });
  }

  startTrip(t: Trip): void {
    this.api.patchJSON(`/trips/${t.id}/start`, {}).subscribe({
      next: () => { this.toast.show('Trip started'); this.showDetailModal = false; this.loadTrips(); },
      error: () => this.toast.show('Failed to start trip', 'error')
    });
  }

  completeTrip(t: Trip): void {
    if (!confirm('Mark this trip as completed?')) return;
    this.api.patchJSON(`/trips/${t.id}/complete`, {}).subscribe({
      next: () => { this.toast.show('Trip completed'); this.showDetailModal = false; this.loadTrips(); },
      error: () => this.toast.show('Failed to complete trip', 'error')
    });
  }

  cancelTrip(t: Trip): void {
    if (!confirm('Cancel this trip?')) return;
    this.api.patchJSON(`/trips/${t.id}/cancel`, {}).subscribe({
      next: () => { this.toast.show('Trip cancelled'); this.showDetailModal = false; this.loadTrips(); },
      error: () => this.toast.show('Failed to cancel trip', 'error')
    });
  }

  // Wizard
  openCreateWizard(): void {
    this.wizardStep = 1;
    this.tripForm = {};
    this.checkpoints = [];
    forkJoin({
      vehicles: this.api.getJSON<Vehicle[]>('/vehicles'),
      drivers: this.api.getJSON<Driver[]>('/drivers')
    }).subscribe({
      next: ({ vehicles, drivers }) => {
        const vList: Vehicle[] = Array.isArray(vehicles) ? vehicles : (vehicles as any)?.data ?? [];
        const dList: Driver[]  = Array.isArray(drivers)  ? drivers  : (drivers  as any)?.data ?? [];
        this.availableVehicles = vList.filter(v => ['IDLE', 'ACTIVE'].includes(v.status));
        this.availableDrivers  = dList.filter(d =>
          d.status === 'ACTIVE' && new Date(d.license_expires_at) > new Date()
        );
        this.showCreateModal = true;
      },
      error: () => this.toast.show('Failed to load data', 'error')
    });
  }

  closeCreateModal(): void { this.showCreateModal = false; }

  addCheckpoint(): void { this.checkpoints.push({ location: '', purpose: '' }); }

  wizardNext(): void {
    if (this.wizardStep === 1 && !this.tripForm.vehicle_id) {
      this.toast.show('Please select a vehicle', 'error'); return;
    }
    if (this.wizardStep === 1 && !this.tripForm.driver_id) {
      this.toast.show('Please select a driver', 'error'); return;
    }
    if (this.wizardStep === 2 && (!this.tripForm.origin || !this.tripForm.destination)) {
      this.toast.show('Origin and destination are required', 'error'); return;
    }
    this.wizardStep++;
  }

  createTrip(): void {
    this.saving = true;
    const payload = {
      ...this.tripForm,
      checkpoints: this.checkpoints
        .filter(c => c.location.trim())
        .map((cp, i) => ({ location: cp.location, purpose: cp.purpose, sequence: i + 1 }))
    };
    this.api.postJSON('/trips', payload).subscribe({
      next: () => { this.toast.show('Trip created successfully'); this.closeCreateModal(); this.loadTrips(); this.saving = false; },
      error: (e) => { this.saving = false; this.toast.show(e?.error?.error?.message || 'Failed to create trip', 'error'); }
    });
  }
}
