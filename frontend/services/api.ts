import Constants from 'expo-constants';
import { Platform, NativeModules } from 'react-native';

const IS_PRODUCTION = !__DEV__;

const PRODUCTION_BACKEND_URL = process.env.EXPO_PUBLIC_PRODUCTION_API_URL || 'https://apkayyanar.nexoraapp.in';

const getDevelopmentBackendUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (Platform.OS === 'web') {
    return 'http://localhost:5000';
  }

  // Try to dynamically extract host from the Metro bundler URL
  const scriptURL = NativeModules.SourceCode?.scriptURL;
  if (scriptURL) {
    const match = scriptURL.match(/^https?:\/\/([^:/]+)(:\d+)?/);
    const host = match ? match[1] : null;
    if (host) {
      return `http://${host}:5000`;
    }
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    Constants.manifest?.debuggerHost;

  const host = hostUri?.split(':')[0];

  return host ? `http://${host}:5000` : 'http://localhost:5000';
};

export const IMAGE_BASE_URL = IS_PRODUCTION
  ? PRODUCTION_BACKEND_URL
  : getDevelopmentBackendUrl();

const API_BASE_URL = `${IMAGE_BASE_URL}/api`;

// Logged once at startup so you always know which backend the app is talking to.
// Labeled by the actual URL in use — dev mode can be pointed at production via .env.
console.log(
  IMAGE_BASE_URL === PRODUCTION_BACKEND_URL
    ? `🌐 Backend: PRODUCTION → ${IMAGE_BASE_URL}`
    : `💻 Backend: LOCALHOST / DEV → ${IMAGE_BASE_URL}`
);

type Registration = Record<string, any>;
type BankDetails = Record<string, any>;
type ApiResponse = {
  success: boolean;
  message?: string;
  error?: string;
  user?: {
    id: number;
    username: string;
    name: string;
    role: string;
    phone?: string;
  };
  data?: any;
};

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Request failed.');
  }

  return data;
};

export const api = {
  // --- Public Endpoints ---
  register: async (formData: FormData): Promise<ApiResponse> => {
    const response = await fetch(`${API_BASE_URL}/register.php`, {
      method: 'POST',
      body: formData,
    });
    return response.json();
  },

  getQrCode: async (): Promise<ApiResponse & { qr_code_path: string; bank_details?: BankDetails }> => {
    const response = await fetch(`${API_BASE_URL}/get_qr.php`);
    return response.json();
  },

  // --- Admin Endpoints ---
  login: async (username: string, password: string): Promise<ApiResponse> => {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return response.json();
  },

  getRegistrations: async (): Promise<Registration[]> => {
    const response = await fetch(`${API_BASE_URL}/registrations.php`);
    const data = await response.json();
    return data.data;
  },

  approveRegistration: async (id: number): Promise<ApiResponse> => {
    const response = await fetch(`${API_BASE_URL}/approve.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return response.json();
  },

  deleteRegistration: async (id: number): Promise<ApiResponse> => {
    const response = await fetch(`${API_BASE_URL}/delete.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return response.json();
  },

  restoreRegistration: async (id: number): Promise<ApiResponse> => {
    const response = await fetch(`${API_BASE_URL}/restore.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return response.json();
  },

  permanentDeleteRegistration: async (id: number): Promise<ApiResponse> => {
    const response = await fetch(`${API_BASE_URL}/permanent_delete.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return response.json();
  },

  getTrash: async (): Promise<Registration[]> => {
    const response = await fetch(`${API_BASE_URL}/trash.php`);
    const data = await response.json();
    return data.data;
  },

  updateBankDetails: async (details: BankDetails): Promise<ApiResponse> => {
    const response = await fetch(`${API_BASE_URL}/update_bank_details.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(details),
    });
    return response.json();
  },

  // --- Abstract Management ---
  getAbstracts: async (): Promise<any[]> => {
    const response = await fetch(`${API_BASE_URL}/admin_abstracts.php`);
    const data = await response.json();
    return data.data || [];
  },

  updateAbstractStatus: async (id: number, status: 'approved' | 'rejected'): Promise<ApiResponse> => {
    const response = await fetch(`${API_BASE_URL}/admin_abstract_approve.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    return response.json();
  }
};

export const adminService = {
  getAnalytics: () => request<any>('/analytics/dashboard'),
  getAttendanceOverview: (date?: string, supervisorId?: string | number | null) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (supervisorId) params.append('supervisorId', supervisorId.toString());
    const qs = params.toString();
    return request<any>(`/attendance/overview${qs ? `?${qs}` : ''}`);
  },
  getStaff: () => request<any[]>('/staff'),
  addStaff: (staff: Record<string, any>) =>
    request<ApiResponse>('/staff', {
      method: 'POST',
      body: JSON.stringify(staff),
    }),
  deleteStaff: (id: string | number) =>
    request<ApiResponse>(`/staff/${id}`, {
      method: 'DELETE',
    }),
  updateStaff: (id: string | number, staff: Record<string, any>) =>
    request<ApiResponse>(`/staff/${id}`, {
      method: 'PUT',
      body: JSON.stringify(staff),
    }),
  getLeads: () => request<any[]>('/leads'),
  createLead: (lead: Record<string, any>) =>
    request<ApiResponse>('/leads', {
      method: 'POST',
      body: JSON.stringify(lead),
    }),
  updateLeadStatus: (id: string | number, status: string) =>
    request<ApiResponse>(`/leads/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  getSites: () => request<any[]>('/sites'),
  createSite: (site: Record<string, any>) =>
    request<ApiResponse>('/sites', {
      method: 'POST',
      body: JSON.stringify(site),
    }),
  deleteSite: (id: string | number) =>
    request<ApiResponse>(`/sites/${id}`, {
      method: 'DELETE',
    }),
  allocateSupervisor: (supervisorId: string | number, siteId: string | number) =>
    request<ApiResponse>('/allocations', {
      method: 'POST',
      body: JSON.stringify({ supervisorId, siteId }),
    }),
};

export const accountsService = {
  addTransaction: (txn: Record<string, any>) =>
    request<ApiResponse>('/accounts/transactions', {
      method: 'POST',
      body: JSON.stringify(txn),
    }),
  getTransactions: (role: string, flow?: 'IN' | 'OUT', from?: string, to?: string, userId?: string | number | null) => {
    const params = new URLSearchParams();
    if (flow) params.append('flow', flow);
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (userId) params.append('userId', userId.toString());
    const qs = params.toString();
    return request<any[]>(`/accounts/transactions/${role}${qs ? `?${qs}` : ''}`);
  },
  getIOReport: (role: string, from?: string, to?: string, userId?: string | number | null) => {
    const params = new URLSearchParams({ role });
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (userId) params.append('userId', userId.toString());
    return request<any>(`/accounts/io-report?${params.toString()}`);
  },
  getSummary: (role: string, userId?: string | number | null) => {
    const qs = userId ? `?userId=${userId}` : '';
    return request<any>(`/accounts/summary/${role}${qs}`);
  },
  getTotalSummary: () => request<any>('/accounts/total-summary'),
  getDayBook: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const qs = params.toString();
    return request<any[]>(`/accounts/daybook${qs ? `?${qs}` : ''}`);
  },
  getLedger: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const qs = params.toString();
    return request<any[]>(`/accounts/ledger${qs ? `?${qs}` : ''}`);
  },
  getPeriods: () => request<{ months: string[]; years: string[] }>('/accounts/periods'),
  getReport: (type: 'monthly' | 'yearly', period: string) =>
    request<any>(`/accounts/report?type=${type}&period=${encodeURIComponent(period)}`),
};

// Uploads a local photo (file:// or blob uri) to the backend and returns its public URL.
// Photos are stored organized on the server: images/<role>/<username>/<type>-...jpg
export const uploadPhoto = async (
  localUri: string,
  opts: { role?: string; username?: string; type?: string } = {}
): Promise<string> => {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(localUri)).blob();
    formData.append('photo', blob, `photo-${Date.now()}.jpg`);
  } else {
    formData.append('photo', {
      uri: localUri,
      name: `photo-${Date.now()}.jpg`,
      type: 'image/jpeg',
    } as any);
  }

  const params = new URLSearchParams();
  if (opts.role) params.append('role', opts.role);
  if (opts.username) params.append('username', opts.username);
  if (opts.type) params.append('type', opts.type);
  const qs = params.toString();

  // No Content-Type header: fetch sets the multipart boundary automatically
  const response = await fetch(`${API_BASE_URL}/upload${qs ? `?${qs}` : ''}`, {
    method: 'POST',
    body: formData,
  });
  const data = await response.json();
  if (!response.ok || !data?.url) {
    throw new Error(data?.error || 'Photo upload failed.');
  }
  return `${IMAGE_BASE_URL}${data.url}`;
};

export const fieldService = {
  logExpense: (expense: Record<string, any>) =>
    request<ApiResponse>('/expenses', {
      method: 'POST',
      body: JSON.stringify(expense),
    }),
  getLedgerBySite: (siteId: string | number) => request<any[]>(`/expenses/site/${siteId}`),
  getSupervisorWallet: (userId: string | number) => request<any>(`/wallet/${userId}`),
  getSupervisorSites: (userId: string | number) => request<any[]>(`/supervisor-sites/${userId}`),
  submitAttendance: (attendance: Record<string, any>) =>
    request<ApiResponse>('/attendance', {
      method: 'POST',
      body: JSON.stringify(attendance),
    }),
  getAttendanceBySite: (siteId: string | number, date: string) =>
    request<any[]>(`/attendance/site/${siteId}?date=${encodeURIComponent(date)}`),
  submitSupervisorAttendance: (attendance: Record<string, any>) =>
    request<ApiResponse>('/supervisor-attendance', {
      method: 'POST',
      body: JSON.stringify(attendance),
    }),
  uploadSitePhoto: (photo: Record<string, any>) =>
    request<ApiResponse>('/site-photos', {
      method: 'POST',
      body: JSON.stringify(photo),
    }),
  getRecentSitePhotos: () => request<any[]>('/site-photos/recent'),
  saveDriverRecord: (record: Record<string, any>) =>
    request<ApiResponse>('/driver-records', {
      method: 'POST',
      body: JSON.stringify(record),
    }),
  getDriverRecords: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const qs = params.toString();
    return request<any[]>(`/driver-records${qs ? `?${qs}` : ''}`);
  },
};
