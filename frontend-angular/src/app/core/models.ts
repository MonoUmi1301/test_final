export interface User {
  id: string;
  username: string;
  role: 'ADMIN' | 'DISPATCHER' | 'VIEWER';
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface Vehicle {
  id: string;
  license_plate: string;
  brand?: string;
  model?: string;
  year?: number;
  type: 'TRUCK' | 'VAN' | 'MOTORCYCLE' | 'PICKUP';
  status: 'ACTIVE' | 'IDLE' | 'MAINTENANCE' | 'RETIRED';
  mileage_km?: number;
  next_service_km?: number;
  driver_name?: string;
  driver_id?: string;
  fuel_type?: string;
  capacity_kg?: number;
}

export interface Driver {
  id: string;
  name: string;
  license_number: string;
  license_expires_at: string;
  phone: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export interface Trip {
  id: string;
  vehicle_id: string;
  driver_id?: string;
  license_plate?: string;
  driver_name?: string;
  origin: string;
  destination: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  distance_km?: number;
  started_at?: string;
  completed_at?: string;
  scheduled_at?: string;
  cargo_description?: string;
  cargo_weight_kg?: number;
  notes?: string;
  checkpoints?: Checkpoint[];
}

export interface Checkpoint {
  id: string;
  trip_id: string;
  location: string;
  sequence: number;
  status: 'PENDING' | 'REACHED' | 'SKIPPED';
  reached_at?: string;
  notes?: string;
}

export interface Maintenance {
  id: string;
  vehicle_id: string;
  license_plate?: string;
  type: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
  scheduled_at: string;
  completed_at?: string;
  technician?: string;
  cost_thb?: number;
  description?: string;
  notes?: string;
}

export interface Alert {
  id: string;
  severity: 'CRITICAL' | 'WARNING';
  message: string;
  affected_resource_type: string;
  affected_resource_id: string;
  is_active: boolean;
  created_at: string;
}

export interface DashboardMetrics {
  total_vehicles: number;
  active_trips_today: number;
  total_distance_today: number;
  maintenance_overdue: number;
}

export interface VehicleByStatus {
  status: string;
  count: number;
}

export interface TripTrend {
  date: string;
  total_distance: number;
  trip_count: number;
}

export interface AuditLog {
  id: string;
  user_id: string;
  username?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: any;
  success: boolean;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: any;
}
