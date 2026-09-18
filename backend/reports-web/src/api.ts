// This app is served by the same Express backend as the API (see
// backend/src/server.ts, mounted at /reports), so every call below is a
// plain same-origin relative fetch — no base URL, no CORS config needed.
const API_BASE = '/api';

export type LoginResponse = {
  success: boolean;
  message?: string;
  user?: { id: number; username: string; name: string; role: string; phone?: string };
};

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Request failed.');
  }
  return data as T;
};

const qs = (params: Record<string, any>) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
};

export const authApi = {
  login: (username: string, password: string) =>
    request<LoginResponse>('/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
};

export const accountsApi = {
  getTotalSummary: () => request<any>('/accounts/total-summary'),
  getDayBook: (from?: string, to?: string) => request<any[]>(`/accounts/daybook${qs({ from, to })}`),
  getLedger: (from?: string, to?: string) => request<any[]>(`/accounts/ledger${qs({ from, to })}`),
  getPeriods: () => request<{ months: string[]; years: string[] }>('/accounts/periods'),
  getReport: (type: 'monthly' | 'yearly', period: string) => request<any>(`/accounts/report${qs({ type, period })}`),
  getIoReport: (role: string, from?: string, to?: string, userId?: string | number | null) =>
    request<any>(`/accounts/io-report${qs({ role, from, to, userId })}`),
};

export const adminApi = {
  getAnalytics: () => request<any>('/analytics/dashboard'),
  getAttendanceOverview: (date?: string) => request<any>(`/attendance/overview${qs({ date })}`),
  getSites: () => request<any[]>('/sites'),
  createSite: (data: { name: string; location?: string }) =>
    request<{ success: boolean; message?: string }>('/sites', { method: 'POST', body: JSON.stringify(data) }),
  updateSite: (id: string | number, data: { name: string; location?: string }) =>
    request<{ success: boolean; message?: string }>(`/sites/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSite: (id: string | number) =>
    request<{ success: boolean; message?: string }>(`/sites/${id}`, { method: 'DELETE' }),
  getStaff: () => request<any[]>('/staff'),
  deleteStaff: (id: string | number) =>
    request<{ success: boolean; message?: string }>(`/staff/${id}`, { method: 'DELETE' }),
  getLeads: () => request<any[]>('/leads'),
  getAllDailySheets: (params?: string | { date?: string; from?: string; to?: string }) => {
    const q = typeof params === 'string' ? { date: params } : params;
    return request<any[]>(`/daily-sheets${qs(q || {})}`);
  },
};

export const fieldApi = {
  getLedgerBySite: (siteId: string | number, date?: string, from?: string, to?: string) =>
    request<any[]>(`/expenses/site/${siteId}${qs({ date, from, to })}`),
  updateExpense: (id: string | number, expense: Record<string, any>) =>
    request<{ success: boolean; message?: string }>(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(expense) }),
  deleteExpense: (id: string | number) =>
    request<{ success: boolean; message?: string }>(`/expenses/${id}`, { method: 'DELETE' }),
  getDriverRecords: (from?: string, to?: string) => request<any[]>(`/driver-records${qs({ from, to })}`),
  getDriverBills: (from?: string, to?: string) => request<any[]>(`/driver-bills${qs({ from, to })}`),
};
