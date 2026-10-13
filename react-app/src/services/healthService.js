import { apiRequest } from "../api/client.js";

export function getBackendHealth() {
  return apiRequest("/../health");
}

export function getBackendStatus() {
  return fetchHealth("/status");
}

async function fetchHealth(path) {
  const base = (import.meta.env.VITE_FITAI_API_URL || "https://fitai-style-backend.onrender.com/api").replace(/\/$/, "");
  const root = base.endsWith("/api") ? base.slice(0, -4) : base;
  const response = await fetch(`${root}${path}`, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || `Estado HTTP ${response.status}`);
  return payload;
}