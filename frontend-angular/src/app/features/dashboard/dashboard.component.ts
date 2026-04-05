import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { FmtKmPipe, FmtDatetimePipe } from '../../shared/pipes/format.pipes';
import { DashboardMetrics, VehicleByStatus, TripTrend, Trip, Alert } from '../../core/models';

Chart.register(...registerables);

const STATUS_PALETTE: Record<string, string> = {
  ACTIVE: '#34C759', IDLE: '#98989D', MAINTENANCE: '#FF9500', RETIRED: '#FF3B30'
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FmtKmPipe, FmtDatetimePipe],
  template: `
    <div class="page-body fade-in">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
        <div>
          <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.5px;color:var(--apple-text-primary);">Dashboard</h1>
          <p style="font-size:13px;margin-top:2px;color:var(--apple-text-tertiary);">
            {{ lastUpdated ? 'Updated ' + (lastUpdated | fmtDatetime) : 'Loading…' }}
          </p>
        </div>
      </div>

      <!-- Metrics -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;">
        <ng-container *ngIf="!loading; else skeletonMetrics">
          <div class="metric-card" routerLink="/vehicles">
            <div class="metric-icon-wrap" style="background:rgba(0,113,227,0.1);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--apple-blue)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/>
                <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
            </div>
            <div class="metric-value">{{ metrics?.total_vehicles ?? 0 }}</div>
            <div class="metric-label">Total Vehicles</div>
          </div>

          <div class="metric-card" [routerLink]="['/trips']" [queryParams]="{status:'IN_PROGRESS'}">
            <div class="metric-icon-wrap" style="background:rgba(52,199,89,0.1);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--apple-green)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
              </svg>
            </div>
            <div class="metric-value">{{ metrics?.active_trips_today ?? 0 }}</div>
            <div class="metric-label">Active Trips Today</div>
          </div>

          <div class="metric-card" routerLink="/trips">
            <div class="metric-icon-wrap" style="background:rgba(175,82,222,0.1);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--apple-purple)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
              </svg>
            </div>
            <div class="metric-value">{{ metrics?.total_distance_today | fmtKm }}</div>
            <div class="metric-label">Distance Today</div>
          </div>

          <div class="metric-card" [routerLink]="['/maintenance']" [queryParams]="{status:'OVERDUE'}">
            <div class="metric-icon-wrap" style="background:rgba(255,59,48,0.1);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--apple-red)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
              </svg>
            </div>
            <div class="metric-value" [style.color]="(metrics?.maintenance_overdue ?? 0) > 0 ? 'var(--apple-red)' : ''">
              {{ metrics?.maintenance_overdue ?? 0 }}
            </div>
            <div class="metric-label">Overdue Maintenance</div>
          </div>
        </ng-container>

        <ng-template #skeletonMetrics>
          <div class="metric-card skeleton" style="height:110px;" *ngFor="let i of [1,2,3,4]"></div>
        </ng-template>
      </div>

      <!-- Charts row -->
      <div style="display:grid;grid-template-columns:280px 1fr;gap:14px;margin-bottom:20px;">
        <div class="chart-card">
          <div class="chart-title">Vehicles by Status</div>
          <div style="height:180px;display:flex;align-items:center;justify-content:center;">
            <canvas #donutCanvas></canvas>
          </div>
          <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px;">
            <div *ngFor="let d of byStatus; let i = index" style="display:flex;align-items:center;justify-content:space-between;font-size:12px;">
              <div style="display:flex;align-items:center;gap:7px;">
                <div style="width:7px;height:7px;border-radius:50%;flex-shrink:0;" [style.background]="statusColors[i]"></div>
                <span style="color:var(--apple-text-secondary);">{{ d.status }}</span>
              </div>
              <span style="font-weight:600;color:var(--apple-text-primary);">{{ d.count }}</span>
            </div>
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-title">Trip Distance — Last 7 Days</div>
          <div style="height:220px;">
            <canvas #lineCanvas></canvas>
          </div>
        </div>
      </div>

      <!-- Bottom row -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        <!-- Active trips -->
        <div class="card">
          <div class="card-header">
            <span class="section-label">Active Trips</span>
            <a [routerLink]="['/trips']" [queryParams]="{status:'IN_PROGRESS'}" style="font-size:12px;font-weight:500;color:var(--apple-blue);">View all</a>
          </div>
          <div style="padding:12px 0;">
            <ng-container *ngIf="!loading; else skeletonTrips">
              <div *ngIf="!activeTrips.length" class="empty-state">
                <p class="empty-state-text">No active trips</p>
              </div>
              <a *ngFor="let t of activeTrips.slice(0,5)" routerLink="/trips"
                style="display:flex;align-items:center;gap:12px;padding:10px 16px;transition:background var(--duration-fast);text-decoration:none;"
                onmouseover="this.style.background='var(--apple-surface-2)'" onmouseout="this.style.background='transparent'">
                <div style="width:32px;height:32px;border-radius:8px;background:var(--apple-blue-dim);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--apple-blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                  </svg>
                </div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:13px;font-weight:500;color:var(--apple-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    {{ t.license_plate }} — {{ t.driver_name || '—' }}
                  </div>
                  <div style="font-size:11px;color:var(--apple-text-tertiary);">{{ t.origin }} → {{ t.destination }}</div>
                </div>
                <div style="font-size:11px;color:var(--apple-text-tertiary);font-family:var(--font-mono);flex-shrink:0;">{{ t.distance_km | fmtKm }}</div>
              </a>
            </ng-container>
            <ng-template #skeletonTrips>
              <div class="skeleton" style="height:52px;border-radius:10px;margin:0 16px 8px;"></div>
              <div class="skeleton" style="height:52px;border-radius:10px;margin:0 16px;"></div>
            </ng-template>
          </div>
        </div>

        <!-- Alerts -->
        <div class="card">
          <div class="card-header">
            <span class="section-label">Alerts</span>
            <span *ngIf="alerts.length" style="font-size:11px;font-weight:600;color:var(--apple-red);background:var(--apple-red-dim);padding:2px 8px;border-radius:99px;">
              {{ alerts.length }}
            </span>
          </div>
          <div style="padding:12px 16px;">
            <ng-container *ngIf="!loading; else skeletonAlerts">
              <div *ngIf="!alerts.length" class="empty-state">
                <p class="empty-state-text">No active alerts 🎉</p>
              </div>
              <div *ngFor="let a of alerts.slice(0,5)" class="alert-item" style="margin-bottom:6px;"
                [class.alert-critical]="a.severity === 'CRITICAL'"
                [class.alert-warning]="a.severity === 'WARNING'">
                <div class="alert-dot" [class]="a.severity"></div>
                <div>
                  <div class="alert-msg">{{ a.message }}</div>
                  <div class="alert-meta">{{ a.severity }} · {{ a.affected_resource_type }}</div>
                </div>
              </div>
            </ng-container>
            <ng-template #skeletonAlerts>
              <div class="skeleton" style="height:48px;border-radius:10px;margin-bottom:8px;"></div>
              <div class="skeleton" style="height:48px;border-radius:10px;"></div>
            </ng-template>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('donutCanvas') donutCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('lineCanvas') lineCanvas!: ElementRef<HTMLCanvasElement>;

  metrics: DashboardMetrics | null = null;
  byStatus: VehicleByStatus[] = [];
  statusColors: string[] = [];
  activeTrips: Trip[] = [];
  alerts: Alert[] = [];
  lastUpdated: Date | null = null;
  loading = true;

  private donutChart: Chart | null = null;
  private lineChart: Chart | null = null;
  private refreshInterval: any;

  constructor(private api: ApiService, private toast: ToastService) {}

  ngOnInit(): void {
    this.loadDashboard();
    this.refreshInterval = setInterval(() => this.loadDashboard(), 60000);
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    clearInterval(this.refreshInterval);
    this.donutChart?.destroy();
    this.lineChart?.destroy();
  }

  loadDashboard(): void {
    forkJoin({
      metrics: this.api.getJSON<DashboardMetrics>('/dashboard/metrics'),
      byStatus: this.api.getJSON<VehicleByStatus[]>('/dashboard/vehicles-by-status'),
      trend: this.api.getJSON<TripTrend[]>('/dashboard/trip-distance-trend'),
      activeTrips: this.api.getJSON<Trip[]>('/dashboard/active-trips'),
      alerts: this.api.getJSON<Alert[]>('/alerts')
    }).subscribe({
      next: ({ metrics, byStatus, trend, activeTrips, alerts }) => {
        this.metrics = metrics;
        this.byStatus = byStatus;
        this.statusColors = byStatus.map(d => STATUS_PALETTE[d.status] || '#98989D');
        this.activeTrips = activeTrips;
        this.alerts = alerts;
        this.lastUpdated = new Date();
        this.loading = false;
        setTimeout(() => {
          this.renderDonut(byStatus);
          this.renderLine(trend);
        }, 50);
      },
      error: () => {
        this.loading = false;
        this.toast.show('Failed to load dashboard data', 'error');
      }
    });
  }

  private renderDonut(data: VehicleByStatus[]): void {
    if (!this.donutCanvas) return;
    this.donutChart?.destroy();
    this.donutChart = new Chart(this.donutCanvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.status),
        datasets: [{
          data: data.map(d => d.count),
          backgroundColor: this.statusColors,
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        cutout: '72%',
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}` } }
        }
      }
    });
  }

  private renderLine(data: TripTrend[]): void {
    if (!this.lineCanvas) return;
    this.lineChart?.destroy();
    this.lineChart = new Chart(this.lineCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: data.map(d => { const [, m, day] = d.date.split('-'); return `${day}/${m}`; }),
        datasets: [
          {
            label: 'Distance (km)',
            data: data.map(d => d.total_distance),
            backgroundColor: 'rgba(0,113,227,0.12)',
            borderColor: '#0071E3',
            borderWidth: 1.5,
            borderRadius: 5,
            type: 'bar'
          } as any,
          {
            label: 'Trips',
            data: data.map(d => d.trip_count),
            borderColor: '#34C759',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            tension: 0.4,
            type: 'line',
            yAxisID: 'y2',
            pointRadius: 3,
            pointBackgroundColor: '#34C759'
          } as any
        ]
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#AEAEB2', font: { size: 11 } } },
          y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#AEAEB2', font: { size: 11 } }, beginAtZero: true },
          y2: { position: 'right', grid: { display: false }, ticks: { color: '#AEAEB2', font: { size: 11 } }, beginAtZero: true }
        }
      }
    });
  }
}
