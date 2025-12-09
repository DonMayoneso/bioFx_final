document.addEventListener("submit", async (ev) => {
  const form = ev.target.closest("#loginForm");
  if (!form) return; // no es el formulario de login
  ev.preventDefault();

  const emailEl = form.querySelector('input[type="email"], input[name="email"]');
  const passEl = form.querySelector('input[type="password"], input[name="password"]');
  const submitBtn = form.querySelector('button[type="submit"], .btn');

  const email = emailEl?.value?.trim();
  const password = passEl?.value ?? "";
  if (!email || !password) {
    const errBox = document.getElementById("loginError");
    if (errBox) {
      errBox.textContent = "Ingresa correo y contraseña.";
      errBox.classList.remove("hidden");
    }
    return;
  }

  const errBox = document.getElementById("loginError");
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
    window.Snackbar?.success("Has iniciado sesión.");
  } catch (err) {
    if (err.status === 401) setErr("Correo o contraseña no válidas.");
    else if (err.status === 403) setErr("Cuenta bloqueada temporalmente. Intenta más tarde.");
    else if ((err.message || "").toLowerCase().includes("confirma"))
      setErr("Debes confirmar tu correo antes de iniciar sesión.");
    else setErr(err.message || "No se pudo iniciar sesión.");
    console.error(err);
  } finally {
    submitBtn && (submitBtn.disabled = false);
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
