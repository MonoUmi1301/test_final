import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { MainLayoutComponent } from './shared/components/main-layout.component';
import { LoginComponent } from './features/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { VehiclesComponent } from './features/vehicles/vehicles.component';
import { DriversComponent } from './features/drivers/drivers.component';
import { TripsComponent } from './features/trips/trips.component';
import { MaintenanceComponent } from './features/maintenance/maintenance.component';
import { AuditComponent } from './features/audit/audit.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard',   component: DashboardComponent },
      { path: 'vehicles',    component: VehiclesComponent },
      { path: 'drivers',     component: DriversComponent },
      { path: 'trips',       component: TripsComponent },
      { path: 'maintenance', component: MaintenanceComponent },
      { path: 'audit',       component: AuditComponent },
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
