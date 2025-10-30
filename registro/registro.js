document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("registerForm");
  const submitButton = form.querySelector(".btn");
  const successMessage = document.getElementById("successMessage");
  const toggleButtons = document.querySelectorAll(".toggle-password");

  // Función para mostrar/ocultar contraseña
  toggleButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const targetId = this.getAttribute("data-target");
      const passwordInput = document.getElementById(targetId);
      const icon = this.querySelector("i");

      if (passwordInput.type === "password") {
        passwordInput.type = "text";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
      } else {
        passwordInput.type = "password";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
      }
    });
  });

  // Validar fortaleza de contraseña en tiempo real
  document.getElementById("password").addEventListener("input", function () {
    const password = this.value;
    const strength = checkPasswordStrength(password);
    updateStrengthIndicator(strength);
    validatePasswords();
  });

  // Validar que las contraseñas coincidan
  document.getElementById("confirmPassword").addEventListener("input", validatePasswords);

  // Validar teléfono en tiempo real
  document.getElementById("telefono").addEventListener("input", function () {
    this.value = this.value.replace(/[^0-9+-\s]/g, "");
  });

  // Manejar envío del formulario
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!validateForm()) return;

    const payload = {
      email: document.getElementById("email").value.trim(),
      password: document.getElementById("password").value,
      nombre: document.getElementById("nombre").value.trim(),
      apellido: document.getElementById("apellido").value.trim(),
      telefono: document.getElementById("telefono").value.trim(),
    };

    submitButton.disabled = true;
    submitButton.textContent = "Creando cuenta...";

    window.Snackbar?.show?.("Creando tu cuenta...", { type: "success", ms: 1500 });

    window.api
      .register(payload)
      .then(() => {
        const emailOut = document.getElementById("successEmail");
        if (emailOut) emailOut.textContent = payload.email;

        form.style.display = "none";
        successMessage.style.display = "block";

        window.Snackbar?.success?.("Cuenta creada. Revisa tu correo para confirmar.");
      })
      .catch((err) => {
        const msg = (err?.message || "").toLowerCase();
        if (err.status === 409 || msg.includes("ya existe")) {
          showError("emailError", "Este correo ya está registrado.");
        } else if (err.status === 400) {
          showError("passwordError", "Revisa los datos ingresados.");
        } else {
          showError("passwordError", "No se pudo crear la cuenta. Intenta más tarde.");
        }
        window.Snackbar?.error?.(err?.message || "Error al registrar.");
      })
      .finally(() => {
        submitButton.disabled = false;
        submitButton.textContent = "Crear Cuenta";
      });
  });

  function validateForm() {
    let isValid = true;

    // Validar nombre
    const nombre = document.getElementById("nombre").value.trim();
    if (!nombre) {
      showError("nombreError", "Por favor ingresa tu nombre");
      isValid = false;
    } else {
      clearError("nombreError");
    }

    // Validar apellido
    const apellido = document.getElementById("apellido").value.trim();
    if (!apellido) {
      showError("apellidoError", "Por favor ingresa tu apellido");
      isValid = false;
    } else {
      clearError("apellidoError");
    }

    // Validar email
    const email = document.getElementById("email").value.trim();
    if (!email) {
      showError("emailError", "Por favor ingresa tu correo electrónico");
      isValid = false;
    } else if (!isValidEmail(email)) {
      showError("emailError", "Por favor ingresa un correo electrónico válido");
      isValid = false;
    } else {
      clearError("emailError");
    }

    // Validar teléfono
    const telefono = document.getElementById("telefono").value.trim();
    if (!telefono) {
      showError("telefonoError", "Por favor ingresa tu número de teléfono");
      isValid = false;
    } else if (telefono.length < 8) {
      showError("telefonoError", "Por favor ingresa un número de teléfono válido");
      isValid = false;
    } else {
      clearError("telefonoError");
    }

    // Validar contraseñas
    if (!validatePasswords()) {
      isValid = false;
    }

    // Validar términos y condiciones
    const terms = document.getElementById("terms").checked;
    if (!terms) {
      showError("termsError", "Debes aceptar los términos y condiciones");
      isValid = false;
    } else {
      clearError("termsError");
    }

    return isValid;
  }

  function validatePasswords() {
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    // Limpiar mensaje de error
    clearError("passwordError");

    // Validar longitud mínima
    if (password.length > 0 && password.length < 8) {
      showError("passwordError", "La contraseña debe tener al menos 8 caracteres");
      return false;
    }

    // Validar coincidencia
    if (confirmPassword && password !== confirmPassword) {
      showError("passwordError", "Las contraseñas no coinciden");
      return false;
    }

    return true;
  }

  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function checkPasswordStrength(password) {
    let strength = 0;

    if (password.length >= 8) strength++;
    if (password.match(/[a-z]+/)) strength++;
    if (password.match(/[A-Z]+/)) strength++;
    if (password.match(/[0-9]+/)) strength++;
    if (password.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/)) strength++;

    return strength;
  }

  function updateStrengthIndicator(strength) {
    const colors = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#27ae60"];
    const texts = ["Muy Débil", "Débil", "Moderada", "Fuerte", "Muy Fuerte"];

    const strengthBar = document.querySelector(".strength-bar");
    const strengthText = document.querySelector(".strength-text");

    strengthBar.style.width = strength * 20 + "%";
    strengthBar.style.backgroundColor = colors[strength - 1] || colors[0];
    strengthText.textContent = "Seguridad: " + (texts[strength - 1] || texts[0]);
  }

  function showError(elementId, message) {
    document.getElementById(elementId).textContent = message;
  }

  function clearError(elementId) {
    document.getElementById(elementId).textContent = "";
  }
});
