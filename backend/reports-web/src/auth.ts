// The backend has no token/session system at all (POST /api/login just checks
// username/password and returns the user row — see backend/src/controllers/
// authController.ts). This mirrors the mobile app's own trust model exactly:
// verify once at login, remember the role client-side, gate routes on it.
const STORAGE_KEY = 'ayyanar_reports_admin';

export type AdminSession = { id: number; username: string; name: string };

export const getSession = (): AdminSession | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setSession = (session: AdminSession) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const clearSession = () => {
  localStorage.removeItem(STORAGE_KEY);
};
