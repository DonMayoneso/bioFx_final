async function guardAccessOrRedirect() {
  try {
    const perfil = await window.api.getMiPerfil();
    if (!perfil) throw new Error("NO_SESSION");

    const url = new URL(window.location.href);
    const orderId = url.searchParams.get("orderId") || localStorage.getItem("lastOrderId");

    if (!orderId) throw new Error("NO_ORDER");

    // valida que la orden exista y sea accesible
    await window.api.getOrderStatus(Number(orderId));

    // requestId es opcional; se usa para forzar refresh si está presente
    const requestId =
      url.searchParams.get("requestId") || localStorage.getItem("lastRequestId") || null;

    return { orderId, requestId };
  } catch {
    window.location.replace("../index.html");
    return null;
  }
}

// Función encargada de actualizar la interfaz
function setUI(status, extraMsg, orderData = null) {
  const icon = document.getElementById("icon");
  const title = document.getElementById("title");
  const desc = document.getElementById("desc");

  // Elementos del resumen
  const orderInfo = document.getElementById("orderInfo");
  const orderReference = document.getElementById("orderReference");
  const orderTotal = document.getElementById("orderTotal");

  const ICONS = {
    APPROVED: '<i class="fas fa-check-circle"></i>',
    REJECTED: '<i class="fas fa-times-circle"></i>',
    PENDING: '<i class="fas fa-hourglass-half"></i>',
    CANCELLED: '<i class="fas fa-ban"></i>', // Icono para cancelado
    ERROR: '<i class="fas fa-exclamation-triangle"></i>',
  };

  icon.innerHTML = ICONS[status] || ICONS.ERROR;

  // Actualizar datos de la orden si existen
  if (orderData) {
      orderInfo.style.display = "block";
      orderReference.textContent = orderData.reference || "---";
      
      const total = Number(orderData.total || 0);
      orderTotal.textContent = `$${total.toFixed(2)}`;
  }

  // Lógica de visualización por estado
  if (status === "APPROVED") {
    title.textContent = "Pago aprobado";
    desc.textContent = extraMsg || "Tu transacción fue procesada correctamente.";
    icon.style.color = "var(--success)"; 
    limpiarDatosCompra();
  } else if (status === "REJECTED") {
    title.textContent = "Pago rechazado";
    desc.textContent = extraMsg || "Tu transacción no pudo completarse.";
    icon.style.color = "#dc3545"; 
  } else if (status === "PENDING") {
    title.textContent = "Pago en proceso";
    desc.textContent = extraMsg || "Aún estamos esperando confirmación.";
    icon.style.color = "#ffc107"; 
  } else if (status === "CANCELLED") {
    // Manejo del estado cancelado en la UI
    title.textContent = "Pago cancelado";
    desc.textContent = extraMsg || "La transacción ha sido cancelada.";
    icon.style.color = "#6c757d"; // Gris para estado cancelado
  } else {
    title.textContent = "Estado desconocido";
    desc.textContent = extraMsg || "Intenta nuevamente en unos segundos.";
    icon.style.color = "var(--gris)";
  }
}

async function consultarEstado(orderId, requestId) {
  try {
    console.log("Dentro de consultarEstado")
    const res = await window.api.getOrderStatus(Number(orderId));

    console.log(res)

    const rawStatus = String(res?.status || res?.Status || "").toUpperCase() || "ERROR";
    let uiStatus = "ERROR";
    let extraMsg = "";

    

    switch (rawStatus) {
      case "PAID":
      case "APPROVED":
      case "OK":
        uiStatus = "APPROVED";
        extraMsg = "Tu transacción fue procesada correctamente.";
        break;

      case "PENDING":
      case "PENDING_PAYMENT":
      case "PENDING_VALIDATION":
        uiStatus = "PENDING";
        extraMsg = "Tu pago está en proceso. En breve se actualizará el estado.";
        break;

      case "REJECTED":
      case "FAILED":
        uiStatus = "REJECTED";
        extraMsg =
          "Tu transacción no pudo completarse. Intenta nuevamente o usa otro método de pago.";
        break;

      case "EXPIRED":
        uiStatus = "REJECTED";
        extraMsg = "Tu sesión de pago ha expirado. Por favor, vuelve a realizar la compra.";
        break;
      
      // Casos de cancelación detectados
      case "CANCELLED":
      case "CANCELED":
      case "CANCELADA":
      case "CANCEL":
      case "VOIDED":
        uiStatus = "CANCELLED";
        extraMsg = "La transacción ha sido cancelada.";
        break;

      default:
        uiStatus = "ERROR";
        extraMsg =
          "La transacción ha sido cancelada.";
        break;
    }

    setUI(uiStatus, extraMsg, res);
  } catch (e) {
    setUI("ERROR", e?.message || "No se pudo consultar el estado.");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const guard = await guardAccessOrRedirect();
  if (!guard) return;

  const { orderId, requestId } = guard;

  // Estado inicial visual
  setUI("PENDING", "Consultando con el proveedor de pagos...");

    
  await consultarEstado(orderId, requestId);
});

function limpiarDatosCompra() {
  try {
    localStorage.removeItem("carrito");
    localStorage.removeItem("carritoCheckout");
    localStorage.removeItem("orderData");
    sessionStorage.removeItem("carritoCheckout");
    document.cookie = "carritoCheckout=; max-age=0; path=/";
    document.cookie = "carrito=; max-age=0; path=/";
  } catch {}
}
