// Backend configurable: en local usa Flask; en producción define
// window.FITAI_API_URL antes de cargar este archivo o reemplaza esta URL.
const API_URL = window.FITAI_API_URL || (
    window.location.protocol === "file:" ||
    window.location.hostname === "" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
) ? "http://localhost:5000/api" : "/api";

// Frontend utilities
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
function leerJSONSeguro(valor, fallback = null) {
    try { return valor ? JSON.parse(valor) : fallback; } catch { return fallback; }
}
async function respuestaJSON(respuesta) {
    const data = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(data.error || data.mensaje || "No se pudo completar la solicitud.");
    return data;
}

async function fetchConTimeout(url, options = {}, timeout = 30000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
        if (error?.name === "AbortError") {
            throw new Error("La solicitud tardó demasiado. Inténtalo nuevamente.");
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}
function validarArchivoImagen(file) {
    if (!file) return "Selecciona una imagen.";
    if (!file.type.startsWith("image/")) return "Selecciona un archivo de imagen válido.";
    if (file.size > MAX_IMAGE_SIZE) return "La imagen es demasiado grande. Usa una imagen de máximo 10 MB.";
    return "";
}

// ============================================================
// BÚSQUEDA DE INSPIRACIÓN DE MODA (Google Custom Search)
// ============================================================

let saveTimeout;

async function buscarInspiracion(){
    const query = document.getElementById("inspiracionQuery")?.value.trim();
    const genero = document.getElementById("inspiracionGenero")?.value;
    const estado = document.getElementById("inspiracionEstado");
    const contenedor = document.getElementById("inspiracionResultados");
    const boton = document.getElementById("inspiracionBtn");

    if (!query) {
        estado.textContent = "Escribe algo para buscar.";
        return;
    }

    boton.disabled = true;
    estado.textContent = "🔍 Buscando inspiración...";
    contenedor.innerHTML = "";

    try {
        const params = new URLSearchParams({ q: query });
        if (genero) params.set("genero", genero);

        const respuesta = await fetchConTimeout(`${API_URL}/buscar-estilo?${params.toString()}`);
        const data = await respuestaJSON(respuesta);

        if (!data.success) {
            throw new Error(data.error || "No se pudo buscar en este momento.");
        }

        if (!data.results || data.results.length === 0) {
            estado.textContent = "No encontramos resultados para esa búsqueda.";
            return;
        }

        estado.textContent = `${data.results.length} resultados encontrados.`;

        contenedor.innerHTML = data.results.map(r => `
            <a class="inspiracion-card" href="${encodeURI(r.url || "#")}" target="_blank" rel="noopener noreferrer">
                ${r.image ? `<img src="${encodeURI(r.image)}" alt="" loading="lazy" onerror="this.remove()">` : ""}
                <div class="inspiracion-card-texto">
                    <strong>${escapeHTML(r.title || "")}</strong>
                    <span>${escapeHTML(r.description || "")}</span>
                    <small>${escapeHTML(r.display_url || "")}</small>
                </div>
            </a>
        `).join("");

    } catch (error) {
        estado.textContent = `⚠ ${error.message}`;
    } finally {
        boton.disabled = false;
    }
}


// ============================================================
// CLIMA AUTOMÁTICO (OpenWeatherMap) — para el Consultor de imagen
// ============================================================

function usarClimaActual(){
    const boton = document.getElementById("climaAutoBtn");
    const texto = document.getElementById("climaAutoTexto");
    const select = document.getElementById("iaClima");

    if (!navigator.geolocation) {
        texto.textContent = "Tu navegador no permite obtener tu ubicación.";
        return;
    }

    boton.disabled = true;
    texto.textContent = "📡 Detectando tu ubicación...";

    navigator.geolocation.getCurrentPosition(async (posicion) => {
        const { latitude, longitude } = posicion.coords;
        texto.textContent = "⏳ Consultando el clima...";

        try {
            const respuesta = await fetchConTimeout(`${API_URL}/clima?lat=${latitude}&lon=${longitude}`);
            const data = await respuestaJSON(respuesta);

            const clima = data.clima;
            select.value = clima.categoria;
            texto.textContent = `✅ ${clima.temperatura}°C, ${clima.descripcion} en ${clima.ciudad || "tu zona"}`;
        } catch (error) {
            texto.textContent = `⚠ ${error.message}`;
        } finally {
            boton.disabled = false;
        }
    }, () => {
        texto.textContent = "No pudimos acceder a tu ubicación (revisa los permisos del navegador).";
        boton.disabled = false;
    });
}


const links = document.querySelectorAll("nav a");

links.forEach((link) => {
    const actual = window.location.pathname.split("/").pop() || "index.html";
    if (link.getAttribute("href") === actual) {
        link.classList.add("activo");
    }
});

function preview(){
    const archivo = document.getElementById("archivo");
    const previewBox = document.getElementById("preview");

    if (!archivo || !previewBox) return;

    previewBox.innerHTML = "";
    const file = archivo.files[0];

    if (!file) return;

    const errorImagen = validarArchivoImagen(file);
    if (errorImagen) {
        alert(errorImagen);
        archivo.value = "";
        return;
    }

    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    const fotoAvatar = img.src;
    img.classList.add("preview-img");
    img.alt = "Vista previa de la imagen subida";
    img.onload = () => URL.revokeObjectURL(img.src);
    previewBox.appendChild(img);

    const avatarPhoto = document.getElementById("avatarPhoto");
    if (avatarPhoto) {
        avatarPhoto.style.backgroundImage = `linear-gradient(rgba(255,255,255,0.16),rgba(0,0,0,0.12)), url("${fotoAvatar}")`;
    }

    const texto = document.createElement("p");
    texto.textContent = "Imagen cargada correctamente.";
    texto.classList.add("texto-preview");
    previewBox.appendChild(texto);
}


function actualizarMetricas(body, fit, style){
    const metricBody = document.getElementById("metricBody");
    const metricFit = document.getElementById("metricFit");
    const metricStyle = document.getElementById("metricStyle");

    if (metricBody) metricBody.textContent = `${body}%`;
    if (metricFit) metricFit.textContent = `${fit}%`;
    if (metricStyle) metricStyle.textContent = `${style}%`;
}

// ============================================================
// PUENTE ENTRE EL AVATAR 3D REAL (avatar3D.js) Y LA CUENTA
// ============================================================
// El avatar 3D real vive en avatar3D.js y usa los sliders
// #height/#shoulder/#waist/#body/#face/#eyes. Aquí solo nos
// encargamos de guardar/restaurar esos valores en la cuenta del
// usuario, reutilizando las columnas existentes en MySQL
// (altura, ancho_hombros, pecho, cintura, cadera).
// Nota: "pecho" y "cadera" ahora guardan la misma "proporción
// corporal" (#body), y "face"/"eyes" todavía no se persisten.

function configurarAutoguardadoAvatar(){
    const ids = ["height", "shoulder", "waist", "body"];
    const elementos = ids.map(id => document.getElementById(id));

    if (elementos.some(el => !el)) return; // esta página no tiene el avatar 3D

    elementos.forEach(el => {
        el.addEventListener("input", () => {
            const usuarioStr = localStorage.getItem("fitai_usuario");
            if (!usuarioStr) return;

            const usuario = leerJSONSeguro(usuarioStr);
            if (!usuario || !usuario.id_usuario) return;

            const height = document.getElementById("height").value;
            const shoulder = document.getElementById("shoulder").value;
            const waist = document.getElementById("waist").value;
            const body = document.getElementById("body").value;

            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                guardarMedidasBD(usuario.id_usuario, height, shoulder, body, waist, body);
            }, 1500);
        });
    });
}

function cargarMedidasUsuario(usuario) {
    const height = document.getElementById("height");
    const shoulder = document.getElementById("shoulder");
    const waist = document.getElementById("waist");
    const body = document.getElementById("body");

    if (height && usuario.altura) height.value = usuario.altura;
    if (shoulder && usuario.ancho_hombros) shoulder.value = usuario.ancho_hombros;
    if (waist && usuario.cintura) waist.value = usuario.cintura;
    if (body && usuario.pecho) body.value = usuario.pecho;

    // Disparamos "input" para que avatar3D.js reconstruya el avatar
    // y actualice los textos de valor, sin duplicar esa lógica aquí.
    [height, shoulder, waist, body].forEach(el => {
        if (el) el.dispatchEvent(new Event("input"));
    });
}



window.addEventListener("scroll", () => {
    const header = document.querySelector(".header");
    if (!header) return;
    header.classList.toggle("header-scroll", window.scrollY > 50);
});

const dropArea = document.querySelector(".upload-box");

if (dropArea) {
    dropArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropArea.classList.add("drag");
    });

    dropArea.addEventListener("dragleave", () => {
        dropArea.classList.remove("drag");
    });

    dropArea.addEventListener("drop", (e) => {
        e.preventDefault();
        dropArea.classList.remove("drag");

        const archivo = document.getElementById("archivo");
        if (!archivo || !e.dataTransfer.files.length) return;

        archivo.files = e.dataTransfer.files;
        preview();
    });
}

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function(e){
        const target = document.querySelector(this.getAttribute("href"));
        if (!target) return;

        e.preventDefault();
        target.scrollIntoView({ behavior:"smooth" });
    });
});

function abrirLogin(){
    const login = document.getElementById("loginContainer");
    if (login) { login.style.display = "flex"; login.classList.add("open"); document.body.classList.add("modal-open"); }
}

function cerrarLogin(){
    const login = document.getElementById("loginContainer");
    if (login) { login.style.display = "none"; login.classList.remove("open"); document.body.classList.remove("modal-open"); }
}

window.addEventListener("load", () => {
    // Al cargar, verificar si hay un usuario autenticado guardado en localStorage
    const usuarioStr = localStorage.getItem("fitai_usuario");
    const usuario = leerJSONSeguro(usuarioStr);
    if (usuario) {
        cargarMedidasUsuario(usuario);
    }
    configurarAutoguardadoAvatar();
});

function mostrarLoginMensaje(texto,tipo="error"){
    const box=document.getElementById("loginMessage");
    if(!box)return;
    box.textContent=texto;
    box.className=`form-message show${tipo==="success"?" success":""}`;
}
function limpiarLoginMensaje(){const box=document.getElementById("loginMessage");if(box)box.className="form-message";}
function alternarPassword(){
    const input=document.getElementById("password"),button=document.querySelector(".toggle-password");
    if(!input)return;
    const visible=input.type==="text"; input.type=visible?"password":"text";
    if(button)button.textContent=visible?"👁":"🙈";
}
function validarCredenciales(correo,password){
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))return"Escribe un correo electrónico válido.";
    if(password.length<8)return"La contraseña debe tener al menos 8 caracteres.";
    return"";
}
async function registrar(){
    const correo=document.getElementById("correo")?.value.trim(),password=document.getElementById("password")?.value||"";
    const error=validarCredenciales(correo,password); if(error){mostrarLoginMensaje(error);return;}
    const submit=document.querySelector(".login-submit"); if(submit)submit.disabled=true;
    mostrarLoginMensaje("Creando tu cuenta...","success");
    try{
        if(window.firebaseConfigured && typeof window.registrarFirebase === "function"){
            await window.registrarFirebase(correo.split("@")[0], correo, password);
            mostrarLoginMensaje("Cuenta creada correctamente.","success");
            return;
        }
        const response=await fetchConTimeout(`${API_URL}/register`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nombre:correo.split("@")[0],email:correo,contrasena:password})});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.error||"No se pudo crear la cuenta.");
        if(data.usuario)localStorage.setItem("fitai_usuario",JSON.stringify(data.usuario));
        if(data.token)localStorage.setItem("fitai_token",data.token);
        mostrarLoginMensaje(data.mensaje||"Cuenta creada correctamente.","success");
        setTimeout(cerrarLogin,900);
    }catch(error){
        mostrarLoginMensaje(error.message.includes("Failed to fetch")?"No se pudo conectar con el backend. Verifica que esté ejecutándose.":error.message);
    }finally{
        if(submit)submit.disabled=false;
    }
}
async function login(){
    const correo=document.getElementById("correo")?.value.trim(),password=document.getElementById("password")?.value||"";
    const error=validarCredenciales(correo,password); if(error){mostrarLoginMensaje(error);return;}
    const submit=document.querySelector(".login-submit"); if(submit){submit.disabled=true;const s=submit.querySelector("span");if(s)s.textContent="Verificando...";}
    limpiarLoginMensaje();
    try{
        if(window.firebaseConfigured && typeof window.loginFirebaseEmail === "function"){
            await window.loginFirebaseEmail(correo,password);
            if(document.getElementById("recordarSesion")?.checked)localStorage.setItem("fitai_recordar","1");
            mostrarLoginMensaje("Inicio de sesión exitoso.","success");
            return;
        }
        const response=await fetchConTimeout(`${API_URL}/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:correo,contrasena:password})});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.error||"Correo o contraseña incorrectos.");
        if(data.usuario)localStorage.setItem("fitai_usuario",JSON.stringify(data.usuario));
        if(data.token)localStorage.setItem("fitai_token",data.token);
        if(document.getElementById("recordarSesion")?.checked)localStorage.setItem("fitai_recordar","1");else localStorage.removeItem("fitai_recordar");
        mostrarLoginMensaje(data.mensaje||"Inicio de sesión exitoso.","success");
        if(data.usuario)cargarMedidasUsuario(data.usuario);
        setTimeout(cerrarLogin,700);
    }catch(error){
        const code=error?.code||"";
        const textos={"auth/invalid-credential":"Correo o contraseña incorrectos.","auth/user-not-found":"No existe una cuenta con ese correo.","auth/wrong-password":"La contraseña no es correcta.","auth/too-many-requests":"Demasiados intentos. Espera unos minutos."};
        mostrarLoginMensaje(textos[code]||error.message||"No se pudo iniciar sesión.");
    }finally{
        if(submit){submit.disabled=false;const s=submit.querySelector("span");if(s)s.textContent="Iniciar sesión";}
    }
}
function mostrarRecuperacion(){
    const correo=document.getElementById("correo")?.value.trim();
    if(!correo)return mostrarLoginMensaje("Escribe primero tu correo para enviarte el enlace de recuperación.");
    if(typeof window.recuperarFirebase !== "function")return mostrarLoginMensaje("Configura Firebase para activar la recuperación de contraseña.");
    window.recuperarFirebase(correo).then(()=>mostrarLoginMensaje("Te enviamos un enlace para restablecer tu contraseña.","success")).catch(()=>mostrarLoginMensaje("No pudimos enviar el enlace de recuperación."));
}

async function guardarMedidasBD(id_usuario, altura, ancho, pecho, cintura, cadera) {
    try {
        const token = localStorage.getItem("fitai_token");
        const response = await fetchConTimeout(`${API_URL}/usuarios/${id_usuario}/medidas`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                altura: altura,
                ancho_hombros: ancho,
                pecho: pecho,
                cintura: cintura,
                cadera: cadera
            })
        });
        if (response.ok) {
            console.log("Medidas de avatar guardadas con éxito en MySQL.");
            // Actualizar local storage
            const usuarioStr = localStorage.getItem("fitai_usuario");
            if (usuarioStr) {
                const usuario = leerJSONSeguro(usuarioStr);
                if (!usuario) return;
                usuario.altura = altura;
                usuario.ancho_hombros = ancho;
                usuario.pecho = pecho;
                usuario.cintura = cintura;
                usuario.cadera = cadera;
                localStorage.setItem("fitai_usuario", JSON.stringify(usuario));
            }
        }
    } catch (error) {
        console.warn("No se pudieron persistir las medidas en la base de datos:", error);
    }
}

async function enviarContacto(form) {
    const formData = new FormData(form);
    const nombre = formData.get("nombre");
    const email = formData.get("email");
    const asunto = formData.get("asunto");
    const mensaje = formData.get("mensaje");

    try {
        const response = await fetchConTimeout(`${API_URL}/contacto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre, email, asunto, mensaje })
        });
        const data = await response.json();
        if (response.ok) {
            alert(data.mensaje || "Mensaje enviado con éxito.");
            form.reset();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        alert("No se pudo enviar el mensaje. Verifica que el servidor esté ejecutándose.");
    }
}

document.addEventListener("keydown",event=>{if(event.key==="Escape")cerrarLogin();});
document.addEventListener("click",event=>{const modal=document.getElementById("loginContainer");if(modal&&event.target===modal)cerrarLogin();});


// ==========================
// CONSULTOR DE IMAGEN IA
// ==========================
let consultorFile = null;
let consultorPreviewUrl = null;

function liberarPreviewConsultor() {
    if (consultorPreviewUrl) {
        URL.revokeObjectURL(consultorPreviewUrl);
        consultorPreviewUrl = null;
    }
}

function prepararConsultorArchivo(file){
    if(!file) return;
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)){ alert("Usa una imagen JPG, PNG o WEBP."); return; }
    if(file.size > 16 * 1024 * 1024){ alert("La imagen no puede superar 16 MB."); return; }

    liberarPreviewConsultor();
    consultorFile = file;

    const preview=document.getElementById("consultorPreview");
    const img=document.getElementById("consultorPreviewImg");
    const drop=document.getElementById("consultorDrop");

    consultorPreviewUrl = URL.createObjectURL(file);
    if(img) img.src=consultorPreviewUrl;
    if(preview) preview.hidden=false;
    if(drop) drop.hidden=true;
}

function limpiarConsultor(){
    liberarPreviewConsultor();
    consultorFile=null;
    const input=document.getElementById("consultorArchivo");
    const preview=document.getElementById("consultorPreview");
    const drop=document.getElementById("consultorDrop");
    if(input) input.value="";
    if(preview) preview.hidden=true;
    if(drop) drop.hidden=false;
}

async function consultarImagenIA(){
    if(!consultorFile){ alert("Primero sube una foto de tu outfit."); return; }
    const btn=document.getElementById("consultorBtn");
    const result=document.getElementById("consultorResult");
    if(btn){btn.disabled=true;btn.innerHTML='<span>Analizando tu estilo...</span><span class="ai-pulse">✦</span>';}
    if(result) result.innerHTML='<div class="result-loading"><div class="result-orb spin">✦</div><span>FITAI ESTÁ ANALIZANDO</span><h3>Observando colores, prendas y contexto...</h3><p>La recomendación se está generando.</p></div>';
    const form=new FormData();
    form.append("imagen",consultorFile);
    form.append("ocasion",document.getElementById("iaOcasion")?.value||"diario");
    form.append("estilo",document.getElementById("iaEstilo")?.value||"casual");
    form.append("clima",document.getElementById("iaClima")?.value||"cálido");
    form.append("presupuesto",document.getElementById("iaPresupuesto")?.value||"medio");
    try{
        const response=await fetchConTimeout(`${API_URL}/ia/consultor-imagen`,{method:"POST",body:form},60000);
        const data=await response.json().catch(()=>({}));
        if(!response.ok) throw new Error(data.error||"La IA no pudo completar el análisis.");
        renderResultadoConsultor(data.resultado||{});
    }catch(error){
        const esConfig = /GEMINI_API_KEY|no está configurada/i.test(error.message);
        const titulo = esConfig ? "La IA necesita configuración" : "No se pudo completar el análisis";
        const sugerencia = esConfig ? " Revisa GEMINI_API_KEY en backend/.env." : "";
        if(result) result.innerHTML=`<div class="result-error"><div class="result-orb">!</div><span>NO SE PUDO COMPLETAR</span><h3>${titulo}</h3><p>${escapeHTML(error.message)}${sugerencia}</p></div>`;
    }finally{
        if(btn){btn.disabled=false;btn.innerHTML='<span>Analizar mi estilo con IA</span><span>✦</span>';}
    }
}

function renderResultadoConsultor(r){
    const result=document.getElementById("consultorResult"); if(!result)return;
    const list=(v)=>Array.isArray(v)?v.map(x=>`<li>${escapeHTML(String(x))}</li>`).join(""):"";
    const palette=Array.isArray(r.paleta)?r.paleta.map(x=>`<span class="palette-chip">${escapeHTML(String(x))}</span>`).join(""):"";
    result.innerHTML=`<div class="result-content"><div class="result-top"><div><span>FITAI · CONSULTA COMPLETA</span><h3>${escapeHTML(r.outfit_sugerido||"Outfit recomendado")}</h3></div><strong>${Number(r.nivel_confianza||0)}%</strong></div><p class="result-summary">${escapeHTML(r.resumen||"Análisis completado.")}</p><div class="result-columns"><div><h4>Paleta</h4><div class="palette">${palette||"<span>Personalizada</span>"}</div><h4>Prendas</h4><ul>${list(r.prendas_recomendadas)||"<li>Prendas seleccionadas según el contexto.</li>"}</ul></div><div><h4>Accesorios</h4><ul>${list(r.accesorios)||"<li>Accesorios minimalistas que no compitan con el outfit.</li>"}</ul><div class="tip-box"><strong>Consejo FitAI</strong><p>Prioriza una prenda protagonista y mantén el resto de la combinación equilibrada.</p></div></div></div></div>`;
}

function escapeHTML(value){
    return String(value).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch]));
}

const consultorInput=document.getElementById("consultorArchivo");
if(consultorInput) consultorInput.addEventListener("change",e=>prepararConsultorArchivo(e.target.files?.[0]));
const consultorDrop=document.getElementById("consultorDrop");
if(consultorDrop){
    ["dragenter","dragover"].forEach(ev=>consultorDrop.addEventListener(ev,e=>{e.preventDefault();consultorDrop.classList.add("drag");}));
    ["dragleave","drop"].forEach(ev=>consultorDrop.addEventListener(ev,e=>{e.preventDefault();consultorDrop.classList.remove("drag");}));
    consultorDrop.addEventListener("drop",e=>prepararConsultorArchivo(e.dataTransfer.files?.[0]));
}

window.addEventListener("keydown",e=>{if(e.key==="Escape")cerrarLogin();});
