// ===== Type Definitions for QR Task Manager =====

// --- Companies ---
export interface Company {
  id: string;
  name: string;
  createdBy?: string;
  createdAt?: string;
  logoUrl?: string;
}

// --- Roles ---
export type UserRole = 'super_admin' | 'admin' | 'supervisor' | 'employee';
export type UserStatus = 'pending' | 'active' | 'approved' | 'rejected' | 'disabled';

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  supervisor: 'Supervisor',
  employee: 'Employee',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: '#8b5cf6',
  admin: '#3b82f6',
  supervisor: '#f59e0b',
  employee: '#10b981',
};

export const STATUS_LABELS: Record<UserStatus, string> = {
  pending: 'Pending Approval',
  active: 'Active',
  approved: 'Approved',
  rejected: 'Rejected',
  disabled: 'Disabled',
};

export const STATUS_COLORS: Record<UserStatus, string> = {
  pending: '#f59e0b', // Amber
  active: '#10b981', // Emerald
  approved: '#10b981', // Emerald
  rejected: '#ef4444', // Red
  disabled: '#64748b', // Slate
};

export const ROLE_HIERARCHY: UserRole[] = ['employee', 'supervisor', 'admin', 'super_admin'];

export function roleLevel(role: UserRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}

export function canManageRole(managerRole: UserRole, targetRole: UserRole): boolean {
  return roleLevel(managerRole) > roleLevel(targetRole);
}

export function getAssignableRoles(callerRole: UserRole): UserRole[] {
  return ROLE_HIERARCHY.filter((r) => roleLevel(r) < roleLevel(callerRole));
}

// --- Dashboard ---
export interface DashboardSummary {
  totalTasks: number;
  completedToday: number;
  skippedToday: number;
  issuesReported: number;
  completionRate: number;
  activeEmployees: number;
}

export interface LocationStat {
  locationId: string;
  locationName: string;
  totalTasks: number;
  completed: number;
  pending: number;
  issues: number;
}

export interface RecentActivity {
  employeeName: string;
  employeeId: string;
  locationId: string;
  locationName: string;
  tasksCompleted: number;
  completedAt: string;
}

export interface DashboardData {
  date: string;
  callerRole: string;
  summary: DashboardSummary;
  locationStats: LocationStat[];
  recentActivity: RecentActivity[];
}

// --- Users ---
export interface AppUser {
  id: string;
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  status: UserStatus;
  password_set?: boolean;
  companyId?: string;
  companyName?: string;
  phone?: string;
  department?: string;
  isActive: boolean;
  assignedLocations: string[];
  createdAt: string;
  updatedAt: string;
}

// --- Locations ---
export interface Location {
  id: string;
  name: string;
  description?: string;
  qrCodeValue: string;
  address?: string;
  isActive: boolean;
  companyId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  taskCount?: number;
}

// --- Tasks ---
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type Frequency = 'daily' | 'weekly' | 'one_time';

export interface Task {
  id: string;
  title: string;
  description?: string;
  locationId: string;
  companyId?: string;
  priority: Priority;
  frequencyType: Frequency;
  isActive: boolean;
  order: number;
  estimatedMinutes?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// --- Task Logs ---
export interface TaskLog {
  id: string;
  taskId: string;
  locationId: string;
  companyId?: string;
  completedBy: string;
  completedByName: string;
  status: 'completed' | 'skipped' | 'issue_reported';
  notes?: string;
  photoUrl?: string;
  completedAt: string;
  submittedAt: string;
  sessionId: string;
}
