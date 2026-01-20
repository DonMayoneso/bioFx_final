document.addEventListener("submit", async (ev) => {
  const form = ev.target.closest("#loginForm");
  if (!form) return;
  ev.preventDefault();

  const emailEl = form.querySelector('input[type="email"], input[name="email"]');
  const passEl = form.querySelector('input[type="password"], input[name="password"]');
  const submitBtn = form.querySelector('button[type="submit"], .btn');
  const errBox = document.getElementById("loginError");

  const email = emailEl?.value?.trim();
  const password = passEl?.value ?? "";
  if (!email || !password) {
    if (errBox) {
      errBox.textContent = "Ingresa correo y contraseña.";
      errBox.classList.remove("hidden");
    }
    return;
  }

  const setErr = (m) => {
    if (errBox) {
      errBox.textContent = m || "";
      errBox.classList.toggle("hidden", !m);
    }
  };

  submitBtn && (submitBtn.disabled = true);  

  try {
    await window.api.login(email, password);
    await pintarUsuarioEnHeader();

    const lm = document.getElementById("loginModal");
    if (lm) lm.style.display = "none";

    form.reset();
    setErr(""); // limpia
    // Limpia el bloque de acciones si existe
    const existingBox = document.getElementById("loginVerifyActions");
    if (existingBox) {
      existingBox.innerHTML = "";
      existingBox.classList.add("hidden");
    }

    window.Snackbar?.success?.("Has iniciado sesión.");
  } catch (err) {
    const status = err?.status;
    const data = err?.data;
    const message = err?.message || String(err || "Error");

    const ensureActionsBox = () => {
      let box = document.getElementById("loginVerifyActions");
      if (!box) {
        box = document.createElement("div");
        box.id = "loginVerifyActions";
        box.className = "login-verify-actions";
        if (errBox && errBox.parentNode) {
          errBox.parentNode.insertBefore(box, errBox.nextSibling);
        } else {
          // fallback: lo agrega al final del form si no encuentra errBox
          form.appendChild(box);
        }
      }
      box.innerHTML = "";
      box.classList.remove("hidden");
      return box;
    };

    const clearActionsBox = () => {
      const box = document.getElementById("loginVerifyActions");
      if (box) {
        box.innerHTML = "";
        box.classList.add("hidden");
      }
    };

    // Caso especial: email no confirmado (viene del backend como 401 + action)
    if (status === 401 && data?.action === "EMAIL_NOT_CONFIRMED") {
      const resendAction = data?.resendAction;
      const canResend = Boolean(data?.canResend);
      const cooldownSeconds = Number(data?.cooldownSeconds || 0);
      const expiresAtUtc = data?.expiresAtUtc;

      let uiMsg = data?.message || "Por favor, confirma tu correo antes de iniciar sesión.";

      if (resendAction === "RESENT")
        uiMsg = "Tu correo no está confirmado. Te reenviamos el enlace de verificación.";
      if (resendAction === "TOKEN_STILL_VALID")
        uiMsg =
          "Tu correo no está confirmado. Ya tienes un enlace vigente. Revisa tu bandeja de entrada.";
      if (resendAction === "COOLDOWN")
        uiMsg =
          "Tu correo no está confirmado. Ya se envió un enlace recientemente. Revisa tu correo.";
      if (resendAction === "DAILY_LIMIT")
        uiMsg =
          "Tu correo no está confirmado. Alcanzaste el límite diario de reenvíos. Intenta más tarde.";
      if (resendAction === "SEND_FAILED")
        uiMsg = "Tu correo no está confirmado. No se pudo reenviar el enlace en este momento.";

      setErr(uiMsg);

      const box = ensureActionsBox();

      // Cooldown UI simple
      if (cooldownSeconds > 0) {
        const p = document.createElement("p");
        p.id = "loginCooldownText";
        p.textContent = `Espera ${cooldownSeconds} segundos para volver a intentar reenviar.`;
        box.appendChild(p);

        let remaining = cooldownSeconds;
        const interval = setInterval(() => {
          remaining -= 1;
          const el = document.getElementById("loginCooldownText");
          if (!el) {
            clearInterval(interval);
            return;
          }
          if (remaining <= 0) {
            el.textContent = "Ya puedes intentar reenviar el correo.";
            clearInterval(interval);
          } else {
            el.textContent = `Espera ${remaining} segundos para volver a intentar reenviar.`;
          }
        }, 1000);
      }

      // Expiración (si viene)
      if (expiresAtUtc) {
        const p = document.createElement("p");
        p.className = "muted";
        p.textContent = `Enlace vigente hasta: ${expiresAtUtc}`;
        box.appendChild(p);
      }

      // Botón reenviar (si backend lo permite)
      if (canResend) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-primary";
        btn.textContent = "Reenviar correo de verificación";

        btn.addEventListener("click", async () => {
          btn.disabled = true;
          try {
            await window.api.resendVerification(email);
            setErr("Te enviamos un nuevo correo de verificación. Revisa tu bandeja de entrada.");
            window.Snackbar?.success?.("Correo de verificación reenviado.");
          } catch (e2) {
            setErr(e2?.message || String(e2 || "No se pudo reenviar el correo en este momento."));
          } finally {
            btn.disabled = false;
          }
        });

        box.appendChild(btn);
      } else {
        // si no puede reenviar, igual limpia botones/acciones previas
        // pero mantiene el mensaje.
      }

      return; // evita caer al error genérico
    }

    // Error normal
    clearActionsBox();
    setErr(message); // <= reemplaza el setErr(err) original
  } finally {
    submitBtn && (submitBtn.disabled = false); // ✅ déjalo
  }
});

// Helpers de UI compartidos
async function pintarUsuarioEnHeader() {
  try {
    const perfil = await window.api.getMiPerfil();
    if (!perfil) {
      // <- sin sesión: no marques auth
      limpiarHeader();
      return;
    }

    const name =
      [perfil?.nombre ?? perfil?.Nombre, perfil?.apellido ?? perfil?.Apellido]
        .filter(Boolean)
        .join(" ") || "Usuario";
    const email = perfil?.email ?? perfil?.Email ?? "";

    const headerNameEl = document.querySelector("#profileHeader, [data-user-name]");
    if (headerNameEl) headerNameEl.textContent = name;

    const headerEmailEl = document.querySelector("#profileEmail, [data-user-email]");
    if (headerEmailEl) headerEmailEl.textContent = email;

    document.documentElement.classList.add("auth-ok");
    document.querySelector("[data-user-icon]")?.classList.add("is-auth");
  } catch {
    limpiarHeader();
  }
}

function limpiarHeader() {
  const headerName = document.querySelector("#profileHeader, [data-user-name]");
  if (headerName) headerName.textContent = "Invitado";
  const headerEmail = document.querySelector("#profileEmail, [data-user-email]");
  if (headerEmail) headerEmail.textContent = "";
  document.documentElement.classList.remove("auth-ok");
  const userIcon = document.querySelector("[data-user-icon]");
  if (userIcon) userIcon.classList.remove("is-auth");
}

// Botón logout global
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.querySelector("[data-logout]");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await window.api.logout();
      } catch {}
      limpiarHeader();
    });
  }
});

// Cargar estado al entrar a cualquier página
document.addEventListener("DOMContentLoaded", pintarUsuarioEnHeader);
