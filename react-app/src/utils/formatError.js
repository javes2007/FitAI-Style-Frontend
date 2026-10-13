export function formatError(error, fallback = "Ocurrió un error inesperado.") {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  return error.message || fallback;
}

export function formatCop(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Precio no disponible";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}