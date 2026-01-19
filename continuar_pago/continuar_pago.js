// Variable global para almacenar el ID de la orden
let currentOrderId = null;

async function initPage() {
    try {
        // Verificación de sesión de usuario
        const perfil = await window.api.getMiPerfil();
        if (!perfil) throw new Error("NO_SESSION");

        // Obtener Order ID de URL o LocalStorage
        const url = new URL(window.location.href);
        currentOrderId = url.searchParams.get("orderId") || localStorage.getItem("lastOrderId");

        if (!currentOrderId) throw new Error("NO_ORDER");

        // Consultar estado fresco de la orden
        const orderData = await window.api.getOrderStatus(Number(currentOrderId));
        
        // Validación del Estado PENDING
        const status = String(orderData.status || orderData.Status || "").toUpperCase();
        
        const pendingStates = ["PENDING", "PENDING_PAYMENT", "PENDING_VALIDATION"];

        if (!pendingStates.includes(status)) {
            console.warn(`Estado ${status} no es pendiente. Redirigiendo.`);
            window.location.replace("../index.html");
            return;
        }

        // Renderizar UI con los datos
        renderOrderDetails(orderData);

    } catch (error) {
        console.error("Error en inicialización:", error);
        window.location.replace("../index.html");
    }
}

function renderOrderDetails(order) {
    // Ocultar loader y mostrar contenido
    document.getElementById("loader").style.display = "none";
    document.getElementById("orderDetails").style.display = "block";

    // Referencia
    document.getElementById("orderReference").textContent = order.reference || `ORD-${order.id}`;
    
    // Manejo seguro de valores numéricos para Subtotal, Total y Descuento
    const subtotal = Number(order.subtotal || 0);
    const total = Number(order.total || order.totalAmount || 0);
    const discount = Number(order.discount || 0);

    document.getElementById("orderSubtotal").textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById("orderTotal").textContent = `$${total.toFixed(2)}`;
    
    const discountEl = document.getElementById("orderDiscount");
    discountEl.textContent = discount > 0 ? `-$${discount.toFixed(2)}` : "$0.00";

    // Renderizar lista de productos
    const productsList = document.getElementById("productsList");
    productsList.innerHTML = "";
    const items = order.items || order.products || [];

    if (items.length > 0) {
        items.forEach(item => {
            const row = document.createElement("div");
            row.className = "product-item";
            
            const qty = item.quantity || 1;
            const name = item.name || item.productName || "Producto sin nombre";
            const price = Number(item.price || item.unitPrice || 0);

            row.innerHTML = `
                <span class="product-qty">${qty}x</span>
                <span class="product-name">${name}</span>
                <span class="product-price">$${(price * qty).toFixed(2)}</span>
            `;
            productsList.appendChild(row);
        });
    } else {
        productsList.innerHTML = "<p>Detalles de productos no disponibles.</p>";
    }
}

// Lógica del botón CANCELAR
async function handleCancel() {
    if(!confirm("¿Estás seguro de que deseas cancelar este pago?")) return;

    const btn = document.getElementById("btnCancel");
    const originalText = btn.innerHTML;
    
    // Feedback visual
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cancelando...';

    try {
        await window.api.cancelPendingOrder(currentOrderId);
        
        window.location.replace("../index.html");

    } catch (error) {
        console.error(error);
        alert("Error al cancelar el pago: " + (error.message || "Error desconocido"));
        
        // Restaurar botón en caso de error
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// Lógica del botón CONTINUAR
async function handleContinue() {
    const btn = document.getElementById("btnContinue");
    const originalText = btn.innerHTML;
    
    // Feedback visual
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

    try {
        // Construir la URL de retorno
        const origin = window.location.origin;
        const returnUrl = `${origin}/confirmacion_pago/confirmacion_pago.html?orderId=${currentOrderId}`;

        //  Ejecutar el endpoint de Retry
        const response = await window.api.retryPlacetoPaySession(currentOrderId, returnUrl);

        // Validar respuesta y redirigir a la pasarela y a Placetopay para devolver processUrl
        if (response && response.processUrl) {
            window.location.href = response.processUrl;
        } else if (response && response.paymentUrl) {
            // Fallback por si la propiedad se llama diferente
            window.location.href = response.paymentUrl;
        } else {
            throw new Error("La API no devolvió una URL de pago válida para redireccionar.");
        }

    } catch (error) {
        console.error(error);
        alert("No se pudo retomar la sesión de pago: " + (error.message || "Intente más tarde"));
        
        // Restaurar botón
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// Inicialización de Event Listeners
document.addEventListener("DOMContentLoaded", () => {
    initPage();

    const btnCancel = document.getElementById("btnCancel");
    if(btnCancel) btnCancel.addEventListener("click", handleCancel);

    const btnContinue = document.getElementById("btnContinue");
    if(btnContinue) btnContinue.addEventListener("click", handleContinue);
});