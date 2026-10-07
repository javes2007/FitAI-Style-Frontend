/* ============================================================
   JAVES — Asistente virtual de FitAI Style
   Chat + voz + análisis de imagen, disponible en todo el sitio.
   ============================================================ */
(function () {
    "use strict";

    const MAX_JAVES_IMAGE_SIZE = 10 * 1024 * 1024;

    const JAVES_API_URL = (typeof API_URL !== "undefined")
        ? API_URL
        : ((window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
            ? "http://localhost:5000/api"
            : "https://fitai-style-backend.onrender.com/api");

    const K_HIST = "javes_historial";
    const K_VOZ = "javes_voz";
    const K_SALUDO = "javes_saludo_dado";
    const MAX_HISTORIAL = 20;
    const REQUEST_TIMEOUT = 30000;
    const IMAGE_REQUEST_TIMEOUT = 60000;

    const paginaActual = (window.location.pathname.split("/").pop() || "index.html");

    function leerJSONSeguro(valor, fallback = null) {
        try { return valor ? JSON.parse(valor) : fallback; } catch (e) { return fallback; }
    }

    function fetchConTimeout(url, options = {}, timeout = REQUEST_TIMEOUT) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        return fetch(url, { ...options, signal: controller.signal })
            .finally(() => clearTimeout(timer));
    }

    let historial = leerJSONSeguro(localStorage.getItem(K_HIST), []);
    if (!Array.isArray(historial)) historial = [];

    // Voz de entrada desactivada temporalmente por solicitud del usuario.
    let vozActiva = false;
    let archivoAdjunto = null;
    let reconociendoVoz = false;
    let reconocimiento = null;

    function escapeHTML(value) {
        return String(value).replace(/[&<>'"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" }[ch]));
    }

    function guardarHistorial() {
        try {
            const recorte = historial.slice(-MAX_HISTORIAL);
            localStorage.setItem(K_HIST, JSON.stringify(recorte));
        } catch (e) {}
    }

    function construirWidget() {
        const root = document.createElement("div");
        root.id = "javes-root";
        root.innerHTML = `
            <div id="javes-panel" role="dialog" aria-label="Chat con JAVES" aria-modal="false">
                <div id="javes-header">
                    <span class="javes-dot"></span>
                    <div>
                        <strong>JAVES</strong>
                        <small>Asistente de estilo · FitAI</small>
                    </div>
                    <div id="javes-header-actions">
                        <button type="button" class="javes-icon-btn" id="javes-toggle-voz" title="Silenciar/activar voz">🔊</button>
                        <button type="button" class="javes-icon-btn" id="javes-cerrar" title="Cerrar">✕</button>
                    </div>
                </div>
                <div id="javes-messages" aria-live="polite"></div>
                <div id="javes-quick">
                    <button type="button" class="javes-chip" data-quick="consultor">Analizar mi outfit</button>
                    <button type="button" class="javes-chip" data-quick="avatar">Crear mi avatar</button>
                    <button type="button" class="javes-chip" data-quick="precios">Ver precios</button>
                    <button type="button" class="javes-chip" data-quick="contacto">Contacto</button>
                </div>
                <div id="javes-inputbar">
                    <button type="button" class="javes-icon-btn" id="javes-clip" title="Adjuntar foto de tu outfit">📎</button>
                    <input type="file" id="javes-file" accept="image/jpeg,image/png,image/webp">
                    <textarea id="javes-input" rows="1" placeholder="Escribe tu mensaje..."></textarea>
                    <button type="button" class="javes-icon-btn" id="javes-mic" title="Micrófono desactivado temporalmente" disabled hidden>🎙</button>
                    <button type="button" id="javes-send" title="Enviar">➤</button>
                </div>
            </div>
            <button type="button" id="javes-orb" aria-label="Abrir asistente JAVES">
                <span class="javes-ring"></span>
                <span class="javes-ring javes-ring-2"></span>
                <span class="javes-core"></span>
                <span id="javes-badge"></span>
            </button>
        `;
        document.body.appendChild(root);
    }

    function pintarMensaje(rol, html) {
        const cont = document.getElementById("javes-messages");
        const div = document.createElement("div");
        div.className = `javes-msg javes-msg-${rol}`;
        div.innerHTML = html;
        cont.appendChild(div);
        cont.scrollTop = cont.scrollHeight;
        return div;
    }

    function agregarMensaje(rol, texto, guardar) {
        pintarMensaje(rol, escapeHTML(texto));
        if (guardar !== false && (rol === "usuario" || rol === "asistente")) {
            historial.push({ rol, texto });
            guardarHistorial();
        }
    }

    function mostrarPensando() {
        return pintarMensaje("asistente", '<span class="javes-thinking"><span></span><span></span><span></span></span>');
    }

    function restaurarHistorialEnPantalla() {
        const cont = document.getElementById("javes-messages");
        cont.innerHTML = "";
        if (!historial.length) {
            const saludoDado = localStorage.getItem(K_SALUDO);
            const saludo = saludoDado
                ? "¿En qué puedo ayudarte ahora?"
                : "Hola, soy JAVES, tu asistente de estilo. Puedo aconsejarte sobre tu outfit, guiarte por el sitio, o analizar una foto si me la envías con el clip 📎.";
            pintarMensaje("asistente", escapeHTML(saludo));
            localStorage.setItem(K_SALUDO, "1");
            if (!saludoDado) hablar(saludo);
        } else {
            historial.forEach(m => pintarMensaje(m.rol, escapeHTML(m.texto)));
        }
    }

    let vocesCache = [];
    if ("speechSynthesis" in window) {
        const refrescarVoces = () => { vocesCache = window.speechSynthesis.getVoices() || []; };
        refrescarVoces();
        window.speechSynthesis.onvoiceschanged = refrescarVoces;
    }

    function elegirVozEspanol() {
        if (!vocesCache.length) return null;
        return (
            vocesCache.find(v => /google/i.test(v.name) && /^es-(419|us|co|mx|ar)/i.test(v.lang)) ||
            vocesCache.find(v => /^es-(419|us|co|mx|ar)/i.test(v.lang)) ||
            vocesCache.find(v => /google/i.test(v.name) && v.lang.toLowerCase().startsWith("es")) ||
            vocesCache.find(v => v.lang && v.lang.toLowerCase().startsWith("es")) ||
            null
        );
    }

    let resumeIntervalId = null;

    function hablar(texto) {
        if (!vozActiva || !("speechSynthesis" in window) || !texto) return;
        try {
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(texto);
            const voz = elegirVozEspanol();
            utter.lang = voz ? voz.lang : "es-419";
            if (voz) utter.voice = voz;
            utter.rate = 1.03;
            utter.pitch = 0.95;
            const orb = document.getElementById("javes-orb");

            utter.onstart = () => {
                orb && orb.classList.add("javes-speaking");
                clearInterval(resumeIntervalId);
                resumeIntervalId = setInterval(() => {
                    if (window.speechSynthesis.speaking) window.speechSynthesis.resume();
                }, 10000);
            };
            utter.onend = utter.onerror = () => {
                orb && orb.classList.remove("javes-speaking");
                clearInterval(resumeIntervalId);
            };
            window.speechSynthesis.speak(utter);
        } catch (e) {}
    }

    function detenerHabla() {
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
        clearInterval(resumeIntervalId);
        const orb = document.getElementById("javes-orb");
        orb && orb.classList.remove("javes-speaking");
    }

    function crearReconocimiento() {
        const Motor = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Motor) return null;
        const r = new Motor();
        r.lang = "es-CO";
        r.continuous = false;
        r.interimResults = true;
        r.maxAlternatives = 1;
        return r;
    }

    function alternarMicrofono() {
        // Entrada por micrófono desactivada temporalmente.
        return;
    }

    function finalizarEscucha() {
        reconociendoVoz = false;
        const micBtn = document.getElementById("javes-mic");
        const orb = document.getElementById("javes-orb");
        const input = document.getElementById("javes-input");
        micBtn && micBtn.classList.remove("javes-active");
        orb && orb.classList.remove("javes-listening");
        if (!reconociendoVoz) estadoJaves("idle");
        if (input) input.placeholder = "Escribe tu mensaje...";
    }

    const JAVES_ANIMACIONES = [
        "idle", "escuchando", "pensando", "hablando",
        "feliz", "entusiasmada", "senalando", "confundida"
    ];

    function estadoJaves(nombre) {
        const orb = document.getElementById("javes-orb");
        if (!orb) return;
        JAVES_ANIMACIONES.forEach(a => orb.classList.remove("javes-" + a));
        if (JAVES_ANIMACIONES.includes(nombre)) orb.classList.add("javes-" + nombre);
        if (nombre !== "escuchando" && nombre !== "hablando") {
            setTimeout(() => {
                JAVES_ANIMACIONES.forEach(a => orb.classList.remove("javes-" + a));
                orb.classList.add("javes-idle");
            }, 1400);
        }
    }

    function ejecutarAccion(accion, destino) {
        if (!accion || accion === "ninguna" || !destino) return;

        const acciones = {
            navegar: () => {
                const [pagina, hash] = destino.split("#");
                setTimeout(() => {
                    if ((pagina || "index.html") === paginaActual) {
                        if (hash) {
                            const el = document.getElementById(hash);
                            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                    } else {
                        window.location.href = destino;
                    }
                }, 650);
            },
            scroll: () => {
                const el = document.getElementById(destino);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                estadoJaves("senalando");
            },
            filtro_ropa: () => {
                if (paginaActual !== "ropa.html") {
                    window.location.href = "ropa.html?estilo=" + encodeURIComponent(destino);
                    return;
                }
                const buscador = document.getElementById("inspiracionQuery");
                const boton = document.getElementById("inspiracionBtn");
                if (buscador) {
                    buscador.value = destino;
                    buscador.focus();
                    if (typeof window.buscarInspiracion === "function") window.buscarInspiracion();
                    else if (boton) boton.click();
                }
                estadoJaves("feliz");
            },
            avatar: () => {
                const target = destino || "avatar.html";
                if (target === paginaActual) {
                    estadoJaves("entusiasmada");
                    return;
                }
                window.location.href = target;
            },
            avatar_camara: () => {
                const comandos = {
                    zoom_in: () => window.zoomAvatar?.(0.72),
                    zoom_out: () => window.zoomAvatar?.(1.38),
                    face: () => window.zoomAvatarToFace?.(),
                    front: () => window.view?.("front"),
                    side: () => window.view?.("side"),
                    back: () => window.view?.("back"),
                    reset: () => window.resetAvatarView?.()
                };

                if (paginaActual !== "avatar.html") {
                    window.location.href = "avatar.html?camera=" + encodeURIComponent(destino);
                    return;
                }

                if (comandos[destino]) {
                    comandos[destino]();
                    estadoJaves(destino === "zoom_in" || destino === "face" ? "entusiasmada" : "senalando");
                }
            }
        };

        if (acciones[accion]) acciones[accion]();
    }

    async function enviarMensajeTexto(texto) {
        agregarMensaje("usuario", texto);
        const pensando = mostrarPensando();
        const sendBtn = document.getElementById("javes-send");
        sendBtn.disabled = true;

        try {
            const respuesta = await fetchConTimeout(`${JAVES_API_URL}/ia/asistente`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mensaje: texto,
                    historial: historial.slice(-10),
                    pagina: paginaActual,
                }),
            });
            const data = await respuesta.json().catch(() => ({}));
            pensando.remove();

            if (!respuesta.ok) throw new Error(data.error || "JAVES no pudo responder.");

            const resultado = data.resultado || {};
            const texto_respuesta = resultado.respuesta || "No tengo una respuesta clara para eso.";
            agregarMensaje("asistente", texto_respuesta);
            estadoJaves(resultado.animacion || "hablando");
            hablar(texto_respuesta);
            ejecutarAccion(resultado.accion, resultado.destino);
        } catch (error) {
            pensando.remove();
            const detalle = error?.name === "AbortError"
                ? "La solicitud tardó demasiado. Inténtalo de nuevo."
                : error?.message || "Error desconocido.";
            const texto_error = `No pude conectarme en este momento. (${detalle})`;
            agregarMensaje("asistente", texto_error, false);
            hablar("Tuve un problema para responder. Revisa la consola del navegador para más detalles.");
        } finally {
            sendBtn.disabled = false;
        }
    }

    async function enviarImagen(file, textoUsuario) {
        if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            agregarMensaje("sistema", "Usa una imagen JPG, PNG o WEBP.", false);
            return;
        }
        if (file.size > MAX_JAVES_IMAGE_SIZE) {
            agregarMensaje("sistema", "La imagen es demasiado grande. Usa una imagen de máximo 10 MB.", false);
            return;
        }
        const urlPreview = URL.createObjectURL(file);
        const preview = pintarMensaje("usuario", `<img class="javes-preview" src="${urlPreview}" alt="Foto enviada">${textoUsuario ? escapeHTML(textoUsuario) : "Analiza mi outfit, por favor."}`);
        const previewImage = preview.querySelector(".javes-preview");
        previewImage?.addEventListener("load", () => URL.revokeObjectURL(urlPreview), { once: true });
        previewImage?.addEventListener("error", () => URL.revokeObjectURL(urlPreview), { once: true });
        historial.push({ rol: "usuario", texto: textoUsuario || "[envié una foto de mi outfit para analizar]" });
        guardarHistorial();

        const pensando = mostrarPensando();
        const sendBtn = document.getElementById("javes-send");
        sendBtn.disabled = true;

        const form = new FormData();
        form.append("imagen", file);
        form.append("ocasion", "diario");
        form.append("estilo", "casual");
        form.append("clima", "templado");
        form.append("presupuesto", "medio");

        try {
            const respuesta = await fetchConTimeout(`${JAVES_API_URL}/ia/consultor-imagen`, { method: "POST", body: form }, IMAGE_REQUEST_TIMEOUT);
            const data = await respuesta.json().catch(() => ({}));
            pensando.remove();

            if (!respuesta.ok) throw new Error(data.error || "No pude analizar la imagen.");

            const r = data.resultado || {};
            const prendas = Array.isArray(r.prendas_recomendadas) ? r.prendas_recomendadas.slice(0, 3).join(", ") : "";
            const resumen = [
                r.resumen || "Análisis completado.",
                r.outfit_sugerido ? `Sugerencia: ${r.outfit_sugerido}.` : "",
                prendas ? `Prendas: ${prendas}.` : "",
                "Para más detalle (ocasión, clima, presupuesto), usa el Consultor de imagen completo en Inicio.",
            ].filter(Boolean).join(" ");

            agregarMensaje("asistente", resumen);
            hablar(r.resumen || resumen);
        } catch (error) {
            const detalle = error?.name === "AbortError"
                ? "El análisis tardó demasiado. Inténtalo de nuevo con la foto."
                : error?.message || "Error desconocido.";
            agregarMensaje("asistente", `No pude analizar la foto. (${detalle})`, false);
        } finally {
            sendBtn.disabled = false;
            archivoAdjunto = null;
        }
    }

    function enviarDesdeInput() {
        const input = document.getElementById("javes-input");
        const texto = input.value.trim();
        if (!texto && !archivoAdjunto) return;

        if (archivoAdjunto) {
            const file = archivoAdjunto;
            enviarImagen(file, texto);
        } else {
            enviarMensajeTexto(texto);
        }
        input.value = "";
        document.getElementById("javes-file").value = "";
        archivoAdjunto = null;
    }

    function manejarAccionRapida(clave) {
        const mapa = {
            consultor: "index.html#consultor",
            avatar: "avatar.html",
            precios: "precios.html",
            contacto: "contactos.html",
        };
        const destino = mapa[clave];
        if (!destino) return;
        agregarMensaje("sistema", "Abriendo esa sección...", false);
        ejecutarAccion("navegar", destino);
    }

    function abrirPanel() {
        document.getElementById("javes-panel").classList.add("javes-open");
        document.getElementById("javes-badge").classList.remove("javes-show");
        document.getElementById("javes-input").focus();
    }

    function cerrarPanel() {
        document.getElementById("javes-panel").classList.remove("javes-open");
        if (window.speechSynthesis) window.speechSynthesis.cancel();
    }

    function init() {
        construirWidget();
        estadoJaves("idle");
        restaurarHistorialEnPantalla();

        const orb = document.getElementById("javes-orb");
        const panel = document.getElementById("javes-panel");

        orb.addEventListener("click", () => {
            panel.classList.contains("javes-open") ? cerrarPanel() : abrirPanel();
        });
        document.getElementById("javes-cerrar").addEventListener("click", cerrarPanel);

        document.getElementById("javes-send").addEventListener("click", enviarDesdeInput);
        const input = document.getElementById("javes-input");
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviarDesdeInput();
            }
        });
        input.addEventListener("input", () => {
            input.style.height = "auto";
            input.style.height = Math.min(input.scrollHeight, 90) + "px";
        });

        document.getElementById("javes-mic").addEventListener("click", alternarMicrofono);

        const clip = document.getElementById("javes-clip");
        const fileInput = document.getElementById("javes-file");
        clip.addEventListener("click", () => fileInput.click());
        fileInput.addEventListener("change", () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;
            if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                agregarMensaje("sistema", "Usa una imagen JPG, PNG o WEBP.", false);
                fileInput.value = "";
                return;
            }
            if (file.size > MAX_JAVES_IMAGE_SIZE) {
                agregarMensaje("sistema", "La imagen es demasiado grande. Usa una imagen de máximo 10 MB.", false);
                fileInput.value = "";
                return;
            }
            archivoAdjunto = file;
            input.placeholder = `Foto lista: ${file.name} · escribe algo o envía así`;
            input.focus();
        });

        document.querySelectorAll(".javes-chip").forEach(chip => {
            chip.addEventListener("click", () => manejarAccionRapida(chip.dataset.quick));
        });

        const toggleVoz = document.getElementById("javes-toggle-voz");
        toggleVoz.textContent = vozActiva ? "🔊" : "🔇";
        toggleVoz.addEventListener("click", () => {
            vozActiva = !vozActiva;
            localStorage.setItem(K_VOZ, vozActiva ? "1" : "0");
            toggleVoz.textContent = vozActiva ? "🔊" : "🔇";
            if (!vozActiva && window.speechSynthesis) window.speechSynthesis.cancel();
        });

        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape") cerrarPanel();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();