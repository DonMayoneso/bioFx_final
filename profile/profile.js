// JavaScript para la funcionalidad del perfil
document.addEventListener("DOMContentLoaded", function () {
  // Navegación entre secciones
  const navLinks = document.querySelectorAll(".nav-link");
  const tabs = document.querySelectorAll(".profile-tabs");
  const homeLink = "../index.html";

  const ordersListEl = document.querySelector("#orders .orders-list");

  function formatOrderDate(isoUtc) {
    if (!isoUtc) return "";
    const fechaSegura = isoUtc.endsWith("Z") ? isoUtc : isoUtc + "Z";
    const d = new Date(fechaSegura);
    const opts = {
      timeZone: "America/Guayaquil",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    };
    return d.toLocaleString("es-EC", opts);
  }

  // Función auxiliar para traducir y estilizar estados
  function getStatusConfig(status) {
    const s = (status || "").toUpperCase();

    switch (s) {
      case "PAID":
      case "APPROVED":
        return {
          label: "Aprobada",
          class: "status-approved",
          icon: "fa-check-circle",
        };
      case "REJECTED":
      case "FAILED":
        return {
          label: "Rechazada",
          class: "status-rejected",
          icon: "fa-times-circle",
        };
      case "PENDING_VALIDATION":
        return {
          label: "Validando Pago",
          class: "status-validation",
          icon: "fa-sync-alt fa-spin",
        };
      case "PENDING":
      case "PENDING_PAYMENT":
        return {
          label: "Pendiente",
          class: "status-pending",
          icon: "fa-clock",
        };
      case "EXPIRED":
        return {
          label: "Expirada",
          class: "status-expired",
          icon: "fa-clock",
        };
      case "CANCELLED":
        return {
          label: "Cancelada",
          class: "status-expired",
          icon: "fa-ban",
        };
      default:
        return {
          label: status || "Desconocido",
          class: "",
          icon: "fa-info-circle",
        };
    }
  }

  function buildOrderCard(order) {
    const card = document.createElement("div");
    card.className = "order-card";

    // 1. Obtener configuración del estado
    const statusRaw = (order.status || order.paymentStatus || "PENDING").toUpperCase();
    const statusConfig = getStatusConfig(statusRaw);

    // 2. Obtener código de autorización
    const authCode =
      order.authorization || order.authorizationCode || order.authCode || null;

    // Aseguramos obtener el ID correcto para los links
    const orderId = order.orderId || order.id; 
    const orderNumber = order.orderNumber || order.reference || `ORD-${orderId}`;
    const dateText = formatOrderDate(order.createdAt);

    const paymentInfoParts = [];
    if (order.paymentMethodName)
      paymentInfoParts.push(order.paymentMethodName);

    if (order.issuerName && statusRaw !== "REJECTED")
      paymentInfoParts.push(order.issuerName);

    const paymentInfo = paymentInfoParts.length
      ? `Pago con ${paymentInfoParts.join(" · ")}`
      : "";
    const hasAttachmentText = order.hasAttachment
      ? "Incluye factura adjunta"
      : "";

    // Construcción de Items
    const itemsHtml = (order.items || [])
      .map(
        (item) => `
        <div class="order-product">
          <img
            src="../${item.productImage}"
            alt="${item.productName}"
            class="order-product-img"
            onerror="this.onerror=null;this.src='../assets/productos/placeholder.png';" 
          />
          <div class="order-product-info">
            <h4>${item.productName}</h4>
            <p>Cantidad: ${item.quantity}</p>
          </div>
          <div class="order-price">$${Number(item.totalPrice).toFixed(2)}</div>
        </div>
      `
      )
      .join("");

    /* -----------------------------------------------------------
       LÓGICA DE BOTONES DE ACCIÓN (CORREGIDO)
       ----------------------------------------------------------- */
    let actionButtonHtml = "";

    // CASO 1: PENDIENTE -> Redirigir a continuar_pago
    if (statusRaw === "PENDING" || statusRaw === "PENDING_PAYMENT") {
       // Estilo inline para diferenciarlo (Amarillo/Naranja)
       actionButtonHtml = `
         <div class="order-actions">
            <a href="../continuar_pago/continuar_pago.html?orderId=${orderId}" 
               class="btn-repeat-order" 
               style="border-color: #f39c12; color: #f39c12;">
               Continuar Pago <i class="fas fa-arrow-right"></i>
            </a>
         </div>
       `;
    } 
    // CASO 2: RECHAZADA -> Redirigir a tienda (index)
    else if (statusRaw === "REJECTED" || statusRaw === "FAILED") {
       actionButtonHtml = `
         <div class="order-actions">
            <a href="../index.html" class="btn-repeat-order">Intentar nuevamente</a>
         </div>
       `;
    }
    // CASO 3: VALIDANDO -> No mostramos botón (el usuario debe esperar)

    // HTML Final de la tarjeta
    card.innerHTML = `
      <div class="order-header">
        <div class="order-header-info">
          <div class="order-id">Pedido #${orderNumber}</div>
          ${dateText ? `<div class="order-date">Realizado el: ${dateText}</div>` : ""}
          
          <div class="order-status-badge ${statusConfig.class}">
            <i class="fas ${statusConfig.icon}"></i>
            ${statusConfig.label}
          </div>

          ${authCode ? `<div style="margin-top:5px; font-size: 0.9em; color: var(--gray);">Cód. Autorización: <span class="auth-code">${authCode}</span></div>` : ""}

          ${paymentInfo ? `<div class="order-payment" style="margin-top:5px; font-size:0.9em;">${paymentInfo}</div>` : ""}
          ${hasAttachmentText ? `<div class="order-invoice" style="margin-top:5px; color: var(--primary);"><i class="fas fa-paperclip"></i> ${hasAttachmentText}</div>` : ""}
        </div>
      </div>

      <div class="order-products">
        ${itemsHtml}
      </div>

      <div class="order-footer">
        <div class="order-total">Total: $${Number(order.totalAmount).toFixed(2)}</div>
        ${actionButtonHtml}
      </div>
    `;

    return card;
  }

  // Función para mostrar alerta superior
  function showPendingAlert(title, message, isValidation = false) {
    if (document.querySelector(".pending-order-alert")) return;

    const container = document.querySelector("#orders");
    const alertDiv = document.createElement("div");

    const cssClass = isValidation
      ? "pending-order-alert validation-mode"
      : "pending-order-alert";
    const iconClass = isValidation
      ? "fa-sync-alt fa-spin"
      : "fa-exclamation-triangle";

    const finalTitle = title || "Pago Pendiente Detectado";
    const finalMsg = message || "Tu banco está procesando una transacción.";

    alertDiv.className = cssClass;
    alertDiv.innerHTML = `
      <i class="fas ${iconClass}"></i>
      <div>
        <strong>${finalTitle}</strong>
        <p style="margin:0; font-size:0.9rem;">${finalMsg}</p>
      </div>
      <div class="pending-actions">
        <button class="btn-check-status" onclick="location.reload()">Actualizar Estado</button>
      </div>
    `;

    const sectionTitle = container.querySelector(".section-title");
    if (sectionTitle) {
      sectionTitle.insertAdjacentElement("afterend", alertDiv);
    }
  }

  async function loadOrdersHistory() {
    if (!ordersListEl) return;
    ordersListEl.innerHTML = `<p class="orders-loading"><i class="fas fa-spinner fa-spin"></i> Cargando tu historial de pedidos...</p>`;

    try {
      const orders = await window.api.getMyOrdersHistory();

      // Permitimos ver Pending Validation, Pending, Paid y Rejected
      const allowedStatuses = ["PAID", "APPROVED", "REJECTED", "FAILED", "PENDING_VALIDATION", "PENDING", "PENDING_PAYMENT"];

      const visibleOrders = (orders || []).filter((order) => {
        const status = (order.status || order.paymentStatus || "").toUpperCase();
        return allowedStatuses.includes(status);
      });

      if (!visibleOrders.length) {
        ordersListEl.innerHTML = `<div class="empty-orders">
            <i class="fas fa-box-open"></i>
            <p>Todavía no tienes pedidos registrados.</p>
            <a href="../index.html" class="btn btn-primary">Ir a la tienda</a>
        </div>`;
        return;
      }

      ordersListEl.innerHTML = "";

      visibleOrders.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      let hasValidationOrder = false;

      visibleOrders.forEach((order) => {
        const status = (order.status || order.paymentStatus || "").toUpperCase();

        if (status === "PENDING_VALIDATION") {
          hasValidationOrder = true;
        }

        const card = buildOrderCard(order);
        ordersListEl.appendChild(card);
      });

      if (hasValidationOrder) {
        showPendingAlert(
          "Pago en Validación",
          "Tu transacción está siendo validada por el banco. El estado se actualizará automáticamente en unos instantes.",
          true
        );
      }
    } catch (err) {
      console.error(err);
      ordersListEl.innerHTML = `<p class="orders-error">No se pudo cargar tu historial de pedidos. Intenta más tarde.</p>`;
    }
  }

  // Navegación de Tabs
  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      navLinks.forEach((l) => l.classList.remove("active"));
      this.classList.add("active");
      tabs.forEach((tab) => {
        tab.classList.remove("active");
      });
      const targetId = this.getAttribute("data-tab");
      document.getElementById(targetId).classList.add("active");
    });
  });

  const billingForm = document.getElementById("billingForm");
  if (billingForm) {
    billingForm.addEventListener("submit", function (e) {
      e.preventDefault();
      alert("Datos de facturación actualizados correctamente.");
    });
  }

  // Carga inicial
  (async () => {
    try {
      const perfil = await window.api.getMiPerfil();
      if (!perfil) {
        window.location.href = homeLink;
        return;
      }

      const nombre = [perfil?.nombre ?? perfil?.Nombre, perfil?.apellido ?? perfil?.Apellido]
          .filter(Boolean).join(" ") || "Usuario";
      const email = perfil?.email ?? perfil?.Email ?? "";
      const creado = perfil?.creadoEl ?? perfil?.CreadoEl ?? null;

      const nameEl = document.querySelector(".profile-name");
      const emailEl = document.querySelector(".profile-email");
      const dateEl = document.querySelector(".profile-date");

      if (nameEl) nameEl.textContent = nombre;
      if (emailEl) emailEl.textContent = email;
      if (dateEl && creado)
        dateEl.textContent = "Miembro desde: " + formatearMesAnio(creado);

      const firstNameEl = document.getElementById("firstName");
      const lastNameEl = document.getElementById("lastName");
      const emailInpEl = document.getElementById("email");
      const phoneEl = document.getElementById("phone");

      const pNombre = perfil?.nombre ?? perfil?.Nombre ?? "";
      const pApellido = perfil?.apellido ?? perfil?.Apellido ?? "";
      const pEmail = perfil?.email ?? perfil?.Email ?? "";
      const pTelefono = perfil?.telefono ?? perfil?.Telefono ?? "";

      if (firstNameEl) firstNameEl.value = pNombre;
      if (lastNameEl) lastNameEl.value = pApellido;
      if (emailInpEl) emailInpEl.value = pEmail;
      if (phoneEl) phoneEl.value = pTelefono;

      await loadOrdersHistory();
    } catch {
      window.location.href = homeLink;
      return;
    }
  })();

  function formatearMesAnio(isoUtc) {
    const d = new Date(isoUtc);
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return `${meses[d.getMonth()]} ${d.getFullYear()}`;
  }

  const logoutLink = document.getElementById("logoutLink");
  if (logoutLink) {
    logoutLink.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await window.api.logout();
      } catch {}
      window.location.href = homeLink;
    });
  }

  const securityForm = document.getElementById("securityForm");
  if (securityForm) {
    securityForm.addEventListener("submit", function (e) {
      e.preventDefault();
      alert("Contraseña actualizada correctamente.");
    });
  }

  // Validaciones
  const firstNameEl = document.getElementById("firstName");
  const lastNameEl = document.getElementById("lastName");
  const phoneEl = document.getElementById("phone");
  const personalForm = document.getElementById("personalForm");
  const nameRx = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'-]+$/;
  const phoneRx = /^\d{10}$/;

  function setErr(el, msgId, msg) {
    const span = document.getElementById(msgId);
    if (span) span.textContent = msg || "";
    el.classList.toggle("is-invalid", !!msg);
  }

  function validateNames() {
    const fn = (firstNameEl.value || "").trim();
    const ln = (lastNameEl.value || "").trim();
    let ok = true;
    if (!fn || !nameRx.test(fn)) {
      setErr(firstNameEl, "firstNameErr", "Solo letras, espacios, ' y -.");
      ok = false;
    } else setErr(firstNameEl, "firstNameErr", "");
    if (!ln || !nameRx.test(ln)) {
      setErr(lastNameEl, "lastNameErr", "Solo letras, espacios, ' y -.");
      ok = false;
    } else setErr(lastNameEl, "lastNameErr", "");
    return ok;
  }

  function validatePhone() {
    const digits = (phoneEl.value || "").replace(/\D+/g, "");
    if (digits !== phoneEl.value) phoneEl.value = digits.slice(0, 10);
    const ok = phoneRx.test(phoneEl.value);
    setErr(phoneEl, "phoneErr", ok ? "" : "Debe tener 10 dígitos numéricos.");
    return ok;
  }

  firstNameEl?.addEventListener("input", () => {
    firstNameEl.value = firstNameEl.value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'-]/g, "");
    validateNames();
  });
  lastNameEl?.addEventListener("input", () => {
    lastNameEl.value = lastNameEl.value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'-]/g, "");
    validateNames();
  });
  phoneEl?.addEventListener("input", validatePhone);

  personalForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ok = validateNames() & validatePhone();
    if (!ok) return;

    const btn = personalForm.querySelector('button[type="submit"]');
    const payload = {
      nombre: firstNameEl.value.trim(),
      apellido: lastNameEl.value.trim(),
      telefono: phoneEl.value.trim(),
    };

    btn && (btn.disabled = true);
    try {
      await window.api.updatePersona(payload);
      window.Snackbar?.success("Datos actualizados.");
    } catch (err) {
      window.Snackbar?.error(err?.message || "No se pudo actualizar.");
      if (err?.status === 401) window.location.href = "../index.html";
    } finally {
      btn && (btn.disabled = false);
    }
  });
});