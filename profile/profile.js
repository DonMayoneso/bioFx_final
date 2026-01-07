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
      timeZone: 'America/Guayaquil',
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };
    return d.toLocaleString("es-EC", opts);
  }

  // Función auxiliar para traducir y estilizar estados (ACTUALIZADO)
  function getStatusConfig(status) {
    const s = (status || "").toUpperCase();

    switch (s) {
      case "PAID":
        return {
          label: "Aprobada",
          class: "status-approved",
          icon: "fa-check-circle"
        };
      case "REJECTED":
        return {
          label: "Rechazada",
          class: "status-rejected",
          icon: "fa-times-circle"
        };
      case "PENDING_VALIDATION":
        return {
          label: "En Validación",
          class: "status-pending-validation",
          icon: "fa-spinner fa-spin"
        };
      case "PENDING":
        return {
          label: "Pendiente",
          class: "status-pending",
          icon: "fa-clock"
        };
      case "EXPIRED":
        return {
          label: "Expirada",
          class: "status-expired",
          icon: "fa-clock"
        };
      case "CANCELLED":
        return {
          label: "Cancelada",
          class: "status-cancelled",
          icon: "fa-ban"
        };
      default:
        return {
          label: status || "Desconocido",
          class: "",
          icon: "fa-info-circle"
        };
    }
  }

  function buildOrderCard(order) {
    const card = document.createElement("div");
    card.className = "order-card";

    const statusRaw = order.status || order.paymentStatus || "PENDING";
    const statusConfig = getStatusConfig(statusRaw);

    const authCode = order.authorization || order.authorizationCode || order.authCode || null;
    const orderNumber = order.orderNumber || order.reference || `ORD-${order.orderId}`;
    const dateText = formatOrderDate(order.createdAt);

    const paymentInfoParts = [];
    if (order.paymentMethodName) paymentInfoParts.push(order.paymentMethodName);
    if (order.issuerName && statusRaw !== 'REJECTED') paymentInfoParts.push(order.issuerName);

    const paymentInfo = paymentInfoParts.length ? `Pago con ${paymentInfoParts.join(" · ")}` : "";
    const hasAttachmentText = order.hasAttachment ? "Incluye factura adjunta" : "";

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
        
        ${statusRaw === 'REJECTED' ?
        `<div class="order-actions">
              <a href="../index.html" class="btn-repeat-order">Intentar nuevamente</a>
           </div>` : ''
      }
      </div>
    `;

    return card;
  }

  function showPendingAlert() {
    if (document.querySelector('.pending-order-alert')) return;

    const container = document.querySelector('#orders');
    const alertDiv = document.createElement('div');
    alertDiv.className = 'pending-order-alert';
    alertDiv.innerHTML = `
      <i class="fas fa-exclamation-triangle"></i>
      <div>
        <strong>Pago Pendiente Detectado</strong>
        <p style="margin:0; font-size:0.9rem;">Tu banco está procesando una transacción. Por favor espera la confirmación antes de realizar una nueva compra.</p>
      </div>
      <div class="pending-actions">
        <button class="btn-check-status" onclick="location.reload()">Actualizar Estado</button>
      </div>
    `;

    const title = container.querySelector('.section-title');
    title.insertAdjacentElement('afterend', alertDiv);
  }

  async function loadOrdersHistory() {
    if (!ordersListEl) return;
    ordersListEl.innerHTML = `<p class="orders-loading"><i class="fas fa-spinner fa-spin"></i> Cargando tu historial de pedidos...</p>`;

    try {
      const orders = await window.api.getMyOrdersHistory();

      if (!orders || !orders.length) {
        ordersListEl.innerHTML = `<div class="empty-orders">
            <i class="fas fa-box-open"></i>
            <p>Todavía no tienes pedidos registrados.</p>
            <a href="../index.html" class="btn btn-primary">Ir a la tienda</a>
        </div>`;
        return;
      }

      ordersListEl.innerHTML = "";
      let hasPending = false;

      // Definimos qué estados queremos mostrar (FILTRO APLICADO)
      const allowedToSee = ["PAID", "REJECTED", "PENDING_VALIDATION"];

      orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      orders.forEach((order) => {
        const status = (order.status || order.paymentStatus || "").toUpperCase();

        // 1. Detectar si hay pagos pendientes para la alerta (PENDING o PENDING_VALIDATION)
        if (status === 'PENDING' || status === 'PENDIENTE' || status === 'PENDING_VALIDATION') {
          hasPending = true;
        }

        // 2. Filtrar visualmente: Si no es PAID, REJECTED o PENDING_VALIDATION, no se muestra
        if (!allowedToSee.includes(status)) {
          return;
        }

        const card = buildOrderCard(order);
        ordersListEl.appendChild(card);
      });

      if (hasPending) {
        showPendingAlert();
      }

      // Si después del filtro no hay nada, mostrar mensaje vacío
      if (ordersListEl.innerHTML === "") {
        ordersListEl.innerHTML = `<p class="empty-orders">No hay pedidos para mostrar en este momento.</p>`;
      }

    } catch (err) {
      console.error(err);
      ordersListEl.innerHTML = `<p class="orders-error">No se pudo cargar tu historial de pedidos. Intenta más tarde.</p>`;
    }
  }

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

  (async () => {
    try {
      const perfil = await window.api.getMiPerfil();
      if (!perfil) {
        window.location.href = homeLink;
        return;
      }

      const nombre =
        [perfil?.nombre ?? perfil?.Nombre, perfil?.apellido ?? perfil?.Apellido]
          .filter(Boolean)
          .join(" ") || "Usuario";
      const email = perfil?.email ?? perfil?.Email ?? "";
      const creado = perfil?.creadoEl ?? perfil?.CreadoEl ?? null;

      const nameEl = document.querySelector(".profile-name");
      const emailEl = document.querySelector(".profile-email");
      const dateEl = document.querySelector(".profile-date");

      if (nameEl) nameEl.textContent = nombre;
      if (emailEl) emailEl.textContent = email;
      if (dateEl && creado) dateEl.textContent = "Miembro desde: " + formatearMesAnio(creado);

      const firstNameEl = document.getElementById("firstName");
      const lastNameEl = document.getElementById("lastName");
      const emailInpEl = document.getElementById("email");
      const phoneEl = document.getElementById("phone");

      // Normaliza campos del API
      const pNombre = perfil?.nombre ?? perfil?.Nombre ?? "";
      const pApellido = perfil?.apellido ?? perfil?.Apellido ?? "";
      const pEmail = perfil?.email ?? perfil?.Email ?? "";
      const pTelefono = perfil?.telefono ?? perfil?.Telefono ?? "";

      await loadOrdersHistory();
    } catch {
      window.location.href = homeLink;
      return;
    }
  })();

  function formatearMesAnio(isoUtc) {
    const d = new Date(isoUtc);
    const meses = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    return `${meses[d.getMonth()]} ${d.getFullYear()}`;
  }

  const logoutLink = document.getElementById("logoutLink");
  if (logoutLink) {
    logoutLink.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await window.api.logout();
      } catch { }
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