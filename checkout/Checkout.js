// Verificar si estamos en un entorno con restricciones de almacenamiento
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

// Variables para descuentos
let descuentos = {
  porReceta: 0, // 2% por receta médica
  porMonto: 0, // Descuento automático por monto
};

// CONFIGURACIÓN DE DESCUENTOS - AQUÍ PUEDES MODIFICAR LOS VALORES
const configDescuentos = {
  montoMinimo: 50, // CAMBIA ESTE VALOR: Monto mínimo para aplicar descuento automático
  descuentoMonto: 5, // CAMBIA ESTE VALOR: Valor del descuento automático
};

// Inicialización del checkout
document.addEventListener("DOMContentLoaded", function () {
  console.log("Iniciando checkout...");
  console.log("URL actual:", window.location.href);
  console.log("Origen:", window.location.origin);
  console.log("User Agent:", navigator.userAgent);
  console.log("LocalStorage disponible:", typeof Storage !== "undefined");

  // Mostrar mensaje de carga
  const loadingElement = document.getElementById("loadingCart");
  if (loadingElement) {
    loadingElement.style.display = "block";
  }

  // Verificar disponibilidad de almacenamiento
  const almacenamientoDisponible = verificarAlmacenamiento();
  if (!almacenamientoDisponible) {
    console.log("Usando métodos alternativos de almacenamiento");
  }

  // Cargar el resumen del pedido
  cargarResumenPedido();

  // Ocultar loading después de cargar
  if (loadingElement) {
    loadingElement.style.display = "none";
  }

  // Configurar la subida de archivos
  configurarSubidaArchivos();

  // Configurar el envío del formulario
  document.getElementById("checkoutForm").addEventListener("submit", procesarCheckout);

  // Configurar botón de cancelar
  document.getElementById("cancelCheckout").addEventListener("click", function () {
    if (confirm("¿Estás seguro de que deseas cancelar tu compra?")) {
      // Limpiar datos de checkout
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

  // 2. Intentar desde localStorage
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

  // 3. Intentar desde sessionStorage
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
                <img src="${item.imagen}" alt="${
      item.nombre
    }" onerror="this.src='../assets/productos/imgtest.jpg'">
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

  // Calcular descuentos y total
  calcularDescuentosYTotal(subtotal);
}

// Nueva función para calcular descuentos y total CORREGIDA
function calcularDescuentosYTotal(subtotal) {
  const shipping = 5.0;

  // Aplicar descuento automático por monto
  if (subtotal >= configDescuentos.montoMinimo && descuentos.porMonto === 0) {
    descuentos.porMonto = configDescuentos.descuentoMonto;
    mostrarNotificacionToast(
      `¡Descuento de $${configDescuentos.descuentoMonto} aplicado por compra mayor a $${configDescuentos.montoMinimo}!`,
      "success"
    );
  } else if (subtotal < configDescuentos.montoMinimo && descuentos.porMonto > 0) {
    descuentos.porMonto = 0;
  }

  // Calcular descuento total
  const descuentoTotal = descuentos.porReceta + descuentos.porMonto;

  // Calcular total CORREGIDO: subtotal + shipping - descuentoTotal
  const total = Math.max(0, subtotal + shipping - descuentoTotal);

  console.log("Cálculo de totales:", {
    subtotal,
    shipping,
    descuentoTotal,
    descuentos,
    total,
  });

  // Actualizar elementos HTML
  document.getElementById("subtotal").textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById("discount").textContent = `-$${descuentoTotal.toFixed(2)}`;
  document.getElementById("shipping").textContent = `$${shipping.toFixed(2)}`;
  document.getElementById("total").textContent = `$${total.toFixed(2)}`;
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

  // Resetear descuentos
  descuentos = {
    porReceta: 0,
    porMonto: 0,
  };

  document.getElementById("subtotal").textContent = "$0.00";
  document.getElementById("discount").textContent = "-$0.00";
  document.getElementById("shipping").textContent = "$0.00";
  document.getElementById("total").textContent = "$0.00";
}

// Configurar la subida de archivos
// Configurar la subida de archivos (PDF o imagen)
function configurarSubidaArchivos() {
  const fileInput = document.getElementById("recetaMedica");
  const preview = document.getElementById("uploadPreview");

  if (!fileInput || !preview) return;

  const resetPreview = () => {
    preview.innerHTML = `
      <i class="fas fa-cloud-upload-alt"></i>
      <p>Arrastra un archivo PDF o una imagen aquí o haz clic para seleccionar</p>
    `;
  };

  resetPreview();

  fileInput.addEventListener("change", function () {
    if (this.files && this.files[0]) {
      const file = this.files[0];
      const name = file.name.toLowerCase();
      const type = file.type;

      const isPdf = type === "application/pdf" || name.endsWith(".pdf");

      const isImage =
        type.startsWith("image/") ||
        name.endsWith(".png") ||
        name.endsWith(".jpg") ||
        name.endsWith(".jpeg");

      if (!isPdf && !isImage) {
        mostrarNotificacion(
          "Solo se admiten archivos PDF o imágenes (PNG, JPG, JPEG) para la receta médica.",
          "error"
        );
        this.value = "";
        resetPreview();
        return;
      }

      if (isPdf) {
        preview.innerHTML = `
          <i class="fas fa-file-pdf"></i>
          <p>${file.name}</p>
        `;
      } else if (isImage) {
        const reader = new FileReader();
        reader.onload = function (ev) {
          preview.innerHTML = `
            <img src="${ev.target.result}" alt="Vista previa de receta" style="max-width: 100%; max-height: 200px;">
            <p>${file.name}</p>
          `;
        };
        reader.readAsDataURL(file);
      }
    } else {
      resetPreview();
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

// Función para aplicar descuento por receta médica
function aplicarDescuentoPorReceta() {
  const subtotal = parseFloat(document.getElementById("subtotal").textContent.replace("$", ""));
  descuentos.porReceta = subtotal * 0.02; // 2% de descuento

  // Recalcular totales
  calcularDescuentosYTotal(subtotal);

  mostrarNotificacionToast("¡Descuento del 2% aplicado por subir receta médica!", "success");
}

// Función para remover descuento por receta médica
function removerDescuentoPorReceta() {
  descuentos.porReceta = 0;
  const subtotal = parseFloat(document.getElementById("subtotal").textContent.replace("$", ""));
  calcularDescuentosYTotal(subtotal);
}

const submitBtn = document.getElementById("submitCheckout");
const originalText = submitBtn.innerHTML;
submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
submitBtn.disabled = true;

try {
  const reference = `ORD-${Date.now()}`;
  const description = "Compra BioFX";

  // Capturar campos  del formulario
  const tipoDocumento = document.getElementById("tipoDocumento")?.value || "";
  const numeroDocumento = document.getElementById("numeroDocumento")?.value || "";
  const direccion = document.getElementById("direccion")?.value || "";
  const ciudad = document.getElementById("ciudad")?.value || "";
  const provincia = document.getElementById("provincia")?.value || "";
  const codigoPostal = document.getElementById("codigoPostal")?.value || "";
  const pais = document.getElementById("pais")?.value || "";
  const nombreMedico = document.getElementById("nombreMedico")?.value || "";

  // Normalizar tipoDocumento a algo más "de backend"
  let documentType = "";
  switch ((tipoDocumento || "").toLowerCase()) {
    case "cedula":
      documentType = "CEDULA";
      break;
    case "ruc":
      documentType = "RUC";
      break;
    case "pasaporte":
      documentType = "PASAPORTE";
      break;
    default:
      documentType = tipoDocumento || "";
      break;
  }

  const extraData = {
    documentType,
    documentNumber: numeroDocumento,
    addressLine: direccion,
    city: ciudad,
    province: provincia,
    postalCode: codigoPostal,
    country: pais,
    doctorName: nombreMedico,
  };

  // 1) Crear la orden con los datos completos
  const order = await window.api.createOrderFromCart(reference, description, extraData);
  const orderId = Number(order?.orderId ?? order?.id);

  if (!Number.isFinite(orderId) || orderId <= 0) {
    console.error("Respuesta createOrderFromCart:", order);
    throw new Error("Orden inválida: no se obtuvo un ID");
  }

  // 2) Si el usuario adjuntó receta médica, subirla
  const fileInput = document.getElementById("recetaMedica");
  const hasFile = fileInput && fileInput.files && fileInput.files[0];

  if (hasFile) {
    const file = fileInput.files[0];
    const name = file.name.toLowerCase();
    const type = file.type;

    const isPdf = type === "application/pdf" || name.endsWith(".pdf");

    const isImage =
      type.startsWith("image/") ||
      name.endsWith(".png") ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg");

    if (!isPdf && !isImage) {
      throw new Error(
        "Solo se admiten archivos PDF o imágenes (PNG, JPG, JPEG) para la receta médica."
      );
    }

    await window.api.uploadOrderAttachment(orderId, file);
  }

  // 3) Crear sesión en PlaceToPay
  const returnUrl = `${window.location.origin}/confirmacion_pago/confirmacion_pago.html?orderId=${orderId}`;
  const session = await window.api.createPlacetoPaySession(orderId, returnUrl);

  if (!session?.processUrl) {
    throw new Error("No se pudo crear la sesión de pago");
  }

  // Guardar IDs antes de redirigir
  localStorage.setItem("lastOrderId", String(orderId));
  localStorage.setItem("lastRequestId", String(session.requestId));

  mostrarNotificacion("Redirigiendo a PlaceToPay...", "success");

  window.location.href = session.processUrl;
} catch (err) {
  console.error(err);
  mostrarNotificacion("Error al procesar el pago: " + (err?.message || "desconocido"), "error");
} finally {
  submitBtn.innerHTML = originalText;
  submitBtn.disabled = false;
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

// Mostrar notificación mejorada con toast
function mostrarNotificacionToast(mensaje, tipo = "success") {
  // Crear elemento de notificación
  const notificacion = document.createElement("div");
  notificacion.className = `notification-toast ${tipo}`;
  notificacion.innerHTML = `
        <i class="fas ${tipo === "success" ? "fa-check-circle" : "fa-exclamation-circle"}"></i>
        <div class="message">${mensaje}</div>
    `;

  // Agregar al body
  document.body.appendChild(notificacion);

  // Mostrar con animación
  setTimeout(() => {
    notificacion.classList.add("show");
  }, 10);

  // Ocultar después de 4 segundos
  setTimeout(() => {
    notificacion.classList.remove("show");
    notificacion.classList.add("hiding");

    // Remover del DOM después de la animación
    setTimeout(() => {
      if (document.body.contains(notificacion)) {
        document.body.removeChild(notificacion);
      }
    }, 300);
  }, 4000);
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
