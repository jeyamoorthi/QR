// ===== Type Definitions for QR Task Manager =====

import axios from 'axios';
import type { UserRole, Company } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Auto-attach Firebase ID token
client.interceptors.request.use(async (config) => {
  try {
    const { auth } = await import('../auth/AuthContext');
    const user = auth?.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (_) {}
  return config;
});

// Handle 401 with token refresh
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      try {
        const { auth } = await import('../auth/AuthContext');
        const user = auth?.currentUser;
        if (user) {
          const newToken = await user.getIdToken(true);
          error.config.headers.Authorization = `Bearer ${newToken}`;
          return axios(error.config);
        }
      } catch (_) {}
    }
    return Promise.reject(error);
  }
);

export default client;

// === API Functions ===

export const api = {
  // Companies
  getCompanies: (): Promise<{ companies: Company[]; total: number }> =>
    client.get('/companies').then((r) => r.data),

  // Dashboard
  getDashboard: (date?: string) =>
    client.get('/admin/dashboard', { params: { date } }).then((r) => r.data),

  getActivity: (days = 7, employeeId?: string, locationId?: string) =>
    client
      .get('/admin/activity', { params: { days, employee_id: employeeId, location_id: locationId } })
      .then((r) => r.data),

  getEmployeeStats: () =>
    client.get('/admin/employees').then((r) => r.data),

  getAvailableRoles: () =>
    client.get('/admin/roles').then((r) => r.data),

  // Locations
  getLocations: () =>
    client.get('/locations').then((r) => r.data),

  getLocation: (id: string) =>
    client.get(`/locations/${id}`).then((r) => r.data),

  getLocationTasks: (id: string) =>
    client.get(`/locations/${id}/tasks`).then((r) => r.data),

  createLocation: (data: { name: string; description?: string; address?: string }) =>
    client.post('/locations', data).then((r) => r.data),

  updateLocation: (id: string, data: Record<string, unknown>) =>
    client.put(`/locations/${id}`, data).then((r) => r.data),

  deleteLocation: (id: string) =>
    client.delete(`/locations/${id}`).then((r) => r.data),

  // Tasks
  getTasks: (locationId?: string) =>
    client.get('/tasks', { params: { location_id: locationId } }).then((r) => r.data),

  createTask: (data: {
    title: string;
    description?: string;
    locationId: string;
    priority?: string;
    frequencyType?: string;
    order?: number;
    estimatedMinutes?: number;
  }) => client.post('/tasks', data).then((r) => r.data),

  updateTask: (id: string, data: Record<string, unknown>) =>
    client.put(`/tasks/${id}`, data).then((r) => r.data),

  deleteTask: (id: string) =>
    client.delete(`/tasks/${id}`).then((r) => r.data),

  // Users & Approval
  registerUser: (data: Record<string, unknown>) =>
    client.post('/users/register', data).then((r) => r.data),

  checkUser: (email: string): Promise<{ exists: boolean; password_set: boolean; status?: string | null }> =>
    client.get('/users/check-user', { params: { email } }).then((r) => r.data),

  setPassword: (data: { email: string; newPassword: string }) =>
    client.post('/users/set-password', data).then((r) => r.data),

  getPendingApprovals: () =>
    client.get('/users/approval/pending').then((r) => r.data),

  approveEmployee: (userId: string) =>
    client.put(`/users/${userId}/approve`).then((r) => r.data),

  rejectEmployee: (userId: string) =>
    client.put(`/users/${userId}/reject`).then((r) => r.data),

  inviteEmployee: (email: string) =>
    client.post('/users/invite', { email }).then((r) => r.data),

  getUsers: (role?: string, activeOnly?: boolean) =>
    client.get('/users', { params: { role, active_only: activeOnly } }).then((r) => r.data),

  getUser: (id: string) =>
    client.get(`/users/${id}`).then((r) => r.data),

  createUser: (data: {
    email: string;
    displayName?: string;
    phone?: string;
    department?: string;
    role?: UserRole;
    assignedLocations?: string[];
  }) => client.post('/users', data).then((r) => r.data),

  updateUser: (id: string, data: Record<string, unknown>) =>
    client.put(`/users/${id}`, data).then((r) => r.data),

  updateUserRole: (userId: string, role: UserRole) =>
    client.put(`/users/${userId}/role`, { role }).then((r) => r.data),

  assignLocations: (userId: string, locationIds: string[]) =>
    client.put(`/users/${userId}/locations`, { locationIds }).then((r) => r.data),

  toggleUserStatus: (userId: string) =>
    client.put(`/users/${userId}/status`).then((r) => r.data),

  getCurrentUser: () =>
    client.get('/users/me').then((r) => r.data),

  // Employee Specific
  getEmployeeMyStats: () =>
    client.get('/employee/my-stats').then((r) => r.data),

  getEmployeeTaskHistory: (days = 7, locationId?: string, statusFilter?: string) =>
    client.get('/employee/task-history', { params: { days, location_id: locationId, status_filter: statusFilter } }).then((r) => r.data),

  getEmployeeLocationHistory: () =>
    client.get('/employee/location-history').then((r) => r.data),
};
