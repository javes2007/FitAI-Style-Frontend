const DEFAULT_API_URL = "https://fitai-style-backend.onrender.com/api";
const API_URL = (import.meta.env.VITE_FITAI_API_URL || DEFAULT_API_URL).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path.startsWith("/") ? path : `/${path}`}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok) {
    throw new ApiError(
      payload?.message || payload?.error || `La API respondió HTTP ${response.status}`,
      response.status,
      payload,
    );
  }
  return payload;
}

export { API_URL };