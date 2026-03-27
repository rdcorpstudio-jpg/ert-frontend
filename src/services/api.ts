import axios from "axios";

/** Repeated keys for arrays (e.g. `payment_method=a&payment_method=b`) for FastAPI list query params. */
function serializeQueryParams(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    if (raw === undefined || raw === null) continue;
    if (Array.isArray(raw)) {
      for (const v of raw) {
        if (v !== undefined && v !== null) usp.append(key, String(v));
      }
      continue;
    }
    if (typeof raw === "boolean") {
      usp.append(key, raw ? "true" : "false");
      continue;
    }
    const s = String(raw);
    if (s === "") continue;
    usp.append(key, s);
  }
  return usp.toString();
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  paramsSerializer: serializeQueryParams,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const detail = (err.response?.data?.detail ?? "").toString().toLowerCase();
    const isAuthError =
      status === 401 ||
      (status === 403 && (detail.includes("not authenticated") || detail.includes("invalid token")));
    if (isAuthError) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
