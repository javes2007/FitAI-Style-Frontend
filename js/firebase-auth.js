import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
  getAuth,
  getApps,
  getApp,
  getRedirectResult,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile
} from
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  firebaseConfig,
  firebaseConfigurado
} from "./firebase-config.js";
// ============================================================
// VARIABLES
// ============================================================

const FITAI_API_URL = (
  window.location.protocol === "file:" ||
  window.location.hostname === "" ||
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
) ? "http://localhost:5000/api" : "/api";


let auth = null;

function leerStorage(clave, fallback = null) {
  try {
    const valor = localStorage.getItem(clave);
    return valor === null ? fallback : valor;
  } catch {
    return fallback;
  }
}

function guardarStorage(clave, valor) {
  try {
    localStorage.setItem(clave, valor);
    return true;
  } catch (error) {
    console.warn("[FitAI Firebase] No se pudo guardar la sesión local:", error);
    return false;
  }
}

function eliminarStorage(clave) {
  try {
    localStorage.removeItem(clave);
  } catch (error) {
    console.warn("[FitAI Firebase] No se pudo limpiar la sesión local:", error);
  }
}

async function fetchConTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("La sincronización con FitAI tardó demasiado.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}


// ============================================================
// MENSAJES
// ============================================================

function mensaje(texto, tipo = "error") {

  const box = document.getElementById("loginMessage");

  if (!box) {
    console.log("[FitAI Firebase]", texto);
    return;
  }

  box.textContent = texto;

  box.className =
    `form-message show ${tipo === "success" ? "success" : ""}`;
}


// ============================================================
// ERRORES DE FIREBASE EN ESPAÑOL
// ============================================================

function traducirError(error) {

  const errores = {

    "auth/invalid-email":
      "El correo electrónico no es válido.",

    "auth/user-not-found":
      "No existe una cuenta con ese correo.",

    "auth/wrong-password":
      "La contraseña es incorrecta.",

    "auth/invalid-credential":
      "El correo o la contraseña son incorrectos.",

    "auth/email-already-in-use":
      "Ya existe una cuenta con este correo.",

    "auth/weak-password":
      "La contraseña debe tener al menos 6 caracteres.",

    "auth/popup-closed-by-user":
      "La ventana de inicio de sesión fue cerrada.",

    "auth/popup-blocked":
      "El navegador bloqueó la ventana de inicio de sesión.",

    "auth/too-many-requests":
      "Demasiados intentos. Espera un momento e inténtalo nuevamente.",

    "auth/network-request-failed":
      "No se pudo conectar con Firebase.",

    "auth/unauthorized-domain":
      "Este dominio todavía no está autorizado en Firebase.",

    "auth/operation-not-allowed":
      "Este método de inicio de sesión no está habilitado en Firebase."

  };

  if (error?.code === "auth/invalid-login-credentials") {
    return "El correo o la contraseña son incorrectos.";
  }

  return errores[error?.code] ||
    error?.message ||
    "Ocurrió un error con Firebase.";
}


// ============================================================
// INICIALIZAR FIREBASE
// ============================================================

function inicializarFirebase() {

  try {

    if (!firebaseConfigurado) {

      console.error(
        "[FitAI Firebase] Firebase no está configurado."
      );

      return;
    }

    const app = getApps().length
      ? getApp()
      : initializeApp(firebaseConfig);

    auth = getAuth(app);

    auth.languageCode = "es";

    console.log(
      "[FitAI Firebase] Firebase inicializado correctamente."
    );

    console.log(
      "[FitAI Firebase] Proyecto:",
      firebaseConfig.projectId
    );

  } catch (error) {

    console.error(
      "[FitAI Firebase] Error inicializando Firebase:",
      error
    );

    auth = null;
  }
}


inicializarFirebase();


// ============================================================
// VARIABLES GLOBALES PARA app.js
// ============================================================

window.firebaseConfigured = Boolean(auth);


// ============================================================
// CREAR OBJETO PÚBLICO DEL USUARIO
// ============================================================

function usuarioPublico(user) {

  return {

    uid: user.uid,

    nombre:
      user.displayName ||
      (user.email || "Usuario").split("@")[0],

    email:
      user.email || "",

    foto:
      user.photoURL || "",

    proveedor:
      user.providerData?.[0]?.providerId || "firebase"
  };
}


// ============================================================
// GUARDAR SESIÓN
// ============================================================

function guardarSesion(user) {

  const datos = usuarioPublico(user);

  const serializado = JSON.stringify(datos);
  guardarStorage("fitai_auth", serializado);
  guardarStorage("fitai_usuario", serializado);

  window.dispatchEvent(
    new CustomEvent(
      "fitai-auth-change",
      {
        detail: datos
      }
    )
  );

  return datos;
}


// ============================================================
// MOSTRAR USUARIO EN LA PÁGINA
// ============================================================

function mostrarUsuario(user) {

  document
    .querySelectorAll("[data-auth-user]")
    .forEach(elemento => {
      const esDisplayUsuario = elemento.classList.contains("auth-user-display");

      if (user) {
        elemento.textContent = user.nombre || "Mi cuenta";
        if (esDisplayUsuario) elemento.hidden = false;
      } else if (esDisplayUsuario) {
        elemento.textContent = "";
        elemento.hidden = true;
      } else {
        elemento.textContent = "Empezar";
      }
    });


  document
    .querySelectorAll("[data-auth-avatar]")
    .forEach(elemento => {

      if (user?.foto) {
        elemento.src = user.foto;
      }

    });
}


// ============================================================
// CERRAR MODAL
// ============================================================

function cerrarLoginSeguro() {

  const modal =
    document.getElementById("loginContainer");

  if (modal) {
    modal.classList.remove("open");
  }
}


// ============================================================
// FINALIZAR LOGIN
// ============================================================

async function finalizarLogin(user) {
  const datos = guardarSesion(user);

  // Firebase autentica al usuario; el backend crea/recupera la cuenta
  // MySQL y entrega el JWT que usan las rutas protegidas.
  try {
    const idToken = await user.getIdToken();
    const response = await fetchConTimeout(`${FITAI_API_URL}/auth/firebase`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({id_token: idToken})
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.token && data.usuario) {
      const usuarioBackend = data.usuario && typeof data.usuario === "object"
        ? data.usuario
        : {};
      const usuarioFinal = { ...datos, ...usuarioBackend };
      guardarStorage("fitai_token", data.token);
      guardarStorage("fitai_usuario", JSON.stringify(usuarioFinal));
    } else {
      console.warn("[FitAI] Firebase inició sesión, pero no se pudo sincronizar MySQL:", data.error);
    }
  } catch (error) {
    console.warn("[FitAI] Backend no disponible para sincronizar Firebase:", error);
  }

  cerrarLoginSeguro();

  let usuarioGuardado = datos;
  try {
    usuarioGuardado = JSON.parse(
      leerStorage("fitai_usuario", JSON.stringify(datos))
    );
  } catch {
    console.warn("[FitAI] No se pudo leer la sesión guardada; se usará la sesión actual.");
  }

  mostrarUsuario(usuarioGuardado);
  return datos;
}


// ============================================================
// LOGIN CON GOOGLE
// ============================================================

window.loginGoogle = async function () {

  if (!auth) {

    mensaje(
      "Firebase todavía no está disponible."
    );

    return;
  }

  try {

    const provider =
      new GoogleAuthProvider();

    provider.setCustomParameters({
      prompt: "select_account"
    });

    const resultado =
      await signInWithPopup(
        auth,
        provider
      );

    await finalizarLogin(
      resultado.user
    );

  } catch (error) {

    console.error(
      "[FitAI Firebase] Google:",
      error
    );

    mensaje(
      traducirError(error)
    );
  }
};


// ============================================================
// LOGIN CON FACEBOOK
// ============================================================

window.loginFacebook = async function () {

  if (!auth) {

    mensaje(
      "Firebase todavía no está disponible."
    );

    return;
  }

  try {

    const provider =
      new FacebookAuthProvider();

    if (
      window.matchMedia(
        "(max-width: 767px)"
      ).matches
    ) {

      await signInWithRedirect(
        auth,
        provider
      );

      return;
    }

    const resultado =
      await signInWithPopup(
        auth,
        provider
      );

    await finalizarLogin(
      resultado.user
    );

  } catch (error) {

    console.error(
      "[FitAI Firebase] Facebook:",
      error
    );

    mensaje(
      traducirError(error)
    );
  }
};


// ============================================================
// LOGIN CON CORREO Y CONTRASEÑA
// ============================================================

window.loginFirebaseEmail =
  async function (email, password) {

    if (!auth) {

      mensaje(
        "Firebase todavía no está disponible."
      );

      return null;
    }

    try {

      const resultado =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

      await finalizarLogin(
        resultado.user
      );

      return resultado.user;

    } catch (error) {

      console.error(
        "[FitAI Firebase] Login:",
        error
      );

      mensaje(
        traducirError(error)
      );

      throw error;
    }
  };


// ============================================================
// REGISTRAR USUARIO
// ============================================================

window.registrarFirebase =
  async function (nombre, email, password) {

    if (!auth) {

      mensaje(
        "Firebase todavía no está disponible."
      );

      return null;
    }

    try {

      const resultado =
        await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );


      // Guardar nombre del usuario
      await updateProfile(
        resultado.user,
        {
          displayName: nombre
        }
      );


      await finalizarLogin(
        resultado.user
      );


      return resultado.user;

    } catch (error) {

      console.error(
        "[FitAI Firebase] Registro:",
        error
      );

      mensaje(
        traducirError(error)
      );

      throw error;
    }
  };


// ============================================================
// RECUPERAR CONTRASEÑA
// ============================================================

window.recuperarFirebase =
  async function (email) {

    if (!auth) {

      throw new Error(
        "Firebase todavía no está disponible."
      );
    }

    try {

      await sendPasswordResetEmail(
        auth,
        email
      );

      return true;

    } catch (error) {

      console.error(
        "[FitAI Firebase] Recuperación:",
        error
      );

      throw error;
    }
  };


// ============================================================
// CERRAR SESIÓN
// ============================================================

window.cerrarSesionFirebase =
  async function () {

    try {

      if (auth) {
        await signOut(auth);
      }

    } catch (error) {

      console.error(
        "[FitAI Firebase] Cerrar sesión:",
        error
      );

    } finally {

      eliminarStorage("fitai_auth");
      eliminarStorage("fitai_usuario");
      eliminarStorage("fitai_token");

      window.dispatchEvent(
        new CustomEvent(
          "fitai-auth-change",
          {
            detail: null
          }
        )
      );

      mostrarUsuario(null);
    }
  };


// ============================================================
// RESULTADO DE GOOGLE REDIRECT
// ============================================================

if (auth) {

  getRedirectResult(auth)
    .then(resultado => {

      if (resultado?.user) {

        finalizarLogin(
          resultado.user
        );

      }

    })
    .catch(error => {

      console.warn(
        "[FitAI Firebase] Resultado OAuth:",
        error
      );

    });


  // ==========================================================
  // CAMBIOS DE SESIÓN
  // ==========================================================

  onAuthStateChanged(
    auth,
    user => {

      if (user) {

        const datos =
          guardarSesion(user);

        mostrarUsuario(datos);

      } else {

        mostrarUsuario(null);

      }

    }
  );
}


// ============================================================
// PROMESA DE INICIALIZACIÓN
// ============================================================

window.firebaseAuthReady =
  Promise.resolve(auth);


// ============================================================
// DIAGNÓSTICO
// ============================================================

console.log(
  "[FitAI Firebase] firebaseConfigured:",
  window.firebaseConfigured
);

console.log(
  "[FitAI Firebase] recuperarFirebase:",
  typeof window.recuperarFirebase
);

console.log(
  "[FitAI Firebase] firebaseAuthReady:",
  window.firebaseAuthReady
);