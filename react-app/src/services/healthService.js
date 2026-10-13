export function getBackendStatus() {
  const configuredApi = (import.meta.env.VITE_FITAI_API_URL || "https://fitai-style-backend.onrender.com/api").replace(/\/$/, "");
  const root = configuredApi.endsWith("/api") ? configuredApi.slice(0, -4) : configuredApi;
  return fetch(`${root}/status`, { headers: { Accept: "application/json" } })
    .then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || `Estado HTTP ${response.status}`);
      return payload;
    });
}