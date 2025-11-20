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

function setUI(status, extraMsg) {
  const icon = document.getElementById("icon");
  const title = document.getElementById("title");
  const desc = document.getElementById("desc");

  const ICONS = {
    APPROVED: '<i class="fas fa-check-circle"></i>',
    REJECTED: '<i class="fas fa-times-circle"></i>',
    PENDING: '<i class="fas fa-hourglass-half"></i>',
    ERROR: '<i class="fas fa-exclamation-triangle"></i>',
  };

  icon.innerHTML = ICONS[status] || ICONS.ERROR;

  if (status === "APPROVED") {
    title.textContent = "Pago aprobado";
    desc.textContent = extraMsg || "Tu transacción fue procesada correctamente.";
    limpiarDatosCompra();
  } else if (status === "REJECTED") {
    title.textContent = "Pago rechazado";
    desc.textContent = extraMsg || "Tu transacción no pudo completarse.";
    } else if (status === "PENDING") {
    title.textContent = "Pago en proceso";
    desc.textContent = extraMsg || "Aún estamos esperando confirmación.";
    } else {
    title.textContent = "Estado desconocido";
    desc.textContent = extraMsg || "Intenta nuevamente en unos segundos.";
    }
}

async function consultarEstado(orderId, requestId) {
  try {
    const res = await window.api.getOrderStatus(Number(orderId)); // { status: "PAID"|"PENDING"|"REJECTED"|"EXPIRED"|... }

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

      default:
        uiStatus = "ERROR";
        extraMsg =
          "No se pudo determinar el estado de tu transacción. Intenta nuevamente en unos segundos.";
        break;
    }

    setUI(uiStatus, extraMsg);
  } catch (e) {
    setUI("ERROR", e?.message || "No se pudo consultar el estado.");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const guard = await guardAccessOrRedirect();
  if (!guard) return;

  const { orderId, requestId } = guard;

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
