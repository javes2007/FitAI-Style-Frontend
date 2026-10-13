import { useState } from "react";
import { navigationItems } from "./data/navigation.js";
import { HomePage } from "./pages/HomePage.jsx";

export default function App() {
  const [active, setActive] = useState("Inicio");

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="FitAI Style inicio">
          <span className="brand-mark">F</span><span>FitAI <b>Style</b></span>
        </a>
        <nav className="main-nav" aria-label="Navegación principal">
          {navigationItems.map((item) => (
            <button
              className={active === item.label ? "nav-item active" : "nav-item"}
              key={item.label}
              onClick={() => setActive(item.label)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
        <span className="status-pill"><i /> Experiencia modular</span>
      </header>
      <main id="inicio">
        <HomePage activeSection={active} />
      </main>
      <footer className="site-footer">FitAI Style · Arquitectura React en desarrollo</footer>
    </div>
  );
}