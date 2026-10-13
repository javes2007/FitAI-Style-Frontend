import { useBackendHealth } from "../hooks/useBackendHealth.js";

export function BackendStatusCard() {
  const { loading, data, error, refresh } = useBackendHealth();
  const online = Boolean(data?.backend);
  return (
    <section className="status-card" aria-live="polite">
      <div className="status-card-top">
        <span className="eyebrow">CONEXIÓN DEL SISTEMA</span>
        <button className="text-button" onClick={refresh} type="button">Actualizar</button>
      </div>
      <h3>{loading ? "Comprobando conexión…" : error ? "Conexión no confirmada" : online ? "Backend conectado" : "Backend sin confirmar"}</h3>
      <p>{loading ? "Consultando el estado del servicio." : error ? error : data?.database === true ? "El backend y la base de datos responden." : "El backend responde; revisa el estado de la base de datos en el detalle."}</p>
      <div className="status-details">
        <span><i className={online ? "dot good" : "dot"} /> API: {loading ? "consultando" : error ? "sin respuesta" : online ? "respuesta recibida" : "no confirmado"}</span>
        <span><i className={data?.database ? "dot good" : "dot"} /> Base de datos: {loading ? "consultando" : data?.database ? "conectada" : error ? "no verificada" : "no confirmada"}</span>
      </div>
    </section>
  );
}