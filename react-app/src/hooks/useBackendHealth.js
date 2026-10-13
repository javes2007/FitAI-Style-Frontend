import { useCallback, useEffect, useState } from "react";
import { getBackendStatus } from "../services/healthService.js";

export function useBackendHealth() {
  const [state, setState] = useState({ loading: true, data: null, error: "" });

  const refresh = useCallback(async () => {
    setState({ loading: true, data: null, error: "" });
    try {
      const data = await getBackendStatus();
      setState({ loading: false, data, error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message || "No se pudo conectar con el backend." });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { ...state, refresh };
}