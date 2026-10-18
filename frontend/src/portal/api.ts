import axios from "axios";
import { Platform } from "react-native";
import type { Dataset } from "./model";
import { assertLivePortalRequest, isPortalPreviewPath } from "./previewPolicy";

const currentPath = () => typeof window !== "undefined" ? window.location.pathname : "";

const PORTAL_TOKEN_KEY = "ankelba_portal_token";

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (typeof window !== "undefined" && window.location && window.location.hostname) {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:5000/api";
    }
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      return `http://${host}:5000/api`;
    }
    return "http://192.168.8.114:5000/api";
  }
  if (Platform.OS === "android") return "http://192.168.8.114:5000/api";
  return "http://localhost:5000/api";
};

export const portalClient = axios.create({
  baseURL: getBaseUrl(),
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const portalTokenStorage = {
  getToken: (): string | null => {
    if (isPortalPreviewPath(currentPath())) return null;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(PORTAL_TOKEN_KEY) || window.localStorage.getItem("ankelba_auth_token");
      }
      return null;
    } catch {
      return null;
    }
  },
  setToken: (token: string): void => {
    if (isPortalPreviewPath(currentPath())) return;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(PORTAL_TOKEN_KEY, token);
        window.localStorage.setItem("ankelba_auth_token", token);
      }
    } catch {}
  },
  clearToken: (): void => {
    if (isPortalPreviewPath(currentPath())) return;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(PORTAL_TOKEN_KEY);
        window.localStorage.removeItem("ankelba_auth_token");
      }
    } catch {}
  },
};

portalClient.interceptors.request.use((config) => {
  assertLivePortalRequest(currentPath());
  const token = portalTokenStorage.getToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const portalApi = {
  async session() {
    const token = portalTokenStorage.getToken();
    if (!token) return null;
    try {
      return (await portalClient.get("/auth/me")).data.user;
    } catch {
      portalTokenStorage.clearToken();
      return null;
    }
  },
  async login(email: string, password: string) {
    const { data } = await portalClient.post("/auth/login", { email, password });
    portalTokenStorage.setToken(data.token);
    return data.user;
  },
  async logout() {
    try {
      await portalClient.post("/auth/logout");
    } finally {
      portalTokenStorage.clearToken();
    }
  },
  async snapshot(date: string, staff = false): Promise<Dataset> {
    return (
      await portalClient.get("/portal/" + (staff ? "workspace" : "snapshot"), {
        params: { date, days: 30 },
      })
    ).data;
  },
  async save(path: string, body: unknown, method: "post" | "patch" = "post") {
    return (await portalClient[method](path, body)).data;
  },
  async enrollFamily(payload: any) {
    const { data } = await portalClient.post("/children/enroll-family", payload);
    return data;
  },
  async registerDaycare(payload: any) {
    const { data } = await portalClient.post("/saas/register-daycare", payload);
    return data;
  },
  async getSuperAdminStats() {
    const { data } = await portalClient.get("/super-admin/stats");
    return data;
  },
  async listDaycares() {
    const { data } = await portalClient.get("/super-admin/daycares");
    return { daycares: data };
  },
  async getSuperAdminDaycares(params?: any) {
    const { data } = await portalClient.get("/super-admin/daycares", { params });
    return data;
  },
  async getSuperAdminDaycare(id: number | string) {
    const { data } = await portalClient.get(`/super-admin/daycares/${id}`);
    return data;
  },
  async approveDaycare(id: number | string, payload?: any) {
    const { data } = await portalClient.patch(`/super-admin/daycares/${id}/approve`, payload || {});
    return data;
  },
  async rejectDaycare(id: number | string, reason?: string) {
    const { data } = await portalClient.patch(`/super-admin/daycares/${id}/reject`, { reason });
    return data;
  },
  async suspendDaycare(id: number | string, reason?: string) {
    const { data } = await portalClient.patch(`/super-admin/daycares/${id}/suspend`, { reason });
    return data;
  },
  async activateDaycare(id: number | string) {
    const { data } = await portalClient.patch(`/super-admin/daycares/${id}/activate`);
    return data;
  },
  async updateDaycarePlan(id: number | string, plan: string, maxChildren?: number, extendTrialDays?: number) {
    const { data } = await portalClient.patch(`/super-admin/daycares/${id}/plan`, { plan, maxChildren, extendTrialDays });
    return data;
  },
  async getSuperAdminUsers(params?: any) {
    const { data } = await portalClient.get("/super-admin/users", { params });
    return data;
  },
  async getSuperAdminAuditLogs(params?: any) {
    const { data } = await portalClient.get("/super-admin/audit-logs", { params });
    return data;
  },
  async getSuperAdminSystemHealth() {
    const { data } = await portalClient.get("/super-admin/system-health");
    return data;
  },
};

export function apiError(error: any) {
  if (!error) return "An unexpected error occurred.";
  if (typeof error === "string") return error;
  if (error.response?.data?.fields && Array.isArray(error.response.data.fields)) {
    return error.response.data.fields.map((f: any) => f.message || f.error).join(". ");
  }
  return (
    error.response?.data?.error ||
    error.response?.data?.message ||
    error.message ||
    "Unable to connect. Check the backend and try again."
  );
}

