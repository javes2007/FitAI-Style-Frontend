(() => {
  "use strict";

  const API_URL = window.FITAI_API_URL || (
    location.protocol === "file:" || !location.hostname || location.hostname === "localhost" || location.hostname === "127.0.0.1"
      ? "http://localhost:5000/api"
      : "https://fitai-style-backend.onrender.com/api"
  );
  const CART_KEY = "fitai_tienda_carrito_v1";
  const $ = (id) => document.getElementById(id);
  const state = { productos: [], carrito: leerCarrito(), busy: false };

  function leerCarrito() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      return Array.isArray(raw) ? raw.filter(x => Number.isInteger(Number(x.id_prenda)) && Number(x.id_prenda) > 0 && Number(x.cantidad) > 0).slice(0, 30) : [];
    } catch { return []; }
  }
  function guardarCarrito() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(state.carrito)); } catch {}
    renderCarrito();
  }
  function escapar(value) {
    return String(value ?? "").replace(/[&<>'"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[c]));
  }
  function dinero(value, currency = "COP") {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "Precio en tienda";
    try { return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value)); }
    catch { return "$ " + Math.round(Number(value)).toLocaleString("es-CO") + " " + currency; }
  }
  function estado(message, type = "") {
    const el = $("tiendaEstado");
    if (!el) return;
    el.textContent = message || "";
    el.className = "tienda-status" + (type ? " " + type : "");
  }
  async function requestJSON(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 16000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.mensaje || "No se pudo completar la solicitud.");
      return data;
    } finally { clearTimeout(timer); }
  }
  function safeImage(value) {
    const url = String(value || "").trim();
    if (/^https:\/\//i.test(url) || /^img\/[a-z0-9_./-]+\.(?:png|jpe?g|webp|gif)$/i.test(url)) return url;
    return "";
  }
  function renderProductos(productos) {
    const container = $("tiendaProductos");
    if (!container) return;
    if (!productos.length) {
      container.innerHTML = '<div class="tienda-empty"><strong>No encontramos prendas con esa búsqueda.</strong><p>Prueba otro término o cambia el origen.</p></div>';
      return;
    }
    container.innerHTML = productos.map(p => {
      const own = p.tipo === "propio" || p.proveedor === "fitai";
      const img = safeImage(p.url_imagen);
      const price = dinero(p.precio, p.moneda || "COP");
      const category = p.categoria || p.origen || (own ? "Catálogo FitAI" : "Tienda externa");
      if (own) {
        const id = Number(p.id_prenda ?? p.id);
        return `<article class="tienda-product-card">
          <div class="tienda-product-image">${img ? `<img loading="lazy" src="${escapar(img)}" alt="${escapar(p.nombre)}">` : '<span aria-hidden="true">✦</span>'}<span class="tienda-product-tag">FitAI Style</span></div>
          <div class="tienda-product-info"><small>${escapar(category)}</small><h3>${escapar(p.nombre)}</h3><p>${escapar([p.color, p.talla ? "Talla " + p.talla : ""].filter(Boolean).join(" · ") || "Prenda seleccionada")}</p>
          <strong class="tienda-product-price">${price}</strong><button type="button" class="tienda-add-btn" data-add="${id}">Agregar al carrito</button></div>
        </article>`;
      }
      const url = String(p.url_compra || "");
      const safeLink = /^https:\/\//i.test(url) && /(^|\.)mercadolibre\.com(?:\.co)?$/i.test(new URL(url).hostname.replace(/^www\./i, "")) ? url : "https://www.mercadolibre.com.co/";
      return `<article class="tienda-product-card">
        <div class="tienda-product-image">${img ? `<img loading="lazy" src="${escapar(img)}" alt="${escapar(p.nombre)}">` : '<span aria-hidden="true">↗</span>'}<span class="tienda-product-tag external">Mercado Libre</span></div>
        <div class="tienda-product-info"><small>Vendido por tercero</small><h3>${escapar(p.nombre)}</h3><p>El precio y la disponibilidad pueden cambiar en la tienda.</p>
        <strong class="tienda-product-price">${price}</strong><a class="tienda-add-btn tienda-external-btn" href="${escapar(safeLink)}" target="_blank" rel="noopener noreferrer">Ver en Mercado Libre ↗</a></div>
      </article>`;
    }).join("");
  }
  async function cargarProductos() {
    const button = $("tiendaBuscarBtn");
    if (button) { button.disabled = true; button.textContent = "Buscando..."; }
    const query = $("tiendaQuery")?.value.trim() || "";
    const origin = $("tiendaOrigen")?.value || "todos";
    estado("Cargando productos del catálogo y tiendas disponibles...");
    try {
      const params = new URLSearchParams({ q: query, origen: origin, limite: "24" });
      const data = await requestJSON(`${API_URL}/tienda/productos?${params.toString()}`);
      state.productos = Array.isArray(data.productos) ? data.productos : [];
      renderProductos(state.productos);
      estado(state.productos.length ? `${state.productos.length} productos encontrados. Los artículos externos se compran en el sitio del vendedor.` : "No hay resultados para esta búsqueda.", state.productos.length ? "success" : "");
    } catch (error) {
      renderProductos([]);
      estado(error.name === "AbortError" ? "La búsqueda tardó demasiado. Inténtalo otra vez." : error.message, "error");
    } finally {
      if (button) { button.disabled = false; button.textContent = "Buscar prendas"; }
    }
  }
  function renderCarrito() {
    const container = $("tiendaCartItems");
    if (!container) return;
    const count = state.carrito.reduce((sum, item) => sum + item.cantidad, 0);
    const total = state.carrito.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
    $("tiendaCartCount").textContent = String(count);
    $("tiendaTotal").textContent = dinero(total);
    $("tiendaPagarBtn").disabled = count === 0 || state.busy;
    if (!state.carrito.length) {
      container.innerHTML = '<p class="tienda-muted">Agrega una prenda del catálogo FitAI.</p>';
      return;
    }
    container.innerHTML = state.carrito.map(item => `<div class="tienda-cart-item">
      <div><strong>${escapar(item.nombre)}</strong><small>${dinero(item.precio)} · Cantidad ${item.cantidad}</small></div>
      <div class="tienda-cart-actions"><button type="button" data-qty="${item.id_prenda}" data-delta="-1" aria-label="Reducir cantidad">−</button><button type="button" data-qty="${item.id_prenda}" data-delta="1" aria-label="Aumentar cantidad">+</button><button type="button" data-remove="${item.id_prenda}" aria-label="Quitar producto">×</button></div>
    </div>`).join("");
  }
  function agregar(id) {
    const product = state.productos.find(p => Number(p.id_prenda ?? p.id) === id && (p.tipo === "propio" || p.proveedor === "fitai"));
    if (!product) return;
    const current = state.carrito.find(x => x.id_prenda === id);
    if (current) current.cantidad = Math.min(10, current.cantidad + 1);
    else if (state.carrito.length < 30) state.carrito.push({ id_prenda: id, nombre: product.nombre, precio: Number(product.precio), cantidad: 1 });
    else return estado("El carrito admite hasta 30 productos diferentes.", "error");
    guardarCarrito();
    estado("Prenda agregada al carrito.", "success");
  }
  async function checkout(event) {
    event.preventDefault();
    if (state.busy || !state.carrito.length) return;
    const token = localStorage.getItem("fitai_token");
    if (!token) {
      estado("Inicia sesión para continuar con el pago. Luego vuelve al carrito.", "error");
      if (typeof window.abrirLogin === "function") window.abrirLogin();
      return;
    }
    const form = $("tiendaCheckoutForm");
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form).entries());
    const provider = values.proveedor_pago;
    const envio = Object.fromEntries(["nombre", "email", "telefono", "direccion", "ciudad", "departamento"].map(k => [k, values[k]]));
    state.busy = true;
    renderCarrito();
    estado("Preparando el pedido y verificando precios en el servidor...");
    try {
      const data = await requestJSON(`${API_URL}/tienda/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ proveedor_pago: provider, items: state.carrito.map(x => ({ id_prenda: x.id_prenda, cantidad: x.cantidad })), envio })
      });
      const target = new URL(data.checkout_url);
      const host = target.hostname.toLowerCase();
      const valid = provider === "wompi"
        ? host === "checkout.wompi.co"
        : (host === "mercadopago.com.co" || host.endsWith(".mercadopago.com.co") || host === "mercadopago.com" || host.endsWith(".mercadopago.com"));
      if (target.protocol !== "https:" || !valid) throw new Error("La pasarela devolvió un enlace no reconocido. No abras un enlace inesperado.");
      estado("Pedido creado. Te llevaremos a la pasarela segura; todavía no está confirmado como pagado.", "success");
      location.assign(target.href);
    } catch (error) {
      estado(error.name === "AbortError" ? "La solicitud tardó demasiado. Revisa tus pedidos antes de intentarlo otra vez." : error.message, "error");
    } finally {
      state.busy = false;
      renderCarrito();
    }
  }
  async function verificarRetorno() {
    const params = new URLSearchParams(location.search);
    const reference = params.get("pedido");
    if (!reference || !/^FITAI-[A-F0-9]{32}$/.test(reference)) return;
    const token = localStorage.getItem("fitai_token");
    if (!token) {
      estado("Volviste de la pasarela. Inicia sesión para verificar el estado del pedido.", "error");
      return;
    }
    estado("Verificando el estado real del pago con la pasarela...");
    const transactionId = params.get("id") || params.get("transaction_id") || "";
    const url = `${API_URL}/tienda/pedidos/${encodeURIComponent(reference)}/verificar` + (transactionId ? `?transaction_id=${encodeURIComponent(transactionId)}` : "");
    try {
      const data = await requestJSON(url, { headers: { "Authorization": `Bearer ${token}` } });
      if (data.estado === "pagado") {
        state.carrito = [];
        guardarCarrito();
        estado("¡Pago verificado! El pedido " + reference + " figura como pagado. Guarda esta referencia para seguimiento.", "success");
      } else {
        estado("Estado del pedido " + reference + ": " + data.estado + ". No se marcará como pagado hasta recibir confirmación.", "error");
      }
    } catch (error) {
      estado("No pudimos confirmar el pago automáticamente. Conserva la referencia " + reference + " y vuelve a consultar tus pedidos. " + error.message, "error");
    }
  }
  document.addEventListener("click", event => {
    const add = event.target.closest("[data-add]");
    if (add) { agregar(Number(add.dataset.add)); return; }
    const remove = event.target.closest("[data-remove]");
    if (remove) { state.carrito = state.carrito.filter(x => x.id_prenda !== Number(remove.dataset.remove)); guardarCarrito(); return; }
    const qty = event.target.closest("[data-qty]");
    if (qty) {
      const item = state.carrito.find(x => x.id_prenda === Number(qty.dataset.qty));
      if (!item) return;
      item.cantidad += Number(qty.dataset.delta);
      if (item.cantidad <= 0) state.carrito = state.carrito.filter(x => x !== item);
      else item.cantidad = Math.min(10, item.cantidad);
      guardarCarrito();
    }
  });
  $("tiendaBuscarBtn")?.addEventListener("click", cargarProductos);
  $("tiendaQuery")?.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); cargarProductos(); } });
  $("tiendaOrigen")?.addEventListener("change", cargarProductos);
  $("tiendaVaciarBtn")?.addEventListener("click", () => { state.carrito = []; guardarCarrito(); estado("Carrito vacío."); });
  $("tiendaCheckoutForm")?.addEventListener("submit", checkout);
  renderCarrito();
  cargarProductos();
  verificarRetorno();
})();
