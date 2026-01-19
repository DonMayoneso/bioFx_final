// Variable global para almacenar el ID de la orden
let currentOrderId = null;

async function initPage() {
    try {
        // 1. Verificación de sesión de usuario
        const perfil = await window.api.getMiPerfil();
        if (!perfil) throw new Error("NO_SESSION");

        // 2. Obtener Order ID
        // Prioridad 1: URL
        const url = new URL(window.location.href);
        let resolvedId = url.searchParams.get("orderId");

        // Prioridad 2: Buscar en el historial de compras (API) si no viene en URL
        // CORRECCIÓN SOLICITADA: Reemplazo de localStorage por API History
        if (!resolvedId) {
            try {
                const history = await window.api.getMyOrdersHistory();
                
                if (Array.isArray(history) && history.length > 0) {
                    const pendingStates = ["PENDING", "PENDING_PAYMENT", "PENDING_VALIDATION"];
                    
                    // Filtramos ordenes pendientes y ordenamos descendente (la más reciente primero)
                    // Asumimos que ID más alto es más reciente, o usamos createdAt si existe
                    const latestPending = history
                        .filter(o => pendingStates.includes(String(o.status || o.paymentStatus || "").toUpperCase()))
                        .sort((a, b) => {
                            const idA = Number(a.id || a.orderId || 0);
                            const idB = Number(b.id || b.orderId || 0);
                            return idB - idA;
                        })[0];

                    if (latestPending) {
                        resolvedId = latestPending.id || latestPending.orderId;
                    }
                }
            } catch (err) {
                console.warn("No se pudo recuperar historial para buscar pendientes:", err);
            }
        }

        currentOrderId = resolvedId;

        if (!currentOrderId) {
            // Si no hay ID en URL y no se encontró pendiente en historial -> Home
            console.warn("No se encontró ninguna orden pendiente.");
            throw new Error("NO_ORDER");
        }

        // 3. Consultar estado fresco de la orden específica
        const orderData = await window.api.getOrderStatus(Number(currentOrderId));
        
        // 4. Validación del Estado PENDING (Doble chequeo de seguridad)
        const status = String(orderData.status || orderData.Status || "").toUpperCase();
        const pendingStates = ["PENDING", "PENDING_PAYMENT", "PENDING_VALIDATION"];

        if (!pendingStates.includes(status)) {
            console.warn(`Estado ${status} no es pendiente. Redirigiendo.`);
            window.location.replace("../index.html");
            return;
        }

        // 5. Renderizar UI con los datos
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
    
    // Manejo seguro de valores numéricos
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
    
    // Adaptación a la estructura de items
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
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cancelando...';

    try {
        await window.api.cancelPendingOrder(currentOrderId);
        window.location.replace("../index.html");

    } catch (error) {
        console.error(error);
        alert("Error al cancelar el pago: " + (error.message || "Error desconocido"));
        
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// Lógica del botón CONTINUAR
async function handleContinue() {
    const btn = document.getElementById("btnContinue");
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

    try {
        // Construir la URL de retorno
        const origin = window.location.origin;
        // Apuntar correctamente a la carpeta confirmacion_pago
        const returnUrl = `${origin}/confirmacion_pago/confirmacion_pago.html?orderId=${currentOrderId}`;

        // Ejecutar el endpoint de Retry
        const response = await window.api.retryPlacetoPaySession(currentOrderId, returnUrl);

        if (response && response.processUrl) {
            window.location.href = response.processUrl;
        } else if (response && response.paymentUrl) {
            window.location.href = response.paymentUrl;
        } else {
            throw new Error("La API no devolvió una URL de pago válida para redireccionar.");
        }

    } catch (error) {
        console.error(error);
        alert("No se pudo retomar la sesión de pago: " + (error.message || "Intente más tarde"));
        
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