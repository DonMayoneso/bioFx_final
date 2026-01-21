// Variable global
let currentOrderId = null;

// Helper para resolver rutas de imágenes
function resolveImagePath(p) {
    if (!p) return "../assets/productos/placeholder.webp";
    if (/^https?:\/\//i.test(p)) return p; 
    if (p.startsWith("/")) return p; 
    if (p.startsWith("../")) return p; 
    // Ajuste para rutas relativas desde esta carpeta
    return "../" + p.replace(/^\.?\//, ""); 
}

async function initPage() {
    try {
        // Verificación de sesión de usuario
        const perfil = await window.api.getMiPerfil();
        if (!perfil) throw new Error("NO_SESSION");

        // Obtener Order ID
        // Prioridad A: URL
        const url = new URL(window.location.href);
        let resolvedId = url.searchParams.get("orderId");

        // Prioridad B: Buscar en Historial
        if (!resolvedId) {
            try {
                const history = await window.api.getMyOrdersHistory();
                
                if (Array.isArray(history) && history.length > 0) {
                    const blockingStates = ["PENDING", "PENDING_PAYMENT", "PENDING_VALIDATION"];
                    
                    // Buscar la orden pendiente más reciente
                    const latestPending = history
                        .filter(o => blockingStates.includes(String(o.status || o.paymentStatus || "").toUpperCase()))
                        .sort((a, b) => {
                            // Ordenar por ID descendente
                            const idA = Number(a.id || a.orderId || 0);
                            const idB = Number(b.id || b.orderId || 0);
                            return idB - idA;
                        })[0];

                    if (latestPending) {
                        resolvedId = latestPending.id || latestPending.orderId;
                    }
                }
            } catch (err) {
                console.warn("No se pudo recuperar historial:", err);
            }
        }

        currentOrderId = resolvedId;

        if (!currentOrderId) {
            console.warn("No se encontró ninguna orden pendiente.");
            window.location.replace("../index.html");
            return;
        }

        // Consultar detalle completo de la orden
        const orderData = await window.api.getOrderStatus(Number(currentOrderId));
        
        // Validación del Estado
        const status = String(orderData.status || orderData.Status || "").toUpperCase();
        const validStates = ["PENDING", "PENDING_PAYMENT", "PENDING_VALIDATION"];

        if (!validStates.includes(status)) {
            console.warn(`Estado ${status} no es válido para continuar. Redirigiendo.`);
            window.location.replace("../index.html");
            return;
        }

        // Renderizar UI
        renderOrderDetails(orderData);

    } catch (error) {
        console.error("Error en inicialización:", error);
        window.location.replace("../index.html");
    }
}

function renderOrderDetails(order) {
    // Mostrar contenido
    document.getElementById("loader").style.display = "none";
    document.getElementById("orderDetails").style.display = "block";

    // Referencia visual
    document.getElementById("orderReference").textContent = order.reference || order.orderNumber || `ORD-${order.id}`;

    // PROCESAMIENTO DE PRODUCTOS
    const productsList = document.getElementById("productsList");
    productsList.innerHTML = "";

    // Normalizar items para asegurar compatibilidad de nombres de propiedades
    const rawItems = order.items || order.products || [];
    
    // tems para estandarizar precio y descuento
    const itemsCalc = rawItems.map(item => {
        const precioBase = Number(item.price || item.unitPrice || item.UnitPrice || 0);
        const cantidad = Number(item.quantity || item.Quantity || 0);
        
        // Intentar detectar descuento si viene en el item, si no, asumir 0
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

    // CÁLCULO DE TOTALES
    const totales = calcularTotalesOrden(itemsCalc, order);

    document.getElementById("orderSubtotal").textContent = `$${totales.subtotalBase.toFixed(2)}`;
    document.getElementById("orderTotal").textContent = `$${totales.total.toFixed(2)}`;
    
    const discountEl = document.getElementById("orderDiscount");
    // Mostramos descuento si existe
    if (Math.abs(totales.descuentoTotal) > 0.01) {
        discountEl.textContent = `-$${totales.descuentoTotal.toFixed(2)}`;
        discountEl.style.color = "var(--success)";
    } else {
        discountEl.textContent = "$0.00";
    }
    if (totales.shipping > 0) {
        agregarFilaEnvio(totales.shipping);
    }
}

// Función portada del checkout
function calcularTotalesOrden(items, orderData) {
    // Subtotal Base (Precio lista * cantidad)
    const subtotalBase = items.reduce((acc, it) => acc + it.precioBase * it.cantidad, 0);

    // Descuentos de productos
    const descuentoProductos = items.reduce((acc, it) => {
        return acc + it.precioBase * (it.descuentoPct / 100) * it.cantidad;
    }, 0);

    const subtotalNeto = Math.max(0, subtotalBase - descuentoProductos);

    // Regla de Envío
    const shipping = subtotalNeto >= 50 ? 0 : 5;

    // Descuento receta
    const tieneReceta = orderData.hasAttachment || orderData.tieneReceta; 
    const descuentoReceta = tieneReceta ? subtotalNeto * 0.02 : 0;

    const descuentoTotal = descuentoProductos + descuentoReceta;
    
    // Total Final
    const total = Math.max(0, subtotalNeto - descuentoReceta + shipping);

    return {
        subtotalBase: subtotalBase,
        descuentoTotal: descuentoTotal,
        shipping: shipping,
        total: total
    };
}

function agregarFilaEnvio(monto) {
    const container = document.querySelector('.order-summary-box');
    const totalRow = document.querySelector('.total-row');
    
    // Evitar duplicados
    if(document.getElementById('shippingRow')) return;

    const row = document.createElement('div');
    row.className = 'summary-row';
    row.id = 'shippingRow';
    row.innerHTML = `
        <span class="summary-label">Envío:</span>
        <span class="summary-value">$${monto.toFixed(2)}</span>
    `;
    
    // Insertar antes del total
    container.insertBefore(row, totalRow);
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
        alert("Error al cancelar: " + (error.message || "Desconocido"));
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
        alert("No se pudo retomar la sesión: " + (error.message || "Intente más tarde"));
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