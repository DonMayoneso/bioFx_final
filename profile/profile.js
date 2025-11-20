// JavaScript para la funcionalidad del perfil
document.addEventListener("DOMContentLoaded", function () {
  // Navegación entre secciones
  const navLinks = document.querySelectorAll(".nav-link");
  const tabs = document.querySelectorAll(".profile-tabs");
  const homeLink = "../index.html";

  const ordersListEl = document.querySelector("#orders .orders-list");

  function formatOrderDate(isoUtc) {
    if (!isoUtc) return "";
    const d = new Date(isoUtc);
    const opts = { day: "numeric", month: "long", year: "numeric" };
    return d.toLocaleDateString("es-EC", opts);
  }

  function buildOrderCard(order) {
    const card = document.createElement("div");
    card.className = "order-card";

    const orderNumber = order.orderNumber || order.reference || `ORD-${order.orderId}`;
    const dateText = formatOrderDate(order.createdAt);

    const paymentInfoParts = [];
    if (order.paymentMethodName) paymentInfoParts.push(order.paymentMethodName);
    if (order.issuerName) paymentInfoParts.push(order.issuerName);
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
        <div>
          <div class="order-id">Pedido #${orderNumber}</div>
          ${dateText ? `<div class="order-date">Realizado el: ${dateText}</div>` : ""}
          ${paymentInfo ? `<div class="order-payment">${paymentInfo}</div>` : ""}
          ${hasAttachmentText ? `<div class="order-invoice">${hasAttachmentText}</div>` : ""}
        </div>
      </div>

      <div class="order-products">
        ${itemsHtml}
      </div>

      <div class="order-footer">
        <div class="order-total">Total: $${Number(order.totalAmount).toFixed(2)}</div>
      </div>
    `;

    return card;
  }

  async function loadOrdersHistory() {
    if (!ordersListEl) return;
    ordersListEl.innerHTML = `<p class="orders-loading">Cargando tu historial de pedidos...</p>`;

    try {
      const orders = await window.api.getMyOrdersHistory();
      if (!orders || !orders.length) {
        ordersListEl.innerHTML = `<p class="orders-empty">Todavía no has realizado compras pagadas.</p>`;
        return;
      }

      ordersListEl.innerHTML = "";
      orders.forEach((order) => {
        const card = buildOrderCard(order);
        ordersListEl.appendChild(card);
      });
    } catch (err) {
      console.error(err);
      ordersListEl.innerHTML = `<p class="orders-error">No se pudo cargar tu historial de pedidos. Intenta más tarde.</p>`;
    }
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();

      // Remover clase active de todos los enlaces
      navLinks.forEach((l) => l.classList.remove("active"));
      // Agregar clase active al enlace clickeado
      this.classList.add("active");

      // Ocultar todas las secciones
      tabs.forEach((tab) => {
        tab.classList.remove("active");
      });

      // Mostrar la sección correspondiente
      const targetId = this.getAttribute("data-tab");
      document.getElementById(targetId).classList.add("active");
    });
  });

  const billingForm = document.getElementById("billingForm");
  if (billingForm) {
    billingForm.addEventListener("submit", function (e) {
      e.preventDefault();
      alert("Datos de facturación actualizados correctamente.");
      // Aquí iría la lógica para guardar los cambios
    });
  }

  (async () => {
    try {
      const perfil = await window.api.getMiPerfil(); // devuelve null si 401
      if (!perfil) {
        // sin sesión: vuelve a home
        window.location.href = homeLink;
        return;
      }

      // Rellenar encabezado de perfil
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

      // Rellenar formulario "Información Personal"
      const firstNameEl = document.getElementById("firstName");
      const lastNameEl = document.getElementById("lastName");
      const emailInpEl = document.getElementById("email");
      const phoneEl = document.getElementById("phone");

      // Normaliza campos del API
      const pNombre = perfil?.nombre ?? perfil?.Nombre ?? "";
      const pApellido = perfil?.apellido ?? perfil?.Apellido ?? "";
      const pEmail = perfil?.email ?? perfil?.Email ?? "";
      const pTelefono = perfil?.telefono ?? perfil?.Telefono ?? "";

      // Setea valores si existen los inputs
      if (firstNameEl) firstNameEl.value = pNombre;
      if (lastNameEl) lastNameEl.value = pApellido;
      if (emailInpEl) emailInpEl.value = pEmail;
      if (phoneEl) phoneEl.value = pTelefono;

      // Cargar historial de pedidos pagados
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

  // Logout
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
      // Aquí iría la lógica para guardar los cambios
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
    const digits = (phoneEl.value || "").replace(/\D+/g, ""); // solo números
    if (digits !== phoneEl.value) phoneEl.value = digits.slice(0, 10); // sanitiza
    const ok = phoneRx.test(phoneEl.value);
    setErr(phoneEl, "phoneErr", ok ? "" : "Debe tener 10 dígitos numéricos.");
    return ok;
  }

  // Sanitiza mientras se escribe
  firstNameEl?.addEventListener("input", () => {
    firstNameEl.value = firstNameEl.value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'-]/g, "");
    validateNames();
  });
  lastNameEl?.addEventListener("input", () => {
    lastNameEl.value = lastNameEl.value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'-]/g, "");
    validateNames();
  });
  phoneEl?.addEventListener("input", validatePhone);

  // En el submit, valida antes de enviar
  personalForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ok = validateNames() & validatePhone(); // evalúa ambas
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
