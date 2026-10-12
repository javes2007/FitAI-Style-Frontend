(() => {
  "use strict";

  const API_URL = window.FITAI_API_URL || (
    window.location.protocol === "file:" ||
    !window.location.hostname ||
    ["localhost", "127.0.0.1"].includes(window.location.hostname)
      ? "http://localhost:5000/api"
      : "https://fitai-style-backend.onrender.com/api"
  );

  const $ = (id) => document.getElementById(id);
  const API_ORIGIN = new URL(API_URL).origin;
  const MIN_CHECKOUT_COP = 1000;
  const MAX_CHECKOUT_COP = 20000000;
  let catalogItems = [];
  const token = () => {
    try { return localStorage.getItem("fitai_token") || ""; } catch { return ""; }
  };
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>'"]/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[ch]));
  const money = (value, currency = "COP") => {
    const number = Number(value);
    if (!Number.isFinite(number)) return "Precio no disponible";
    try {
      return new Intl.NumberFormat("es-CO", {
        style: "currency", currency, maximumFractionDigits: 0
      }).format(number);
    } catch { return "$ " + Math.round(number).toLocaleString("es-CO") + " " + currency; }
  };
  const safeImage = (value) => {
    const url = String(value || "").trim();
    if (/^https:\/\//i.test(url)) return url;
    if (/^img\/[a-z0-9_./-]+\.(?:png|jpe?g|webp|gif)$/i.test(url)) return url;
    if (/^\/?uploads\/[a-z0-9_./-]+\.(?:png|jpe?g|webp|gif)$/i.test(url)) return API_ORIGIN + "/" + url.replace(/^\//, "");
    return "";
  };

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
    if (token()) headers.Authorization = "Bearer " + token();
    const response = await fetch(API_URL + path, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.mensaje || ("Solicitud fallida (" + response.status + ")"));
    return data;
  }

  function notice(message, isError = false) {
    const el = $("shopNotice");
    if (!el) return;
    el.hidden = !message;
    el.classList.toggle("error", Boolean(isError));
    el.textContent = message || "";
    if (message) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function productCard(item) {
    const id = Number(item.id_prenda ?? item.id);
    const image = safeImage(item.url_imagen);
    return `<article class="shop-product">
      <div class="shop-product-image">${image
        ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(item.nombre_prenda || item.nombre || "Prenda")}" loading="lazy" onerror="this.remove()">`
        : '<span class="shop-product-placeholder">F</span>'}</div>
      <div class="shop-product-body">
        <span class="shop-product-tag">${escapeHTML(item.categoria || "Moda")}</span>
        <h3>${escapeHTML(item.nombre_prenda || item.nombre || "Prenda FitAI")}</h3>
        <div class="shop-product-meta">${escapeHTML([item.color, item.talla ? "Talla " + item.talla : "", item.estilo].filter(Boolean).join(" · "))}</div>
        <div class="shop-product-price">${Number(item.precio) >= MIN_CHECKOUT_COP && Number(item.precio) <= MAX_CHECKOUT_COP ? money(item.precio) : "Precio por revisar"}</div>
        <button class="shop-primary" type="button" data-add-cart="${Number.isFinite(id) ? id : ""}">Añadir al carrito</button>
      </div>
    </article>`;
  }

  async function cargarCatalogo() {
    $("catalogStatus").textContent = "Cargando catálogo…";
    $("catalogGrid").innerHTML = "";
    try {
      const items = await api("/tienda/catalogo?limite=100");
      const list = Array.isArray(items) ? items : [];
      catalogItems = list;
      $("catalogStatus").textContent = list.length ? list.length + " prendas en el catálogo. Solo se pueden comprar productos con precio e inventario confirmados." : "Todavía no hay prendas disponibles.";
      $("catalogGrid").innerHTML = list.map(productCard).join("");
      list.forEach(item => {
        const id = Number(item.id_prenda ?? item.id);
        const button = document.querySelector('[data-add-cart="' + id + '"]');
        const price = Number(item.precio);
        if (button && (price < MIN_CHECKOUT_COP || price > MAX_CHECKOUT_COP || !item.activo || Number(item.stock || 0) < 1)) {
          button.disabled = true;
          button.textContent = price < MIN_CHECKOUT_COP || price > MAX_CHECKOUT_COP ? "Precio por revisar" : "Sin inventario";
        }
      });
    } catch (error) {
      $("catalogStatus").textContent = "No se pudo cargar el catálogo: " + error.message;
    }
  }

  function renderCart(data) {
    const items = Array.isArray(data.items) ? data.items : [];
    $("cartStatus").textContent = items.length
      ? items.reduce((n, item) => n + Number(item.cantidad || 1), 0) + " unidad(es) en el carrito."
      : "Tu carrito está vacío.";
    $("cartTotal").textContent = money(data.total || 0);
    $("cartItems").innerHTML = items.map(item => `
      <div class="shop-cart-item">
        <div><strong>${escapeHTML(item.nombre || "Prenda")}</strong><small>${escapeHTML([item.color, item.talla ? "Talla " + item.talla : ""].filter(Boolean).join(" · "))} · Cantidad: ${Number(item.cantidad || 1)}</small></div>
        <strong>${money(Number(item.precio || 0) * Number(item.cantidad || 1))}</strong>
        <button class="shop-remove" type="button" data-remove-cart="${Number(item.id_prenda)}" aria-label="Quitar ${escapeHTML(item.nombre)}">Quitar</button>
      </div>`).join("");
  }

  async function cargarCarrito() {
    if (!token()) {
      $("cartStatus").textContent = "Inicia sesión para consultar el carrito y pagar.";
      $("cartItems").innerHTML = "";
      $("cartTotal").textContent = money(0);
      return;
    }
    $("cartStatus").textContent = "Consultando carrito…";
    try { renderCart(await api("/carrito")); }
    catch (error) {
      $("cartStatus").textContent = error.message;
      if (/sesión|iniciar sesión|token/i.test(error.message)) notice("Inicia sesión de nuevo para comprar.", true);
    }
  }

  async function agregarCarrito(id) {
    const product = catalogItems.find(item => Number(item.id_prenda ?? item.id) === Number(id));
    if (!product || Number(product.precio) < MIN_CHECKOUT_COP || Number(product.precio) > MAX_CHECKOUT_COP || !product.activo || Number(product.stock || 0) < 1) {
      notice("Esta prenda no tiene precio o inventario confirmado para la venta.", true);
      return;
    }
    if (!token()) {
      notice("Para guardar prendas y comprar, inicia sesión desde el botón de cuenta.", true);
      return;
    }
    try {
      await api("/carrito", { method: "POST", body: JSON.stringify({ id_prenda: Number(id), cantidad: 1 }) });
      notice("Prenda añadida al carrito.");
      await cargarCarrito();
      $("carrito").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) { notice(error.message, true); }
  }

  async function quitarCarrito(id) {
    try {
      await api("/carrito/" + encodeURIComponent(id), { method: "DELETE" });
      await cargarCarrito();
      notice("Prenda quitada del carrito.");
    } catch (error) { notice(error.message, true); }
  }

  async function iniciarPago() {
    if (!token()) {
      notice("Inicia sesión antes de continuar al pago.", true);
      return;
    }
    const button = $("checkoutButton");
    button.disabled = true;
    button.textContent = "Preparando checkout seguro…";
    try {
      const result = await api("/pagos/checkout", {
        method: "POST",
        body: JSON.stringify({ proveedor: $("paymentProvider").value })
      });
      if (!result.checkout_url || !/^https:\/\//i.test(result.checkout_url)) {
        throw new Error("La pasarela no devolvió un enlace de pago seguro.");
      }
      notice("Pedido #" + result.pedido_id + " creado. Te llevaremos a la pasarela segura.");
      window.location.assign(result.checkout_url);
    } catch (error) {
      notice(error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = "Continuar al pago seguro";
    }
  }

  function renderExternal(data) {
    const products = Array.isArray(data.productos) ? data.productos : [];
    $("externalGrid").innerHTML = products.map(item => {
      const image = safeImage(item.imagen);
      const url = /^https:\/\//i.test(item.url || "") ? item.url : "";
      return `<article class="shop-product">
        <div class="shop-product-image">${image ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(item.titulo)}" loading="lazy">` : '<span class="shop-product-placeholder">ML</span>'}</div>
        <div class="shop-product-body">
          <span class="shop-product-tag">Mercado Libre</span>
          <h3>${escapeHTML(item.titulo)}</h3>
          <div class="shop-product-price">${item.precio != null ? money(item.precio, item.moneda || "COP") : "Ver precio en tienda"}</div>
          ${url ? `<a class="shop-primary" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">Ver en Mercado Libre ↗</a>` : ""}
        </div>
      </article>`;
    }).join("");
    $("externalStatus").textContent = data.mercado_libre_error || (products.length
      ? "Resultados obtenidos de la búsqueda de Mercado Libre. Confirma precio, vendedor y envío antes de pagar."
      : "No se encontraron productos de Mercado Libre para esa búsqueda.");
    $("marketplaceLinks").innerHTML = (Array.isArray(data.tiendas) ? data.tiendas : []).map(store =>
      /^https:\/\//i.test(store.url || "")
        ? `<a href="${escapeHTML(store.url)}" target="_blank" rel="noopener noreferrer">Buscar en ${escapeHTML(store.nombre)} ↗</a>`
        : ""
    ).join("");
  }

  async function buscarExternos(event) {
    event?.preventDefault();
    const q = $("externalQuery").value.trim();
    if (!q) return;
    $("externalStatus").textContent = "Buscando productos…";
    $("externalGrid").innerHTML = "";
    $("marketplaceLinks").innerHTML = "";
    try { renderExternal(await api("/tienda/externos?q=" + encodeURIComponent(q))); }
    catch (error) { $("externalStatus").textContent = error.message; }
  }

  async function comprobarRetornoPago() {
    const params = new URLSearchParams(window.location.search);
    const pedido = Number(params.get("pedido"));
    if (!Number.isInteger(pedido) || pedido <= 0) return;
    if (!token()) {
      notice("Regresaste del checkout. Inicia sesión para consultar el estado del pedido #" + pedido + ".", true);
      return;
    }
    try {
      const result = await api("/pagos/estado/" + pedido);
      if (result.estado === "pagado" || result.estado_pago === "pagado") {
        notice("¡Pago confirmado! El pedido #" + pedido + " está pagado y las prendas se añadieron a tu armario.");
      } else {
        notice("El pedido #" + pedido + " todavía figura como " + (result.estado_pago || result.estado || "pendiente") + ". La vuelta desde la pasarela no confirma el pago; vuelve a consultar en unos segundos.");
      }
    } catch (error) { notice("No se pudo consultar el estado del pedido: " + error.message, true); }
  }

  document.addEventListener("click", (event) => {
    const add = event.target.closest("[data-add-cart]");
    const remove = event.target.closest("[data-remove-cart]");
    if (add) agregarCarrito(add.dataset.addCart);
    if (remove) quitarCarrito(remove.dataset.removeCart);
  });
  $("refreshCatalog")?.addEventListener("click", cargarCatalogo);
  $("checkoutButton")?.addEventListener("click", iniciarPago);
  $("externalSearchForm")?.addEventListener("submit", buscarExternos);
  window.addEventListener("fitai-auth-change", () => cargarCarrito());

  cargarCatalogo();
  cargarCarrito();
  comprobarRetornoPago();
})();
