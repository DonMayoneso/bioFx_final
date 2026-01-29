// Variable global para almacenar el ID de la orden
let currentOrderId = null;

// Helper para resolver imágenes
function resolveImagePath(p) {
    if (!p) return "../assets/productos/placeholder.webp";
    if (/^https?:\/\//i.test(p)) return p; 
    if (p.startsWith("/")) return p; 
    if (p.startsWith("../")) return p; 
    return "../" + p.replace(/^\.?\//, ""); 
}

// Función para mostrar errores en pantalla
function mostrarErrorCritico(titulo, mensaje) {
    document.getElementById("loader").style.display = "none";
    document.getElementById("orderDetails").style.display = "none";
    
    const container = document.querySelector(".confirmation-content");
    container.innerHTML = `
        <div style="text-align: center; color: #dc3545;">
            <i class="fas fa-exclamation-circle" style="font-size: 3rem; margin-bottom: 15px;"></i>
            <h2>${titulo}</h2>
            <p>${mensaje}</p>
            <a href="../index.html" class="btn btn-primary" style="margin-top: 20px;">Volver al Inicio</a>
        </div>
    `;
}

async function initPage() {
    try {
        // Verificación de sesión de usuario
        const perfil = await window.api.getMiPerfil();
        if (!perfil) throw new Error("NO_SESSION");

        // Obtener Order ID
        const url = new URL(window.location.href);
        let resolvedId = url.searchParams.get("orderId");

        // Si no hay ID en URL, buscamos en el historial como respaldo
        if (!resolvedId) {
            try {
                const history = await window.api.getMyOrdersHistory();
                if (Array.isArray(history) && history.length > 0) {
                    const blockingStates = ["PENDING", "PENDING_PAYMENT", "PENDING_VALIDATION"];
                    
                    const latestPending = history
                        .filter(o => blockingStates.includes(String(o.status || o.paymentStatus || "").toUpperCase()))
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
                console.warn("Error buscando historial:", err);
            }
        }

        currentOrderId = resolvedId;

        if (!currentOrderId) {
            mostrarErrorCritico("Orden no encontrada", "No pudimos identificar la orden pendiente. Por favor intenta desde tu perfil.");
            return;
        }

        // Consultar detalle de la orden
        const orderData = await window.api.getOrderStatus(Number(currentOrderId));
        
        // Validación de Estado
        const status = String(orderData.status || orderData.Status || "").toUpperCase();
        const validStates = ["PENDING", "PENDING_PAYMENT", "PENDING_VALIDATION"];

        if (!validStates.includes(status)) {
            mostrarErrorCritico("Estado Inválido", `La orden actual está en estado <b>${status}</b> y no requiere continuación de pago.`);
            return;
        }

        // Renderizar UI
        renderOrderDetails(orderData);

    } catch (error) {
        console.error("Error crítico:", error);
        let msg = "Ocurrió un error al cargar los datos.";
        if (error.message === "NO_SESSION") msg = "Tu sesión ha expirado. Por favor inicia sesión nuevamente.";
        
        mostrarErrorCritico("Ups, algo salió mal", msg);
    }
}

function renderOrderDetails(order) {
    document.getElementById("loader").style.display = "none";
    document.getElementById("orderDetails").style.display = "block";

    // Datos generales
    document.getElementById("orderReference").textContent = order.reference || order.orderNumber || `ORD-${order.id}`;

    // Procesamiento de productos
    const productsList = document.getElementById("productsList");
    productsList.innerHTML = "";

    const rawItems = order.items || order.products || [];
    
    // Mapeo de items
    const itemsCalc = rawItems.map(item => {
        const precioBase = Number(item.price || item.unitPrice || item.UnitPrice || 0);
        const cantidad = Number(item.quantity || item.Quantity || 0);
        const descuentoPct = Number(item.discountPct || item.discount || 0);

        return {
            nombre: item.name || item.productName || "Producto",
            imagen: item.image || item.productImage || "",
            precioBase: precioBase,
            cantidad: cantidad,
            descuentoPct: descuentoPct
        };
    });

    if (itemsCalc.length > 0) {
        itemsCalc.forEach(item => {
            const itemTotal = item.precioBase * item.cantidad;
            const row = document.createElement("div");
            row.className = "product-item";
            row.innerHTML = `
                <div style="display:flex; align-items:center; width:100%;">
                    <img src="${resolveImagePath(item.imagen)}" 
                         style="width:50px; height:50px; object-fit:cover; border-radius:4px; margin-right:10px;"
                         onerror="this.src='../assets/productos/placeholder.webp'">
                    <div style="flex:1;">
                        <div class="product-name">${item.nombre}</div>
                        <div class="product-qty">${item.cantidad} x $${item.precioBase.toFixed(2)}</div>
                    </div>
                    <div class="product-price" style="font-weight:700;">$${itemTotal.toFixed(2)}</div>
                </div>
            `;
            productsList.appendChild(row);
        });
    } else {
        productsList.innerHTML = "<p>Detalles de productos no disponibles.</p>";
    }

    // Totales
    const totales = calcularTotalesOrden(itemsCalc, order);

    document.getElementById("orderSubtotal").textContent = `$${totales.subtotalBase.toFixed(2)}`;
    document.getElementById("orderTotal").textContent = `$${totales.total.toFixed(2)}`;
    
    const discountEl = document.getElementById("orderDiscount");
    if (Math.abs(totales.descuentoTotal) > 0.01) {
        discountEl.textContent = `-$${totales.descuentoTotal.toFixed(2)}`;
        discountEl.style.color = "var(--success)";
    } else {
        discountEl.textContent = "$0.00";
    }

    // Si hay envío, lo mostramos
    if (totales.shipping > 0) {
        const container = document.querySelector('.order-summary-box');
        const totalRow = document.querySelector('.total-row');
        if(!document.getElementById('shippingRow')) {
            const row = document.createElement('div');
            row.className = 'summary-row';
            row.id = 'shippingRow';
            row.innerHTML = `<span class="summary-label">Envío:</span><span class="summary-value">$${totales.shipping.toFixed(2)}</span>`;
            container.insertBefore(row, totalRow);
        }
    }
}

function calcularTotalesOrden(items, orderData) {
    const subtotalBase = items.reduce((acc, it) => acc + it.precioBase * it.cantidad, 0);
    const descuentoProductos = items.reduce((acc, it) => acc + it.precioBase * (it.descuentoPct / 100) * it.cantidad, 0);
    const subtotalNeto = Math.max(0, subtotalBase - descuentoProductos);
    
    // Reglas de negocio (envío gratis > 50)
    const shipping = subtotalNeto >= 50 ? 0 : 5;
    
    const tieneReceta = orderData.hasAttachment || orderData.tieneReceta; 
    const descuentoReceta = tieneReceta ? subtotalNeto * 0.02 : 0;
    const descuentoTotal = descuentoProductos + descuentoReceta;
    const total = Math.max(0, subtotalNeto - descuentoReceta + shipping);

    return { subtotalBase, descuentoTotal, shipping, total };
}

// Botones
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
        alert("Error al cancelar: " + error.message);
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function handleContinue() {
    const btn = document.getElementById("btnContinue");
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

    try {
        const origin = window.location.origin;
        const returnUrl = `${origin}/confirmacion_pago/confirmacion_pago.html?orderId=${currentOrderId}`;
        const response = await window.api.retryPlacetoPaySession(currentOrderId, returnUrl);

        if (response && response.processUrl) {
            window.location.href = response.processUrl;
        } else if (response && response.paymentUrl) {
            window.location.href = response.paymentUrl;
        } else {
            throw new Error("No se obtuvo URL de pago válida.");
        }
    } catch (error) {
        console.error(error);
        alert("No se pudo retomar la sesión: " + error.message);
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initPage();
    const btnCancel = document.getElementById("btnCancel");
    if(btnCancel) btnCancel.addEventListener("click", handleCancel);
    const btnContinue = document.getElementById("btnContinue");
    if(btnContinue) btnContinue.addEventListener("click", handleContinue);
});