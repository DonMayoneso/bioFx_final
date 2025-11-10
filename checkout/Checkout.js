function verificarAlmacenamiento() {
  try {
    localStorage.setItem("test", "test");
    localStorage.removeItem("test");
    return true;
  } catch (e) {
    console.warn("localStorage no está disponible:", e);
    return false;
  }
}

function resolveImagePath(p) {
  if (!p) return "../assets/productos/placeholder.png";
  if (/^https?:\/\//i.test(p)) return p; // absoluta http(s)
  if (p.startsWith("/")) return p; // absoluta del host
  if (p.startsWith("../")) return p; // ya relativa correcta
  return "../" + p.replace(/^\.?\//, ""); // assets/... -> ../assets/...
}

// Función para calcular checksum
function calcularChecksum(items) {
  let checksum = 0;
  items.forEach((item) => {
    checksum += item.id * item.cantidad + item.precio;
  });
  return checksum % 1000;
}

// Función para validar integridad de los datos del carrito
function validarDatosCarrito(carritoData) {
  if (!carritoData || !carritoData.items || !Array.isArray(carritoData.items)) {
    return false;
  }

  // Verificar checksum si existe
  if (carritoData.checksum) {
    const checksumCalculado = calcularChecksum(carritoData.items);
    if (checksumCalculado !== carritoData.checksum) {
      console.error("Checksum no coincide");
      return false;
    }
  }

  // Verificar que todos los items tengan la estructura correcta
  for (const item of carritoData.items) {
    if (!item.id || !item.nombre || !item.precio || !item.cantidad) {
      return false;
    }
  }

  return true;
}

async function prefillPersonalInfo() {
  let perfil = null;
  try {
    perfil = await window.api.getMiPerfil();
  } catch {
    return;
  }
  if (!perfil) return;

  const setIfEmpty = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!el.value) el.value = val ?? "";
  };

  // nombre y apellido
  setIfEmpty("nombres", String(perfil.nombre ?? "").trim());
  setIfEmpty("apellidos", String(perfil.apellido ?? "").trim());

  // email
  setIfEmpty("email", String(perfil.email ?? "").trim());

  // teléfono: normaliza a dígitos si es ecuatoriano
  const tel = String(perfil.telefono ?? "").replace(/\D+/g, "");
  setIfEmpty("telefono", tel);

  const pais = document.getElementById("pais");
  if (pais && !pais.value) pais.value = "ecuador";
}


async function requireAuthOrReturn() {
  try {
    const perfil = await window.api.getMiPerfil();
    if (perfil) return true;
  } catch {}
  try {
    sessionStorage.removeItem("carritoCheckout");
  } catch {}
  try {
    localStorage.removeItem("carritoCheckout");
  } catch {}
  window.location.replace("../index.html");
  return false;
}

async function requireNonEmptyCartOrReturn() {
  try {
    const cart = await window.api.getMyCart();
    const items = Array.isArray(cart?.Items)
      ? cart.Items
      : Array.isArray(cart?.items)
      ? cart.items
      : [];
    if (items.length > 0) return true;
  } catch {}
  try {
    sessionStorage.removeItem("carritoCheckout");
  } catch {}
  try {
    localStorage.removeItem("carritoCheckout");
  } catch {}
  document.cookie = "carritoCheckout=; max-age=0; path=/";
  window.location.replace("../index.html?m=carrito_vacio");
  return false;
}

// Inicialización del checkout
document.addEventListener("DOMContentLoaded", async function () {
  if (!(await requireAuthOrReturn())) return;
  if (!(await requireNonEmptyCartOrReturn())) return;

  const loadingElement = document.getElementById("loadingCart");
  if (loadingElement) loadingElement.style.display = "block";

  const almacenamientoDisponible = verificarAlmacenamiento();
  if (!almacenamientoDisponible) console.log("Usando métodos alternativos de almacenamiento");

  await prefillPersonalInfo();

  cargarResumenPedido();
  if (loadingElement) loadingElement.style.display = "none";
  configurarSubidaArchivos();
  document.getElementById("checkoutForm").addEventListener("submit", procesarCheckout);
  document.getElementById("cancelCheckout").addEventListener("click", function () {
    if (confirm("¿Estás seguro de que deseas cancelar tu compra?")) {
      localStorage.removeItem("carritoCheckout");
      sessionStorage.removeItem("carritoCheckout");
      document.cookie = "carritoCheckout=; max-age=0; path=/";
      window.location.href = "../index.html";
    }
  });

  // Limpiar validación de documento cuando cambie el tipo
  document.getElementById("tipoDocumento").addEventListener("change", function () {
    const numeroDocumento = document.getElementById("numeroDocumento");
    numeroDocumento.style.borderColor = "";

    const errorElement = document.getElementById("documentoError");
    if (errorElement) {
      errorElement.remove();
    }

    // Limpiar y ajustar el campo según el tipo de documento
    numeroDocumento.value = "";
    if (this.value === "cedula" || this.value === "ruc") {
      numeroDocumento.setAttribute("inputmode", "numeric");
      numeroDocumento.setAttribute("pattern", "[0-9]*");
    } else {
      numeroDocumento.removeAttribute("inputmode");
      numeroDocumento.removeAttribute("pattern");
    }
  });

  // Limpiar validación de documento cuando se escriba
  document.getElementById("numeroDocumento").addEventListener("input", function () {
    this.style.borderColor = "";

    const errorElement = document.getElementById("documentoError");
    if (errorElement) {
      errorElement.remove();
    }
  });

  // Validación en tiempo real para el número de documento
  document.getElementById("numeroDocumento").addEventListener("input", function (e) {
    const tipoDocumento = document.getElementById("tipoDocumento").value;
    let valor = this.value;

    // Solo permitir números para cédula y RUC
    if (tipoDocumento === "cedula" || tipoDocumento === "ruc") {
      valor = valor.replace(/\D/g, "");
      this.value = valor;
    }

    // Limitar longitud según el tipo
    if (tipoDocumento === "cedula" && valor.length > 10) {
      this.value = valor.slice(0, 10);
    } else if (tipoDocumento === "ruc" && valor.length > 13) {
      this.value = valor.slice(0, 13);
    }
  });

  // Ayuda contextual para el campo de médico
  const nombreMedico = document.getElementById("nombreMedico");
  if (nombreMedico) {
    nombreMedico.addEventListener("focus", function () {
      const disclaimer = this.parentNode.querySelector(".disclaimer-medico");
      if (disclaimer) {
        disclaimer.style.fontWeight = "bold";
      }
    });

    nombreMedico.addEventListener("blur", function () {
      const disclaimer = this.parentNode.querySelector(".disclaimer-medico");
      if (disclaimer) {
        disclaimer.style.fontWeight = "normal";
      }

      // Auto-completar con "NA" si está vacío
      if (!this.value.trim()) {
        this.value = "NA";
      }
    });
  }
});

// Cargar resumen del pedido desde múltiples fuentes
function cargarResumenPedido() {
  let carritoData = null;
  let fuente = "";

  console.log("Buscando datos del carrito...");

  // 1. Intentar desde parámetros URL primero (para entornos restrictivos)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const carritoParam = urlParams.get("carrito");
    if (carritoParam) {
      carritoData = JSON.parse(decodeURIComponent(carritoParam));
      if (validarDatosCarrito(carritoData)) {
        fuente = "URL";
        console.log("Carrito cargado desde parámetros URL");
      } else {
        carritoData = null;
        console.log("Datos de URL no válidos");
      }
    }
  } catch (e) {
    console.error("Error al leer parámetros URL:", e);
  }

  // 2. Intentar desde sessionStorage
  if (!carritoData) {
    try {
      const sessionData = sessionStorage.getItem("carritoCheckout");
      if (sessionData) {
        const parsedData = JSON.parse(sessionData);
        if (
          (!parsedData.origin || parsedData.origin === window.location.origin) &&
          validarDatosCarrito(parsedData)
        ) {
          carritoData = parsedData;
          fuente = "sessionStorage";
          console.log("Carrito cargado desde sessionStorage");
        }
      }
    } catch (e) {
      console.error("Error al leer sessionStorage:", e);
    }
  }

  // 3. Intentar desde localStorage
  if (!carritoData) {
    try {
      const localData = localStorage.getItem("carritoCheckout");
      if (localData) {
        const parsedData = JSON.parse(localData);
        // Verificar que los datos vengan del mismo origen y sean válidos
        if (
          (!parsedData.origin || parsedData.origin === window.location.origin) &&
          validarDatosCarrito(parsedData)
        ) {
          carritoData = parsedData;
          fuente = "localStorage";
          console.log("Carrito cargado desde localStorage");
        }
      }
    } catch (e) {
      console.error("Error al leer localStorage:", e);
    }
  }

  // 4. Intentar desde cookies
  if (!carritoData) {
    try {
      const cookieValue = document.cookie
        .split("; ")
        .find((row) => row.startsWith("carritoCheckout="))
        ?.split("=")[1];

      if (cookieValue) {
        const parsedData = JSON.parse(decodeURIComponent(cookieValue));
        if (
          (!parsedData.origin || parsedData.origin === window.location.origin) &&
          validarDatosCarrito(parsedData)
        ) {
          carritoData = parsedData;
          fuente = "cookie";
          console.log("Carrito cargado desde cookies");
        }
      }
    } catch (e) {
      console.error("Error al leer cookies:", e);
    }
  }

  console.log("Datos del carrito cargados desde:", fuente);

  // Verificar si los datos son válidos y recientes (menos de 5 minutos)
  const ahora = new Date().getTime();
  if (
    !carritoData ||
    !carritoData.items ||
    !Array.isArray(carritoData.items) ||
    (carritoData.timestamp && ahora - carritoData.timestamp > 300000) ||
    !validarDatosCarrito(carritoData)
  ) {
    console.log("Datos del carrito no válidos o expirados");
    mostrarCarritoVacio();
    return;
  }

  const carrito = carritoData.items;
  const summaryItems = document.getElementById("summaryItems");
  const subtotalElement = document.getElementById("subtotal");
  const totalElement = document.getElementById("total");

  if (carrito.length === 0) {
    mostrarCarritoVacio();
    return;
  }

  // Calcular totales
  let subtotal = 0;
  let html = "";

  carrito.forEach((item) => {
    const itemTotal = item.precio * item.cantidad;
    subtotal += itemTotal;

    html += `
        <div class="summary-item">
            <img src="${resolveImagePath(item.imagen)}"
                alt="${item.nombre}"
                onerror="this.onerror=null; this.src='../assets/productos/imgtest.jpg'">
            <div class="summary-item-info">
            <div class="summary-item-name">${item.nombre}</div>
            <div class="summary-item-details">
                <span>${item.cantidad} x $${item.precio.toFixed(2)}</span>
                <span>$${itemTotal.toFixed(2)}</span>
            </div>
            </div>
        </div>
        `;
  });

  summaryItems.innerHTML = html;

  // Calcular envío y total
  const shipping = 5.0;
  const total = subtotal + shipping;

  subtotalElement.textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById("shipping").textContent = `$${shipping.toFixed(2)}`;
  totalElement.textContent = `$${total.toFixed(2)}`;
}

// Función auxiliar para mostrar carrito vacío
function mostrarCarritoVacio() {
  const summaryItems = document.getElementById("summaryItems");
  summaryItems.innerHTML = `
    <p class="empty">No hay productos en tu carrito</p>
    <div style="text-align: center; margin-top: 20px;">
        <a href="../index.html" class="btn btn-primary">Volver a la tienda</a>
    </div>
    `;

  document.getElementById("subtotal").textContent = "$0.00";
  document.getElementById("shipping").textContent = "$0.00";
  document.getElementById("total").textContent = "$0.00";
}

// Configurar la subida de archivos
function configurarSubidaArchivos() {
  const fileInput = document.getElementById("recetaMedica");
  const preview = document.getElementById("uploadPreview");

  if (!fileInput || !preview) return;

  fileInput.addEventListener("change", function (e) {
    if (this.files && this.files[0]) {
      const reader = new FileReader();

      reader.onload = function (e) {
        preview.innerHTML = `
                    <img src="${e.target.result}" alt="Vista previa de receta" style="max-width: 100%; max-height: 200px;">
                    <p>${fileInput.files[0].name}</p>
                `;
      };

      reader.readAsDataURL(this.files[0]);
    }
  });

  // Permitir arrastrar y soltar
  preview.addEventListener("dragover", function (e) {
    e.preventDefault();
    this.style.borderColor = "var(--accent)";
    this.style.backgroundColor = "rgba(46, 177, 152, 0.1)";
  });

  preview.addEventListener("dragleave", function (e) {
    e.preventDefault();
    this.style.borderColor = "";
    this.style.backgroundColor = "";
  });

  preview.addEventListener("drop", function (e) {
    e.preventDefault();
    this.style.borderColor = "";
    this.style.backgroundColor = "";

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      fileInput.files = e.dataTransfer.files;
      const event = new Event("change");
      fileInput.dispatchEvent(event);
    }
  });

  // Hacer que el área de preview sea clickeable
  preview.addEventListener("click", function () {
    fileInput.click();
  });
}

// Procesar el checkout
function procesarCheckout(e) {
  e.preventDefault();

  // Validar formulario
  if (!validarFormulario()) {
    mostrarNotificacion("Por favor, completa todos los campos obligatorios", "error");
    return;
  }

  // Mostrar loading
  const submitBtn = document.getElementById("submitCheckout");
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
  submitBtn.disabled = true;

  // Simular procesamiento (en una implementación real, aquí se conectaría con PlaceToPay)
  setTimeout(() => {
    // Guardar información del pedido
    const formData = new FormData(document.getElementById("checkoutForm"));

    // Obtener datos del carrito
    let cartData = null;
    try {
      const localData = localStorage.getItem("carritoCheckout");
      if (localData) {
        cartData = JSON.parse(localData);
      }
    } catch (e) {
      console.error("Error al obtener datos del carrito:", e);
    }

    const orderData = {
      customer: {
        nombres: formData.get("nombres"),
        apellidos: formData.get("apellidos"),
        tipoDocumento: formData.get("tipoDocumento"),
        numeroDocumento: formData.get("numeroDocumento"),
        email: formData.get("email"),
        telefono: formData.get("telefono"),
        whatsapp: formData.get("whatsapp"),
      },
      medico: formData.get("nombreMedico"),
      shipping: {
        direccion: formData.get("direccion"),
        ciudad: formData.get("ciudad"),
        provincia: formData.get("provincia"),
        codigoPostal: formData.get("codigoPostal"),
        pais: formData.get("pais"),
      },
      cart: cartData ? cartData.items : [],
      timestamp: new Date().toISOString(),
    };

    localStorage.setItem("orderData", JSON.stringify(orderData));

    // Aquí iría la integración con PlaceToPay
    // Por ahora, simulamos una redirección
    mostrarNotificacion("¡Pedido procesado con éxito! Redirigiendo a PlaceToPay...", "success");

    // Limpiar carrito después de la compra
    setTimeout(() => {
      localStorage.removeItem("carrito");
      localStorage.removeItem("carritoCheckout");
      sessionStorage.removeItem("carritoCheckout");
      document.cookie = "carritoCheckout=; max-age=0; path=/";
      window.location.href = "../index.html"; // En una implementación real, redirigir a PlaceToPay
    }, 2000);
  }, 2000);
}

// Validar formulario
function validarFormulario() {
  const requiredFields = document.querySelectorAll("#checkoutForm [required]");
  let isValid = true;

  requiredFields.forEach((field) => {
    if (!field.value.trim()) {
      field.style.borderColor = "var(--danger)";
      isValid = false;

      // Remover el estilo cuando el usuario comience a escribir
      field.addEventListener("input", function () {
        this.style.borderColor = "";
      });
    }
  });

  // Validar email
  const emailField = document.getElementById("email");
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailField.value && !emailRegex.test(emailField.value)) {
    emailField.style.borderColor = "var(--danger)";
    isValid = false;

    emailField.addEventListener("input", function () {
      if (emailRegex.test(this.value)) {
        this.style.borderColor = "";
      }
    });
  }

  // Validar número de documento según el tipo
  const tipoDocumento = document.getElementById("tipoDocumento").value;
  const numeroDocumento = document.getElementById("numeroDocumento").value;

  if (tipoDocumento && numeroDocumento) {
    let valido = true;
    let mensajeError = "";

    if (tipoDocumento === "cedula") {
      const regexCedula = /^\d{10}$/;
      if (!regexCedula.test(numeroDocumento)) {
        valido = false;
        mensajeError = "La cédula debe tener exactamente 10 dígitos numéricos";
      }
    } else if (tipoDocumento === "ruc") {
      const regexRuc = /^\d{13}$/;
      if (!regexRuc.test(numeroDocumento)) {
        valido = false;
        mensajeError = "El RUC debe tener exactamente 13 dígitos numéricos";
      }
    }
    // Pasaporte no tiene restricciones

    if (!valido) {
      document.getElementById("numeroDocumento").style.borderColor = "var(--danger)";

      // Mostrar mensaje de error
      let errorElement = document.getElementById("documentoError");
      if (!errorElement) {
        errorElement = document.createElement("div");
        errorElement.id = "documentoError";
        errorElement.className = "error-message";
        document.getElementById("numeroDocumento").parentNode.appendChild(errorElement);
      }
      errorElement.textContent = mensajeError;

      isValid = false;
    }
  }

  // Validar nombre del médico
  const nombreMedico = document.getElementById("nombreMedico");
  if (nombreMedico && !nombreMedico.value.trim()) {
    nombreMedico.style.borderColor = "var(--danger)";
    isValid = false;

    // Remover el estilo cuando el usuario comience a escribir
    nombreMedico.addEventListener("input", function () {
      this.style.borderColor = "";
    });
  }

  return isValid;
}

// Mostrar notificación
function mostrarNotificacion(mensaje, tipo = "success") {
  const notificacion = document.createElement("div");
  notificacion.className = `notificacion ${tipo}`;
  notificacion.innerHTML = `
        <i class="fas ${tipo === "success" ? "fa-check-circle" : "fa-exclamation-circle"}"></i>
        <span>${mensaje}</span>
    `;

  // Estilos para la notificación
  notificacion.style.position = "fixed";
  notificacion.style.top = "20px";
  notificacion.style.right = "20px";
  notificacion.style.left = "20px";
  notificacion.style.maxWidth = "400px";
  notificacion.style.margin = "0 auto";
  notificacion.style.padding = "15px 20px";
  notificacion.style.borderRadius = "6px";
  notificacion.style.backgroundColor = tipo === "success" ? "var(--success)" : "var(--danger)";
  notificacion.style.color = "white";
  notificacion.style.boxShadow = "0 5px 15px rgba(0, 0, 0, 0.15)";
  notificacion.style.zIndex = "10000";
  notificacion.style.display = "flex";
  notificacion.style.alignItems = "center";
  notificacion.style.gap = "10px";
  notificacion.style.opacity = "0";
  notificacion.style.transform = "translateY(-20px)";
  notificacion.style.transition = "all 0.3s ease";

  document.body.appendChild(notificacion);

  // Mostrar
  setTimeout(() => {
    notificacion.style.opacity = "1";
    notificacion.style.transform = "translateY(0)";
  }, 10);

  // Ocultar después de 3 segundos
  setTimeout(() => {
    notificacion.style.opacity = "0";
    notificacion.style.transform = "translateY(-20px)";
    setTimeout(() => {
      document.body.removeChild(notificacion);
    }, 300);
  }, 3000);
}

// Funciones de respaldo con IndexedDB
function guardarEnIndexedDB(carritoData) {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject("IndexedDB no soportado");
      return;
    }

    const request = indexedDB.open("CarritoDB", 1);

    request.onerror = function (event) {
      reject("Error al abrir la base de datos");
    };

    request.onsuccess = function (event) {
      const db = event.target.result;
      const transaction = db.transaction(["carrito"], "readwrite");
      const store = transaction.objectStore("carrito");

      const putRequest = store.put(carritoData, "carritoActual");

      putRequest.onsuccess = function () {
        resolve("Datos guardados en IndexedDB");
      };

      putRequest.onerror = function () {
        reject("Error al guardar en IndexedDB");
      };
    };

    request.onupgradeneeded = function (event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("carrito")) {
        db.createObjectStore("carrito");
      }
    };
  });
}

function cargarDesdeIndexedDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject("IndexedDB no soportado");
      return;
    }

    const request = indexedDB.open("CarritoDB", 1);

    request.onerror = function (event) {
      reject("Error al abrir la base de datos");
    };

    request.onsuccess = function (event) {
      const db = event.target.result;
      const transaction = db.transaction(["carrito"], "readonly");
      const store = transaction.objectStore("carrito");

      const getRequest = store.get("carritoActual");

      getRequest.onsuccess = function () {
        resolve(getRequest.result);
      };

      getRequest.onerror = function () {
        reject("Error al cargar desde IndexedDB");
      };
    };
  });
}
