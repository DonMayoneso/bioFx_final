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

  for (const item of carritoData.items) {
    const precioOk = Number.isFinite(Number(item.precio)) && Number(item.precio) >= 0;
    if (!item.id || !item.nombre || !precioOk || !Number(item.cantidad)) {
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

async function guardAccessOrRedirectCheckout() {
  try {
    // 1) sesión
    const perfil = await window.api.getMiPerfil();
    if (!perfil) throw new Error("NO_SESSION");

    // 2) carrito con items
    const cart = await window.api.getMyCart(); // crea si no existe
    const items = Array.isArray(cart?.Items)
      ? cart.Items
      : Array.isArray(cart?.items)
      ? cart.items
      : [];
    if (!items || items.length === 0) throw new Error("EMPTY_CART");

    return true; // acceso permitido
  } catch {
    // limpia rastros mínimos y regresa a la tienda
    try {
      sessionStorage.removeItem("carritoCheckout");
    } catch {}
    try {
      localStorage.removeItem("carritoCheckout");
    } catch {}
    document.cookie = "carritoCheckout=; max-age=0; path=/";
    window.location.replace("../index.html");
    return false;
  }
}

// Inicialización del checkout
document.addEventListener("DOMContentLoaded", async function () {
  const ok = await guardAccessOrRedirectCheckout();
  if (!ok) return;

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
async function cargarResumenPedido() {
  let carritoData = null;
  let fuente = "";

  // 1) URL ?carrito=...
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const carritoParam = urlParams.get("carrito");
    if (carritoParam) {
      const parsed = JSON.parse(decodeURIComponent(carritoParam));
      if (validarDatosCarrito(parsed)) {
        carritoData = parsed;
        fuente = "URL";
      }
    }
  } catch {}

  // 2) sessionStorage
  if (!carritoData) {
    try {
      const v = sessionStorage.getItem("carritoCheckout");
      if (v) {
        const parsed = JSON.parse(v);
        if (
          (!parsed.origin || parsed.origin === window.location.origin) &&
          validarDatosCarrito(parsed)
        ) {
          carritoData = parsed;
          fuente = "sessionStorage";
        }
      }
    } catch {}
  }

  // 3) localStorage
  if (!carritoData) {
    try {
      const v = localStorage.getItem("carritoCheckout");
      if (v) {
        const parsed = JSON.parse(v);
        if (
          (!parsed.origin || parsed.origin === window.location.origin) &&
          validarDatosCarrito(parsed)
        ) {
          carritoData = parsed;
          fuente = "localStorage";
        }
      }
    } catch {}
  }

  // 4) cookie
  if (!carritoData) {
    try {
      const cookieValue = document.cookie
        .split("; ")
        .find((row) => row.startsWith("carritoCheckout="))
        ?.split("=")[1];
      if (cookieValue) {
        const parsed = JSON.parse(decodeURIComponent(cookieValue));
        if (
          (!parsed.origin || parsed.origin === window.location.origin) &&
          validarDatosCarrito(parsed)
        ) {
          carritoData = parsed;
          fuente = "cookie";
        }
      }
    } catch {}
  }

  // 5) Fallback desde API
  if (!carritoData) {
    try {
      const apiCart = await window.api.getMyCart();

      const raw =
        (Array.isArray(apiCart?.Items) && apiCart.Items) ||
        (Array.isArray(apiCart?.items) && apiCart.items) ||
        (Array.isArray(apiCart?.Data?.Items) && apiCart.Data.Items) ||
        (Array.isArray(apiCart?.data?.items) && apiCart.data.items) ||
        [];

      const items = raw
        .map((it) => {
          const pid = Number(it.ProductId ?? it.productId ?? it.productID ?? it.pid);

          const rawPrice = it.UnitPrice ?? it.unitPrice ?? it.Precio ?? it.price ?? 0;
          const precioNum = Number(String(rawPrice).replace(",", "."));
          const precio = Number.isFinite(precioNum) ? precioNum : 0;

          const cantidad = Number(it.Quantity ?? it.quantity ?? it.Cantidad ?? 0);
          const nombre = String(it.Nombre ?? it.nombre ?? `Producto ${pid}`) || `Producto ${pid}`;
          const imagen = String(it.Imagen ?? it.imagen ?? "");

          return { id: pid, nombre, precio, cantidad, imagen };
        })
        .filter((x) => x.cantidad > 0);

      if (items.length > 0) {
        const ahora = Date.now();
        const checksum = items.reduce((acc, x) => acc + x.id * x.cantidad + x.precio, 0) % 1000;
        carritoData = { items, origin: window.location.origin, timestamp: ahora, checksum };
        fuente = "api";
        try {
          sessionStorage.setItem("carritoCheckout", JSON.stringify(carritoData));
        } catch {}
      }
    } catch (e) {
      console.warn("No se pudo cargar carrito desde API:", e);
    }
  }

  console.log("Datos del carrito cargados desde:", fuente || "ninguna");

  const ahora = Date.now();
  if (
    !carritoData ||
    !carritoData.items ||
    !Array.isArray(carritoData.items) ||
    (carritoData.timestamp && ahora - carritoData.timestamp > 300000) ||
    !validarDatosCarrito(carritoData)
  ) {
    mostrarCarritoVacio();
    return;
  }

  const carrito = carritoData.items;
  const summaryItems = document.getElementById("summaryItems");
  const subtotalElement = document.getElementById("subtotal");
  const totalElement = document.getElementById("total");

  if (!carrito.length) {
    mostrarCarritoVacio();
    return;
  }

  let subtotal = 0;
  let html = "";

  carrito.forEach((item) => {
    const itemTotal = item.precio * item.cantidad;
    subtotal += itemTotal;
    html += `
      <div class="summary-item">
        <img src="${resolveImagePath(item.imagen)}"
             alt="${item.nombre || "Producto " + item.id}"
             onerror="this.onerror=null; this.src='../assets/productos/imgtest.jpg'">
        <div class="summary-item-info">
          <div class="summary-item-name">${item.nombre || "Producto " + item.id}</div>
          <div class="summary-item-details">
            <span>${item.cantidad} x $${item.precio.toFixed(2)}</span>
            <span>$${itemTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>`;
  });

  summaryItems.innerHTML = html;

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

// Procesar el checkout REAL con PlaceToPay
async function procesarCheckout(e) {
  e.preventDefault();

  if (!validarFormulario()) {
    mostrarNotificacion("Por favor, completa todos los campos obligatorios", "error");
    return;
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
  } catch (err)  {
    console.error(err);
    mostrarNotificacion("Error al procesar el pago: " + (err?.message || "desconocido"), "error");
  } finally {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
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
