const costoEnvio = 3.5;
const totalParaDescuentoEnvio = 50.0;

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
  if (!p) return "../assets/productos/placeholder.webp";
  if (/^https?:\/\//i.test(p)) return p; // absoluta http(s)
  if (p.startsWith("/")) return p; // absoluta del host
  if (p.startsWith("../")) return p; // ya relativa correcta
  return "../" + p.replace(/^\.?\//, ""); // assets/... -> ../assets/...
}

// Función para calcular checksum
function calcularChecksum(items) {
  let checksum = 0;
  items.forEach((item) => {
    const p = Number(item.precioBase ?? item.precio ?? 0);
    checksum += item.id * item.cantidad + p;
  });
  return checksum % 1000;
}

// Función para validar integridad de los datos del carrito
function validarDatosCarrito(carritoData) {
  if (!carritoData || !carritoData.items || !Array.isArray(carritoData.items)) return false;

  if (carritoData.checksum) {
    const checksumCalculado = calcularChecksum(carritoData.items);
    if (checksumCalculado !== carritoData.checksum) return false;
  }

  for (const item of carritoData.items) {
    const p = Number(item.precioBase ?? item.precio ?? NaN);
    const precioOk = Number.isFinite(p) && p >= 0;

    const qty = Number(item.cantidad ?? item.quantity ?? NaN);
    const qtyOk = Number.isFinite(qty) && qty > 0;

    if (!item.id || !item.nombre || !precioOk || !qtyOk) return false;
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

    // --- NUEVA LÓGICA DE BLOQUEO POR PAGOS PENDIENTES ---
    // Verificamos si hay órdenes en curso antes de dejar cargar el checkout
    try {
      const orders = await window.api.getMyOrdersHistory();
      if (orders && Array.isArray(orders)) {
        // Estados que BLOQUEAN una nueva compra
        const blockingStatuses = ["PENDING", "PENDIENTE", "PENDING_VALIDATION"];
        
        const hasActiveOrder = orders.some(order => {
           const s = (order.status || order.paymentStatus || "").toUpperCase();
           return blockingStatuses.includes(s);
        });

        if (hasActiveOrder) {
           // Si hay una orden activa, lanzamos error para caer en el catch y redirigir
           console.warn("Bloqueo: Existe una transacción pendiente o en validación.");
           alert("Tienes una transacción en proceso. Por favor espera a que finalice.");
           throw new Error("ACTIVE_TRANSACTION_EXISTS");
        }
      }
    } catch (innerErr) {
      // Si el error fue explícitamente porque hay transacción activa, lo propagamos
      if (innerErr.message === "ACTIVE_TRANSACTION_EXISTS") throw innerErr;
      // Si falló la API de historial, permitimos continuar (fail-open) o bloqueamos según preferencia.
      // Por usabilidad, solemos dejar pasar si es error de conexión, pero aquí solo logueamos.
      console.warn("No se pudo verificar historial de órdenes", innerErr);
    }

    // 2) carrito con items
    const cart = await window.api.getMyCart();
    const items = Array.isArray(cart?.Items)
      ? cart.Items
      : Array.isArray(cart?.items)
      ? cart.items
      : [];
    if (!items || items.length === 0) throw new Error("EMPTY_CART");

    return true; // acceso permitido
  } catch (err) {
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

    const inputsSanitizar = [
        { id: "nombres", regex: /[^a-zA-ZáéíóúÁÉÍÓÚñÑ ]/g },
        { id: "apellidos", regex: /[^a-zA-ZáéíóúÁÉÍÓÚñÑ ]/g },
        { id: "direccion", regex: /[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ#,. ]/g },
        { id: "ciudad", regex: /[^a-zA-ZáéíóúÁÉÍÓÚñÑ ]/g },
        { id: "provincia", regex: /[^a-zA-ZáéíóúÁÉÍÓÚñÑ ]/g },
        { id: "codigoPostal", regex: /[^a-zA-Z0-9]/g }
    ];

    inputsSanitizar.forEach(inputObj => {
        const el = document.getElementById(inputObj.id);
        if (el) {
            el.addEventListener("input", function() {
                // Elimina caracteres que coincidan con la regex de exclusión
                this.value = this.value.replace(inputObj.regex, '');
            });
        }
    });

    // --- LÓGICA ESPECÍFICA PARA DOCUMENTOS ---
    const inputDoc = document.getElementById("numeroDocumento");
    const selectTipoDoc = document.getElementById("tipoDocumento");

    if (inputDoc && selectTipoDoc) {
        inputDoc.addEventListener("input", function() {
            const tipo = selectTipoDoc.value;
            let valor = this.value;

            if (tipo === "cedula") {
                // Solo números, max 10
                this.value = valor.replace(/\D/g, '').slice(0, 10);
            } else if (tipo === "ruc") {
                // Solo números, max 13
                this.value = valor.replace(/\D/g, '').slice(0, 13);
            } else if (tipo === "pasaporte") {
                // Alfanumérico (letras y números), sin especiales
                this.value = valor.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            }
        });
  }

  // CAMBIO 3: Validar que el teléfono solo acepte números en tiempo real
  const inputTelefono = document.getElementById("telefono");
  if (inputTelefono) {
    inputTelefono.addEventListener("input", function(e) {
        // Reemplaza cualquier caracter que NO sea dígito por vacío
        this.value = this.value.replace(/\D/g, '');
    });
  }

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

          const cantidad = Number(it.Quantity ?? it.quantity ?? it.Cantidad ?? 0);
          const nombre = String(it.Nombre ?? it.nombre ?? `Producto ${pid}`) || `Producto ${pid}`;
          const imagen = String(it.Imagen ?? it.imagen ?? "");

          // Precio base (sin descuento)
          const rawPriceBase = it.UnitPrice ?? it.unitPrice ?? it.Precio ?? it.price ?? 0;
          const precioBaseNum = Number(String(rawPriceBase).replace(",", "."));
          const precioBase = Number.isFinite(precioBaseNum) ? precioBaseNum : 0;

          // % descuento (entero)
          const rawPct = it.Discount ?? it.discount ?? it.Descuento ?? it.descuento ?? 0;
          const descuentoPctNum = Number(String(rawPct).replace(",", "."));
          const descuentoPct = Number.isFinite(descuentoPctNum) ? descuentoPctNum : 0;

          return { id: pid, nombre, precioBase, descuentoPct, cantidad, imagen };
        })
        .filter((x) => x.cantidad > 0);

      if (items.length > 0) {
        const ahora = Date.now();
        const checksum = items.reduce((acc, x) => acc + x.id * x.cantidad + x.precioBase, 0) % 1000;
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

  if (!carrito.length) {
    mostrarCarritoVacio();
    return;
  }

  let html = "";

  // Normaliza campos para cálculo nuevo
  const itemsCalc = carrito.map((item) => {
    const precioBase = Number(item.precioBase ?? item.precio ?? 0);
    const descuentoPct = Number(
      item.descuentoPct ?? item.descuentoPct ?? item.discountPct ?? item.DiscountPRC ?? 0
    );
    const cantidad = Number(item.cantidad ?? item.quantity ?? 0);

    return {
      ...item,
      precioBase: Number.isFinite(precioBase) ? precioBase : 0,
      descuentoPct: Number.isFinite(descuentoPct) ? descuentoPct : 0,
      cantidad: Number.isFinite(cantidad) ? cantidad : 0,
    };
  });

  itemsCalc.forEach((item) => {
    const itemTotal = item.precioBase * item.cantidad;

    html += `
    <div class="summary-item">
      <img src="${resolveImagePath(item.imagen)}"
           alt="${item.nombre || "Producto " + item.id}"
           onerror="this.onerror=null; this.src='../assets/productos/imgtest.webp'">
      <div class="summary-item-info">
        <div class="summary-item-name">${item.nombre || "Producto " + item.id}</div>
        <div class="summary-item-details">
          <span>${item.cantidad} x $${item.precioBase.toFixed(2)}</span>
          <span>$${itemTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>`;
  });

  summaryItems.innerHTML = html;

  const tieneReceta = getTieneRecetaUI();
  const t = calcularTotalesCheckout(itemsCalc, tieneReceta);
  renderTotalesCheckout(t);
}

function getTieneRecetaUI() {
  const fileInput = document.getElementById("recetaMedica");
  return Boolean(fileInput && fileInput.files && fileInput.files[0]);
}

function calcularTotalesCheckout(items, tieneReceta) {
  const subtotalBase = items.reduce((acc, it) => acc + it.precioBase * it.cantidad, 0);

  const descuentoProductos = items.reduce((acc, it) => {
    return acc + it.precioBase * (it.descuentoPct / 100) * it.cantidad;
  }, 0);

  const subtotalNeto = Math.max(0, subtotalBase - descuentoProductos);
  const shipping = subtotalNeto >= totalParaDescuentoEnvio ? 0 : costoEnvio; 
  const descuentoReceta = tieneReceta ? subtotalNeto * 0.02 : 0;

  const descuentoTotal = descuentoProductos + descuentoReceta;
  const total = Math.max(0, subtotalNeto - descuentoReceta + shipping);

  const r2 = (n) => Math.round(n * 100) / 100;

  return {
    subtotalBase: r2(subtotalBase),
    descuentoTotal: r2(descuentoTotal),
    shipping: r2(shipping),
    total: r2(total),
  };
}

function renderTotalesCheckout(t) {
  document.getElementById("subtotal").textContent = `$${t.subtotalBase.toFixed(2)}`;
  document.getElementById("discount").textContent = `-$${t.descuentoTotal.toFixed(2)}`;
  document.getElementById("shipping").textContent = `$${t.shipping.toFixed(2)}`;
  document.getElementById("total").textContent = `$${t.total.toFixed(2)}`;
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

  fileInput.addEventListener("change", async function () {
    if (this.files && this.files[0]) {
      const file = this.files[0];
      const name = file.name.toLowerCase();
      const type = file.type;

      const isPdf = type === "application/pdf" || name.endsWith(".pdf");

      const isImage =
        type.startsWith("image/") ||
        name.endsWith(".webp") ||
        name.endsWith(".webp") ||
        name.endsWith(".jpeg");

      if (!isPdf && !isImage) {
        mostrarNotificacionToast(
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
    await cargarResumenPedido();
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

  // CAMBIO 4: Manejar el mensaje de error específico retornado por la validación
  const errorValidacion = validarFormulario();
  if (errorValidacion) {
    // Si validarFormulario retorna un string, es el mensaje de error. Si retorna null, todo ok.
    // OJO: validarFormulario devuelve el mensaje de error si falla, o null si éxito.
    mostrarNotificacionToast(errorValidacion, "error");
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

    let documentType = "";
    switch ((tipoDocumento || "").toLowerCase()) {
      case "cedula":
        documentType = "CI";
        break;
      case "ruc":
        documentType = "RUC";
        break;
      case "pasaporte":
        documentType = "PPN";
        break;
      default:
        documentType = tipoDocumento || "";
        break;
    }

    // 2) Si el usuario adjuntó receta médica, subirla
    const fileInput = document.getElementById("recetaMedica");
    const hasFile = fileInput && fileInput.files && fileInput.files[0];

    const extraData = {
      documentType,
      documentNumber: numeroDocumento,
      addressLine: direccion,
      city: ciudad,
      province: provincia,
      postalCode: codigoPostal,
      country: pais,
      doctorName: nombreMedico,
      tieneReceta: Boolean(hasFile),
    };

    const order = await window.api.createOrderFromCart(reference, description, extraData);
    const orderId = Number(order?.orderId ?? order?.id);

    if (!Number.isFinite(orderId) || orderId <= 0) {
      console.error("Respuesta createOrderFromCart:", order);
      throw new Error("Orden inválida: no se obtuvo un ID");
    }

    if (hasFile) {
      const file = fileInput.files[0];
      const name = file.name.toLowerCase();
      const type = file.type;

      const isPdf = type === "application/pdf" || name.endsWith(".pdf");

      const isImage =
        type.startsWith("image/") ||
        name.endsWith(".png") ||
        name.endsWith(".jpg") ||
        name.endsWith(".jpeg") ||
        name.endsWith(".webp");

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

    mostrarNotificacion("Redirigiendo a Placetopay...", "success");

    window.location.href = session.processUrl;
  } catch (err) {
    console.error(err);
    mostrarNotificacionToast(
      "Error al procesar el pago: " + (err?.message || "desconocido"),
      "error"
    );
  } finally {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
}

function validarFormulario() {
  const requiredFields = document.querySelectorAll("#checkoutForm [required]");
  let mensajeError = null;

  // 1. Validar campos vacíos
  for (const field of requiredFields) {
    if (!field.value.trim() && field.type !== 'checkbox') {
        field.style.borderColor = "var(--danger)";
        // Listener para limpiar error
        field.addEventListener("input", function () { this.style.borderColor = ""; }, {once: true});
        if(!mensajeError) mensajeError = "Por favor, completa todos los campos obligatorios";
    }
    // Validar checkboxes requeridos
    if (field.type === 'checkbox' && !field.checked) {
        if(!mensajeError) mensajeError = "Debes aceptar los Términos y Condiciones y la Política de Privacidad para continuar.";
    }
  }

  // Si ya hay error de campos vacíos, retornarlo para no sobrecargar al usuario
  if(mensajeError) return mensajeError;

  // 2. Validar email (CAMBIO: Mensaje específico)
  const emailField = document.getElementById("email");
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailField.value && !emailRegex.test(emailField.value)) {
    emailField.style.borderColor = "var(--danger)";
    emailField.addEventListener("input", function () {
      if (emailRegex.test(this.value)) {
        this.style.borderColor = "";
      }
    });
    return "El formato del correo electrónico no es válido.";
  }

  // Validar número de documento según el tipo
  const tipoDocumento = document.getElementById("tipoDocumento").value;
  const numeroDocumento = document.getElementById("numeroDocumento").value;

  if (tipoDocumento && numeroDocumento) {
    let valido = true;
    let mensajeDoc = "";

    if (tipoDocumento === "cedula") {
      const regexCedula = /^\d{10}$/;
      if (!regexCedula.test(numeroDocumento)) {
        valido = false;
        mensajeDoc = "La cédula debe tener exactamente 10 dígitos numéricos";
      }
    } else if (tipoDocumento === "ruc") {
      const regexRuc = /^\d{13}$/;
      if (!regexRuc.test(numeroDocumento)) {
        valido = false;
        mensajeDoc = "El RUC debe tener exactamente 13 dígitos numéricos";
      }
    }

    if (!valido) {
      document.getElementById("numeroDocumento").style.borderColor = "var(--danger)";

      let errorElement = document.getElementById("documentoError");
      if (!errorElement) {
        errorElement = document.createElement("div");
        errorElement.id = "documentoError";
        errorElement.className = "error-message";
        document.getElementById("numeroDocumento").parentNode.appendChild(errorElement);
      }
      errorElement.textContent = mensajeDoc;

      return mensajeDoc;
    }
  }

  // Validar nombre del médico
  const nombreMedico = document.getElementById("nombreMedico");
  if (nombreMedico && !nombreMedico.value.trim()) {
    nombreMedico.style.borderColor = "var(--danger)";
    nombreMedico.addEventListener("input", function () { this.style.borderColor = ""; }, {once: true});
    return "Por favor, complete la información del médico.";
  }

  return null; // Retorna null si NO hay errores
}

// Mostrar notificación de toda la pantalla
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