import { BackendStatusCard } from "../components/BackendStatusCard.jsx";
import { useAppContext } from "../context/AppContext.jsx";
import { useAppSelector } from "../redux/hooks.js";

export function HomePage({ activeSection }) {
  const { preferences, setPreferences } = useAppContext();
  const compactMode = useAppSelector((state) => state.ui.compactMode);

  return (
    <div className={compactMode ? "home-page compact" : "home-page"}>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-kicker">✦ TU ESTILO, CON INTELIGENCIA</span>
          <h1>Tu imagen.<br /><span>Tu identidad.</span></h1>
          <p>Una base modular para conectar tu perfil, tu estilo y las herramientas inteligentes de FitAI Style.</p>
          <div className="hero-actions">
            <a className="primary-button" href="#estado">Comprobar sistema <span>→</span></a>
            <button className="secondary-button" type="button" onClick={() => setPreferences({ ...preferences, style: preferences.style === "Smart Casual" ? "Urbano" : "Smart Casual" })}>Estilo: {preferences.style}</button>
          </div>
          <div className="hero-metrics"><span>01 <b>API modular</b></span><span>02 <b>Estado global</b></span><span>03 <b>Diseño adaptable</b></span></div>
        </div>
        <div className="hero-visual" aria-label="Panel visual de FitAI Style">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="style-monogram">F<span>+</span></div>
          <div className="floating-tag tag-top">FITAI / STYLE</div>
          <div className="floating-tag tag-bottom"><span>✦</span> Tu estilo evoluciona contigo</div>
        </div>
      </section>
      <section className="workspace" id="estado">
        <div className="section-heading"><span className="hero-kicker">PANEL DE CONTROL</span><h2>{activeSection === "Inicio" ? "Todo conectado, por etapas." : activeSection}</h2><p>Esta es la nueva base React aislada del sitio actual; permite verificar el backend sin tocar compras ni datos de producción.</p></div>
        <div className="dashboard-grid">
          <BackendStatusCard />
          <section className="preference-card">
            <span className="eyebrow">TU PERFIL DE ESTILO</span>
            <h3>Preferencias rápidas</h3>
            <label htmlFor="palette">Paleta de color</label>
            <select id="palette" value={preferences.palette} onChange={(event) => setPreferences({ ...preferences, palette: event.target.value })}>
              <option>Por descubrir</option><option>Cálida</option><option>Fría</option><option>Neutra</option>
            </select>
            <div className="preference-footer"><span>Estado</span><strong>{preferences.palette}</strong></div>
            <p className="muted-note">Las preferencias viven en Context durante esta sesión; la persistencia de cuenta se integrará en la migración de Firebase.</p>
          </section>
        </div>
        <div className="architecture-note"><strong>Sección de trabajo: {activeSection}</strong><span>La navegación es demostrativa en esta fase. Las páginas originales siguen intactas.</span></div>
      </section>
    </div>
  );
}