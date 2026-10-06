/* FitAI Style — navegación responsive */
(function () {
  "use strict";

  function initMobileNavigation() {
    const header = document.querySelector(".header");
    const nav = header?.querySelector("nav");
    if (!header || !nav || document.getElementById("mobileMenuToggle")) return;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.id = "mobileMenuToggle";
    toggle.className = "mobile-menu-toggle";
    toggle.setAttribute("aria-label", "Abrir menú de navegación");
    toggle.setAttribute("aria-controls", "fitai-mobile-nav");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = '<span></span><span></span><span></span>';

    nav.id = "fitai-mobile-nav";
    nav.setAttribute("aria-label", "Navegación principal");

    header.insertBefore(toggle, nav);

    const setOpen = (open) => {
      header.classList.toggle("mobile-menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Cerrar menú de navegación" : "Abrir menú de navegación");
      document.body.classList.toggle("mobile-nav-lock", open);
    };

    toggle.addEventListener("click", () => {
      setOpen(!header.classList.contains("mobile-menu-open"));
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setOpen(false));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setOpen(false);
    });

    document.addEventListener("click", (event) => {
      if (!header.contains(event.target)) setOpen(false);
    });

    const desktopQuery = window.matchMedia("(min-width: 768px)");
    const sync = () => {
      if (desktopQuery.matches) setOpen(false);
    };
    desktopQuery.addEventListener?.("change", sync);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMobileNavigation);
  } else {
    initMobileNavigation();
  }
})();
