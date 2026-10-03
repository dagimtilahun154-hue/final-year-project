import { apiClient, tokenStorage } from "../api/client";
import { Dataset } from "./model";
export const portalApi = {
  async session() {
    if (!(await tokenStorage.getToken())) return null;
    return (await apiClient.get("/auth/me")).data.user;
  },
  async login(email: string, password: string) {
    const { data } = await apiClient.post("/auth/login", { email, password });
    await tokenStorage.setToken(data.token);
    return data.user;
  },
  async logout() {
    try {
      await apiClient.post("/auth/logout");
    } finally {
      await tokenStorage.clearToken();
    }
  },
  async snapshot(date: string, staff = false): Promise<Dataset> {
    return (
      await apiClient.get("/portal/" + (staff ? "workspace" : "snapshot"), {
        params: { date, days: 30 },
      })
    ).data;
  },
  async save(path: string, body: unknown, method: "post" | "patch" = "post") {
    return (await apiClient[method](path, body)).data;
  },
};
export function apiError(error: any) {
  return (
    error.response?.data?.fields?.map((f: any) => f.message).join(" ") ||
    error.response?.data?.error ||
    "Unable to connect. Check the backend and try again."
  );
}
