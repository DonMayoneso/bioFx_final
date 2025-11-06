// Elementos del DOM
const productsContainer = document.getElementById("productsContainer");
const productModal = document.getElementById("productModal");
const modalProductContent = document.getElementById("modalProductContent");
const cartModal = document.getElementById("cartModal");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");
const cartButton = document.getElementById("cartButton");
const closeProductModal = document.getElementById("closeProductModal");
const closeCartModal = document.getElementById("closeCartModal");
const checkoutButton = document.getElementById("checkoutButton");
const continueShopping = document.getElementById("continueShopping");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const searchResults = document.getElementById("searchResults");
const promoPopup = document.getElementById("promoPopup");
const closePopup = document.getElementById("closePopup");
const linkProfile = "profile/profile.html";

// Variables globales
let productos = [];
let carrito = [];
let currentCategoryId = null;
const categoriasIndex = new Map();
let isMinimized = false;

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
  cargarPromociones();
  cargarCategorias();
  cargarProductos();
  cargarCarrito();
  actualizarCarrito();

  // Agregar event listeners a los enlaces del footer que tienen data-section
  agregarEventListenersFooter();

  // Event listeners
  cartButton.addEventListener("click", abrirCarrito);
  closeProductModal.addEventListener("click", cerrarModalProducto);
  closeCartModal.addEventListener("click", cerrarModalCarrito);
  checkoutButton.addEventListener("click", finalizarCompra);
  continueShopping.addEventListener("click", cerrarModalCarrito);

  // Cerrar modales al hacer clic fuera del contenido
  window.addEventListener("click", (e) => {
    if (e.target === productModal) cerrarModalProducto();
    if (e.target === cartModal) cerrarModalCarrito();
  });
  // Event listeners para búsqueda
  searchButton.addEventListener("click", buscarProductos);
  searchInput.addEventListener("keyup", function (e) {
    if (e.key === "Enter") {
      buscarProductos();
    } else {
      buscarEnTiempoReal();
    }
  });

  // Mostrar popup y overlay inmediatamente al cargar la página
  window.addEventListener("load", () => {
    promoPopup.style.display = "block";
    promoOverlay.style.display = "block";
  });

  // Función para cerrar el popup
  function handleClosePopup() {
    promoPopup.style.display = "none";
    promoOverlay.style.display = "none";
  }

  // Cerrar con botón
  closePopup.addEventListener("click", handleClosePopup);

  // Cerrar si se hace clic en el overlay
  promoOverlay.addEventListener("click", handleClosePopup);
});

async function cargarCategorias() {
  const list = document.getElementById("categoryList");
  if (!list) return;

  // conserva el primer botón "todos"
  const first = list.querySelector('button[data-category="todos"]');
  list.innerHTML = "";
  if (first) list.appendChild(first);

  try {
    const data = await window.api.getCategorias(); // GET /api/Categorias
    const raw = Array.isArray(data) ? data : data?.data ?? data?.items ?? [];
    const categorias = raw
      .filter((c) => {
        const a = c.activo ?? c.Activo;
        if (a === undefined) return true;
        return a === true || a === 1 || a === "1";
      })
      .map((c) => ({
        id: c.id ?? c.Id,
        nombre: c.descripcion ?? c.Descripcion ?? "",
      }))
      .filter((c) => c.nombre);

    // icono por defecto y mapeo opcional
    const iconMap = {
      "Mente y Concentración": "fas fa-brain",
      Digestión: "fas fa-utensils",
      "Relajación y Sueño": "fas fa-bed",
      Colesterol: "fas fa-heartbeat",
      "Salud Cardiovascular": "fas fa-heart",
      Antioxidantes: "fas fa-apple-alt",
      "Huesos y Articulaciones": "fas fa-bone",
      "Embarazo y Lactancia": "fas fa-baby",
      "Sistema Inmune": "fas fa-shield-alt",
      Energía: "fas fa-bolt",
      "Vitaminas y Minerales": "fas fa-capsules",
      Muscular: "fas fa-dumbbell",
      "Sistema Nervioso": "fas fa-brain",
      Metabolismo: "fas fa-fire",
      "Aceites Esenciales": "fas fa-spa",
      Dolor: "fas fa-head-side-virus",
    };

    const frag = document.createDocumentFragment();

    // índice y botones
    categorias.forEach((cat) => {
      categoriasIndex.set(Number(cat.id), cat.nombre);

      const btn = document.createElement("button");
      btn.className = "category-btn";
      btn.setAttribute("data-category", cat.nombre);
      btn.setAttribute("data-category-id", String(cat.id));
      btn.innerHTML = `
    <i class="category-icon ${iconMap[cat.nombre] || "fas fa-tag"}"></i>
    <span>${cat.nombre}</span>
  `;
      frag.appendChild(btn);
    });

    list.appendChild(frag);
    inicializarCategorias();
  } catch (err) {
    console.error("Error cargando categorías:", err);
    // fallback: deja solo “todos”
  }
}

// Cargar productos desde el JSON
async function cargarProductos() {
  try {
    const data = await window.api.getProductos(); // GET /api/Productos

    // Normaliza objeto recibido del API
    productos = (Array.isArray(data) ? data : []).map((p, i) => {
      const categorias = Array.isArray(p.categorias ?? p.Categorias)
        ? p.categorias ?? p.Categorias
        : [];
      const categoriaIds = categorias
        .map((x) => Number(x.categoriaId ?? x.CategoriaId))
        .filter(Boolean);

      const promo = Array.isArray(p.promocionados ?? p.Promocionados)
        ? (p.promocionados ?? p.Promocionados).map(Number)
        : [];

      return {
        id: Number(p.id ?? p.Id ?? i + 1),
        codigo: p.codigo ?? p.Codigo ?? "",
        disponible: (p.disponible ?? p.Disponible) !== false,
        nombre: p.nombre ?? p.Nombre ?? "",
        precio: Number(p.precio ?? p.Precio ?? 0),
        imagen: p.imagen ?? p.Imagen ?? "",
        logo: p.logo ?? p.Logo ?? "",
        descripcion: p.descripcion ?? p.Descripcion ?? "",
        descripciones: {
          principal: p.desc_Principal ?? p.Desc_Principal ?? "",
          otros: p.desc_Otros ?? p.Desc_Otros ?? "",
        },
        contraindicaciones: p.contraindicaciones ?? p.Contraindicaciones ?? "",
        descuento: Number(p.descuento ?? p.Descuento ?? 0),
        disclaimer: p.disclaimer ?? p.Disclaimer ?? "",
        categoriaIds, // ← lo usaremos para filtrar
        promocionados: promo,
      };
    });

    renderizarProductos();
  } catch (error) {
    console.error("Error al cargar productos:", error);
    productsContainer.innerHTML = `
      <div class="error">
        <h3>Error al cargar los productos</h3>
        <p>${error.message || "Intenta más tarde."}</p>
      </div>`;
  }
}

// Renderizar productos en la página con efecto flip
function renderizarProductos() {
  if (!productos || productos.length === 0) {
    productsContainer.innerHTML = '<div class="empty">No hay productos disponibles</div>';
    return;
  }

  // Filtrar por categoría y disponibilidad - MODIFICADO PARA MÚLTIPLES CATEGORÍAS
  const productosFiltrados = !currentCategoryId
    ? productos.filter((p) => p.disponible)
    : productos.filter((p) => p.disponible && p.categoriaIds?.includes(currentCategoryId));

  if (productosFiltrados.length === 0) {
    productsContainer.innerHTML = `
            <div class="empty">
                <h3>No se encontraron productos en esta categoría</h3>
                <button class="btn btn-outline" data-category="todos" onclick="document.querySelector('.category-btn[data-category=\\'todos\\']').click()">
                    Ver todos los productos
                </button>
            </div>
        `;
    return;
  }

  // Generar HTML de productos con efecto flip
  productsContainer.innerHTML = "";
  productosFiltrados.forEach((producto) => {
    const tieneDescuento = producto.descuento && producto.descuento > 0;
    const precioOriginal = producto.precio;
    const precioDescuento = tieneDescuento
      ? ((precioOriginal * (100 - producto.descuento)) / 100).toFixed(2)
      : precioOriginal.toFixed(2);

    const productCard = document.createElement("div");
    productCard.className = "product-card";
    productCard.innerHTML = `
            <div class="product-card-front">
                ${
                  tieneDescuento
                    ? `<div class="product-discount">-${producto.descuento}%</div>`
                    : ""
                }
                <img src="${producto.imagen}" alt="${producto.nombre}" class="product-image">
                <div class="product-name">${producto.nombre}</div>
            </div>
            <div class="product-card-back">
                <div class="product-name">${producto.nombre}</div>
                <div class="product-price">
                    ${
                      tieneDescuento
                        ? `<span class="original-price">$${precioOriginal.toFixed(2)}</span>`
                        : ""
                    }
                    <span class="${
                      tieneDescuento ? "discounted-price" : ""
                    }">$${precioDescuento}</span>
                </div>
                <div class="product-short-description">${producto.descripcion.substring(
                  0,
                  100
                )}...</div>
            </div>
        `;

    // Evento para voltear la tarjeta
    productCard.addEventListener("mouseenter", () => {
      productCard.classList.add("flipped");
    });

    productCard.addEventListener("mouseleave", () => {
      productCard.classList.remove("flipped");
    });

    // Evento para abrir el modal
    productCard.addEventListener("click", (e) => {
      if (!e.target.classList.contains("btn-details")) {
        abrirProducto(producto.id);
      }
    });

    productsContainer.appendChild(productCard);
  });
}

// Abrir modal de producto con nueva vista
function abrirProducto(id) {
  const producto = productos.find((p) => p.id === id);

  if (producto) {
    // Calcular precio con descuento si aplica
    const tieneDescuento = producto.descuento && producto.descuento > 0;
    const precioOriginal = producto.precio;
    const precioDescuento = tieneDescuento
      ? ((precioOriginal * (100 - producto.descuento)) / 100).toFixed(2)
      : precioOriginal.toFixed(2);

    // Obtener productos promocionados (solo los disponibles)
    const productosPromocionados = productos.filter(
      (p) => producto.promocionados.includes(p.id) && p.disponible
    );

    // Función para formatear texto con saltos de línea y negritas
    function formatearTexto(texto) {
      if (!texto) return "";

      // Convertir **...** a negritas (en lugar de \s...\s)
      let textoFormateado = texto.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

      // Convertir \n a párrafos
      return textoFormateado
        .split("\n")
        .map((parrafo) => (parrafo.trim() ? `<p>${parrafo}</p>` : ""))
        .join("");
    }

    modalProductContent.innerHTML = `
            <img src="${producto.imagen}" alt="${producto.nombre}" class="modal-image">
            
            <div class="modal-title-container">
                <h2 class="modal-title">${producto.nombre}</h2>
                <span class="product-code">Notificación Sanitaria: ${
                  producto.codigo || producto.id
                }</span>
            </div>
            
            <div class="modal-price-container">
                <div class="modal-price">
                    ${
                      tieneDescuento
                        ? `<span class="original-price">$${precioOriginal.toFixed(2)}</span>`
                        : ""
                    }
                    <span class="${
                      tieneDescuento ? "discounted-price" : ""
                    }">$${precioDescuento}</span>
                </div>
                ${
                  producto.logo
                    ? `<img src="${producto.logo}" alt="Logo ${producto.nombre}" class="modal-logo">`
                    : ""
                }
            </div>
            
            <!-- Disclaimer en la posición correcta - justo antes de las acciones -->
            ${
              producto.disclaimer
                ? `<div class="product-disclaimer">${formatearTexto(producto.disclaimer)}</div>`
                : ""
            }
            
            <div class="description-tabs">
                <div class="description-tab active" data-tab="descripcion">Descripción</div>
                <div class="description-tab" data-tab="funcion">Para qué funciona</div>
                <div class="description-tab" data-tab="contraindicaciones">Contraindicaciones</div>
                <div class="description-tab" data-tab="otros">Otros detalles</div>
            </div>
            
            <div class="description-content active" id="descripcion">
                ${formatearTexto(producto.descripcion)}
            </div>
            
            <div class="description-content" id="funcion">
                ${formatearTexto(producto.descripciones.principal)}
            </div>
            
            <div class="description-content" id="contraindicaciones">
                ${formatearTexto(producto.contraindicaciones)}
            </div>

            <div class="description-content" id="otros">
                ${formatearTexto(producto.descripciones.otros)}
            </div>

            <div class="product-actions">
                <div class="quantity-control">
                    <button class="quantity-btn" onclick="cambiarCantidad(-1)">
                        <i class="fas fa-minus"></i>
                    </button>
                    <input type="number" id="productQuantity" class="quantity-input" value="1" min="1">
                    <button class="quantity-btn" onclick="cambiarCantidad(1)">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                
                <button class="btn btn-primary btn-add-to-cart" onclick="agregarAlCarrito(${
                  producto.id
                })">
                    <i class="fas fa-shopping-cart"></i> Agregar al Carrito
                </button>
            </div>
            
            ${
              productosPromocionados.length > 0
                ? `
            <div class="related-products">
                <h3>También te podría gustar</h3>
                <div class="related-grid">
                    ${productosPromocionados
                      .map(
                        (p) => `
                        <div class="related-product" onclick="abrirProducto(${p.id})">
                            <img src="${p.imagen}" alt="${p.nombre}">
                            <div class="related-product-overlay">
                                <span>Ver detalles</span>
                            </div>
                        </div>
                    `
                      )
                      .join("")}
                </div>
            </div>
            `
                : ""
            }
        `;

    // Agregar funcionalidad a las pestañas
    const tabs = modalProductContent.querySelectorAll(".description-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        // Remover clase activa de todas las pestañas
        tabs.forEach((t) => t.classList.remove("active"));
        // Ocultar todos los contenidos
        document
          .querySelectorAll(".description-content")
          .forEach((c) => c.classList.remove("active"));

        // Activar la pestaña clickeada
        tab.classList.add("active");
        const tabId = tab.dataset.tab;
        document.getElementById(tabId).classList.add("active");
      });
    });

    productModal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }
}

// Cambiar cantidad en el modal de producto
function cambiarCantidad(delta) {
  const input = document.getElementById("productQuantity");
  let value = parseInt(input.value) || 1;
  value += delta;

  if (value < 1) value = 1;
  input.value = value;
}

// Cerrar modal de producto
function cerrarModalProducto() {
  productModal.style.display = "none";
  document.body.style.overflow = "auto";
}

async function ensureAuthOrOpenLogin(opts = {}) {
  const { reason, closeProductModal } = opts;
  if (document.documentElement.classList.contains("auth-ok")) return true;

  try {
    const perfil = await window.api.getMiPerfil();
    if (perfil) return true;
  } catch {}

  if (closeProductModal) {
    try {
      cerrarModalProducto();
    } catch {}
  }

  const loginModal = document.getElementById("loginModal");
  if (loginModal) loginModal.style.display = "flex";

  const msg = reason || "Inicia sesión para continuar.";
  if (window.Snackbar?.error) window.Snackbar.error(msg, 2600);
  else if (window.Snackbar?.show) window.Snackbar.show(msg, { type: "error", ms: 2600 });
  else mostrarNotificacion?.(msg); // fallback
  return false;
}

async function agregarAlCarrito(productoId) {
  if (
    !(await ensureAuthOrOpenLogin({
      reason: "Inicia sesión para añadir productos al carrito.",
      closeProductModal: true,
    }))
  )
    return;

  const producto = productos.find((p) => p.id === productoId);
  const cantidad = parseInt(document.getElementById("productQuantity")?.value) || 1;
  if (!producto) return;

  const tieneDescuento = producto.descuento && producto.descuento > 0;
  const precioFinal = tieneDescuento
    ? (producto.precio * (100 - producto.descuento)) / 100
    : producto.precio;

  const idx = carrito.findIndex((it) => it.id === producto.id);
  if (idx !== -1) carrito[idx].cantidad += cantidad;
  else
    carrito.push({
      id: producto.id,
      nombre: producto.nombre,
      imagen: producto.imagen,
      precio: precioFinal,
      cantidad,
    });

  guardarCarrito();
  actualizarCarrito();
  cerrarModalProducto();
  mostrarNotificacion?.(`Se agregaron ${cantidad} unidad(es) de "${producto.nombre}" al carrito.`);
}

// Manejo de categorías
function inicializarCategorias() {
  const buttons = document.querySelectorAll(".category-btn");
  buttons.forEach((button) => {
    button.onclick = () => {
      buttons.forEach((b) => b.classList.remove("active"));
      button.classList.add("active");

      const cid = button.getAttribute("data-category-id");
      currentCategoryId = cid ? Number(cid) : null; // null = “todos”
      renderizarProductos();
    };
  });
}

// Event listeners
if (closeProductModal) {
  closeProductModal.addEventListener("click", cerrarModalProducto);
}

// Cerrar modal al hacer click fuera del contenido
if (productModal) {
  productModal.addEventListener("click", (e) => {
    if (e.target === productModal) {
      cerrarModalProducto();
    }
  });
}

// Cerrar modal con tecla ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && productModal.style.display === "flex") {
    cerrarModalProducto();
  }
});

// Cargar productos cuando la página esté lista
document.addEventListener("DOMContentLoaded", function () {
  cargarProductos();
  inicializarCategorias();
});

// Función para cambiar categoría desde otros lugares (si es necesario)
function cambiarCategoria(categoria) {
  const button = document.querySelector(`.category-btn[data-category="${categoria}"]`);
  if (button) {
    button.click();
  }
}

// Abrir modal de carrito
async function abrirCarrito() {
  if (
    !(await ensureAuthOrOpenLogin({
      reason: "Debes iniciar sesión para ver tu carrito.",
    }))
  )
    return;

  cargarCarritoItems();
  cartModal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

// Cerrar modal de carrito
function cerrarModalCarrito() {
  cartModal.style.display = "none";
  document.body.style.overflow = "auto";
}

// Cargar items del carrito
function cargarCarritoItems() {
  cartItems.innerHTML = "";

  if (carrito.length === 0) {
    cartItems.innerHTML = '<div class="empty-cart">Tu carrito está vacío</div>';
    cartTotal.textContent = "Total: $0.00";
    return;
  }

  carrito.forEach((item) => {
    const cartItem = document.createElement("div");
    cartItem.className = "cart-item";
    cartItem.innerHTML = `
            <img src="${item.imagen}" alt="${item.nombre}" class="cart-item-image">
            <div class="cart-item-info">
                <h3 class="cart-item-title">${item.nombre}</h3>
                <div class="cart-item-price">$${(item.precio * item.cantidad).toFixed(2)}</div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn" onclick="actualizarCantidadCarrito(${
                      item.id
                    }, -1)">-</button>
                    <span>${item.cantidad}</span>
                    <button class="quantity-btn" onclick="actualizarCantidadCarrito(${
                      item.id
                    }, 1)">+</button>
                </div>
                <div class="cart-item-actions">
                    <button class="cart-item-delete" onclick="eliminarDelCarrito(${item.id})">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        `;
    cartItems.appendChild(cartItem);
  });

  // Actualizar total
  const total = carrito.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  cartTotal.textContent = `Total: $${total.toFixed(2)}`;
}

// Actualizar cantidad en el carrito
function actualizarCantidadCarrito(id, delta) {
  const itemIndex = carrito.findIndex((item) => item.id === id);

  if (itemIndex !== -1) {
    carrito[itemIndex].cantidad += delta;

    if (carrito[itemIndex].cantidad < 1) {
      carrito.splice(itemIndex, 1);
    }

    guardarCarrito();
    actualizarCarrito();
    cargarCarritoItems();
  }
}

// Eliminar producto del carrito
function eliminarDelCarrito(id) {
  carrito = carrito.filter((item) => item.id !== id);
  guardarCarrito();
  actualizarCarrito();
  cargarCarritoItems();
}

// En la función finalizarCompra, reemplaza con este código:
function finalizarCompra() {
  if (carrito.length === 0) {
    mostrarNotificacion("Tu carrito está vacío");
    return;
  }

  // Crear objeto con timestamp para verificar frescura de los datos
  const carritoConTimestamp = {
    items: carrito,
    timestamp: new Date().getTime(),
    origin: window.location.origin,
    // Agregar checksum para verificación de integridad
    checksum: calcularChecksum(carrito),
  };

  // Almacenar en múltiples lugares para mayor seguridad
  try {
    localStorage.setItem("carritoCheckout", JSON.stringify(carritoConTimestamp));
    console.log("Carrito guardado en localStorage");
  } catch (e) {
    console.error("Error con localStorage:", e);
  }

  try {
    sessionStorage.setItem("carritoCheckout", JSON.stringify(carritoConTimestamp));
    console.log("Carrito guardado en sessionStorage");
  } catch (e) {
    console.error("Error con sessionStorage:", e);
  }

  // Usar cookies como respaldo
  try {
    const carritoString = JSON.stringify(carritoConTimestamp);
    document.cookie = `carritoCheckout=${encodeURIComponent(
      carritoString
    )}; max-age=300; path=/; samesite=lax`;
    console.log("Carrito guardado en cookies");
  } catch (e) {
    console.error("Error con cookies:", e);
  }

  // Redirigir con parámetros URL como último recurso
  try {
    const carritoParam = encodeURIComponent(JSON.stringify(carritoConTimestamp));
    if (carritoParam.length < 2000) {
      // Límite seguro para URLs
      window.location.href = `checkout/checkout.html?carrito=${carritoParam}`;
    } else {
      window.location.href = "checkout/checkout.html";
    }
  } catch (e) {
    console.error("Error al generar URL:", e);
    window.location.href = "checkout/checkout.html";
  }
}

// Función para calcular checksum de verificación
function calcularChecksum(carrito) {
  let checksum = 0;
  carrito.forEach((item) => {
    checksum += item.id * item.cantidad + item.precio;
  });
  return checksum % 1000; // Simplificado para demostración
}
// Actualizar contador de carrito
function actualizarCarrito() {
  const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
  cartCount.textContent = totalItems;
}

// Guardar carrito en localStorage
function guardarCarrito() {
  localStorage.setItem("carrito", JSON.stringify(carrito));
}

// Cargar carrito desde localStorage
function cargarCarrito() {
  const carritoGuardado = localStorage.getItem("carrito");
  if (carritoGuardado) {
    try {
      carrito = JSON.parse(carritoGuardado);
    } catch (e) {
      console.error("Error al parsear el carrito:", e);
      carrito = [];
    }
  }
}

// Mostrar notificación
function mostrarNotificacion(mensaje) {
  // Crear elemento de notificación
  const notificacion = document.createElement("div");
  notificacion.className = "notificacion";
  notificacion.textContent = mensaje;

  // Estilo para la notificación
  notificacion.style.position = "fixed";
  notificacion.style.bottom = "20px";
  notificacion.style.right = "20px";
  notificacion.style.backgroundColor = "#4CAF50";
  notificacion.style.color = "white";
  notificacion.style.padding = "15px 25px";
  notificacion.style.borderRadius = "4px";
  notificacion.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
  notificacion.style.zIndex = "10000";
  notificacion.style.opacity = "0";
  notificacion.style.transition = "opacity 0.3s";

  // Agregar al documento
  document.body.appendChild(notificacion);

  // Mostrar
  setTimeout(() => {
    notificacion.style.opacity = "1";
  }, 10);

  // Ocultar después de 3 segundos
  setTimeout(() => {
    notificacion.style.opacity = "0";
    setTimeout(() => {
      document.body.removeChild(notificacion);
    }, 300);
  }, 3000);
}
// Animación de aparición para la sección "Por qué elegirnos"
function initWhyChooseUsAnimation() {
  const whySection = document.querySelector(".why-choose-us");
  const benefits = document.querySelectorAll(".benefit");

  if (!whySection) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          whySection.classList.add("animated");

          // Animar beneficios uno por uno
          benefits.forEach((benefit, index) => {
            setTimeout(() => {
              benefit.classList.add("animated");
            }, index * 200);
          });
        }
      });
    },
    { threshold: 0.3 }
  );

  observer.observe(whySection);
}

// Llamar a la función después de cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
  initWhyChooseUsAnimation();
});

// Función para cargar testimonios creativos
async function cargarTestimoniosCreativos() {
  const cont = document.getElementById("testimonialsCreative");
  try {
    const data = await window.api.getTestimonios(); // GET /api/Testimonios
    const testimonios = (Array.isArray(data) ? data : []).map((t, i) => {
      const nombre = t.nombre ?? t.Nombre ?? "Cliente";
      const testimonio = t.testimonio ?? t.Testimonio ?? "";
      const valoracion = Number(t.valoracion ?? t.Valoracion ?? 5);
      let imagen = t.imagen ?? t.Imagen ?? "";

      // Normaliza ruta de imagen si viene relativa
      if (imagen && !/^https?:\/\//i.test(imagen) && !imagen.startsWith("/")) {
        imagen = imagen;
      }

      return { id: t.id ?? i + 1, nombre, testimonio, valoracion, imagen };
    });

    if (!testimonios.length) {
      cont.innerHTML = `<div class="empty">Aún no hay testimonios.</div>`;
      return;
    }

    renderizarTestimoniosCreativos(testimonios);
  } catch (error) {
    console.error("Error:", error);
    document.getElementById("testimonialsCreative").innerHTML = `
      <div class="error">
        <p>Error al cargar los testimonios: ${error.message || "Intenta más tarde."}</p>
      </div>`;
  }
}

// Función para renderizar testimonios creativos
function renderizarTestimoniosCreativos(testimonios) {
  const container = document.getElementById("testimonialsCreative");
  container.innerHTML = "";

  testimonios.forEach((testimonio) => {
    const card = document.createElement("div");
    card.className = "testimonial-creative-card";
    card.innerHTML = `
            <div class="testimonial-image-wrapper">
                <img src="${testimonio.imagen}" alt="${
      testimonio.nombre
    }" class="testimonial-image">
                <div class="testimonial-overlay">
                    <h3 class="testimonial-name-preview">${testimonio.nombre}</h3>
                </div>
            </div>
            <div class="testimonial-expanded-content">
                <div class="testimonial-header">
                    <div class="testimonial-customer-info">
                        <h3>${testimonio.nombre}</h3>
                        <div class="testimonial-rating">${"★".repeat(
                          testimonio.valoracion
                        )}${"☆".repeat(5 - testimonio.valoracion)}</div>
                    </div>
                </div>
                <p class="testimonial-text">${testimonio.testimonio}</p>
            </div>
            <button class="testimonial-close">
                <i class="fas fa-times"></i>
            </button>
        `;

    // Evento para expandir el testimonio
    card.addEventListener("click", (e) => {
      if (
        !card.classList.contains("active") &&
        !e.target.classList.contains("testimonial-close") &&
        !e.target.classList.contains("fa-times")
      ) {
        expandirTestimonioCreativo(card);
      }
    });

    // Evento para cerrar el testimonio
    const closeBtn = card.querySelector(".testimonial-close");
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      cerrarTestimonioCreativo(card);
    });

    container.appendChild(card);
  });
}

// Función para expandir testimonio creativo
function expandirTestimonioCreativo(card) {
  // Cerrar cualquier testimonio abierto
  document.querySelectorAll(".testimonial-creative-card.active").forEach((activeCard) => {
    if (activeCard !== card) {
      cerrarTestimonioCreativo(activeCard);
    }
  });

  // Añadir clase de desenfoque al contenedor
  document.getElementById("testimonialsCreative").classList.add("blur-active");

  // Expandir la tarjeta seleccionada
  card.classList.add("active");

  // Scroll suave hasta la tarjeta
  setTimeout(() => {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 300);
}

// Función para cerrar testimonio creativo
function cerrarTestimonioCreativo(card) {
  card.classList.remove("active");

  // Remover clase de desenfoque si no hay tarjetas activas
  setTimeout(() => {
    const activeCards = document.querySelectorAll(".testimonial-creative-card.active");
    if (activeCards.length === 0) {
      document.getElementById("testimonialsCreative").classList.remove("blur-active");
    }
  }, 300);
}

// Inicializar testimonios creativos
document.addEventListener("DOMContentLoaded", () => {
  cargarTestimoniosCreativos();

  // Cerrar testimonio al hacer clic fuera de él
  document.addEventListener("click", (e) => {
    if (
      !e.target.closest(".testimonial-creative-card.active") &&
      !e.target.closest(".testimonial-close")
    ) {
      document.querySelectorAll(".testimonial-creative-card.active").forEach((card) => {
        cerrarTestimonioCreativo(card);
      });
    }
  });
});
// Cargar promociones para el carrusel
async function cargarPromociones() {
  try {
    const data = await window.api.getPromociones();
    const promociones = (Array.isArray(data) ? data : []).map((p, i) => ({
      id: p.id ?? i + 1,
      titulo: p.titulo ?? p.Titulo ?? "Promoción",
      descripcion: p.descripcion ?? p.Descripcion ?? "",
      imagen: p.imagen ?? p.Imagen ?? "",
      background: p.background ?? p.Background ?? "",
      fondo: (p.fondo ?? p.Fondo ?? "solido").toLowerCase(),
      colorTexto: p.colorTexto ?? p.ColorTexto ?? "#fff",
      textoAlineacion: (p.textoAlineacion ?? p.TextoAlineacion ?? "izquierda").toLowerCase(),
      textoPosicion: (p.textoPosicion ?? p.TextoPosicion ?? "izquierda").toLowerCase(),
      botonTexto: p.botonTexto ?? p.BotonTexto ?? "Ver más",
      botonUrl: p.botonUrl ?? p.BotonUrl ?? "#",
    }));

    if (!promociones.length) throw new Error("Sin promociones");

    inicializarCarrusel(promociones);
  } catch (error) {
    console.error("Error:", error);
    document.querySelector(".hero").innerHTML = `
      <div class="container">
        <div class="hero-content">
          <h2>Nuevas Ofertas Especiales</h2>
          <p>Hasta 50% de descuento en productos seleccionados</p>
          <a href="#" class="btn">Ver Ofertas</a>
        </div>
      </div>`;
  }
}

// Inicializar carrusel con las promociones
function inicializarCarrusel(promociones) {
  const heroSection = document.querySelector(".hero");
  let carruselHTML = `
        <div class="hero-carousel">
            <div class="carousel-nav">
                <div class="carousel-prev"><i class="fas fa-chevron-left"></i></div>
                <div class="carousel-next"><i class="fas fa-chevron-right"></i></div>
            </div>
            <div class="carousel-controls"></div>
    `;

  // Generar slides
  promociones.forEach((promo, index) => {
    const slideClass = index === 0 ? "carousel-slide active" : "carousel-slide";
    const fondoClass = promo.fondo === "imagen" ? "imagen" : "solido";

    // Estilo de fondo para imágenes
    const backgroundStyle =
      promo.background && promo.fondo === "imagen"
        ? `style="background-image: url('${promo.background}')"`
        : "";

    // Usar la nueva propiedad textoPosicion para la posición, y textoAlineacion para la alineación
    const textoPosicion = promo.textoPosicion || "izquierda";
    const imagenPosicion = textoPosicion === "izquierda" ? "derecha" : "izquierda";

    // Determinar el target para el botón basado en el texto del botón
    let targetUrl = promo.botonUrl;
    if (promo.botonTexto === "Aprovechar oferta") {
      targetUrl = "featured-products";
    }

    carruselHTML += `
            <div class="${slideClass} ${fondoClass}" data-id="${promo.id}" ${backgroundStyle}>
                <div class="carousel-content">
                    <div class="carousel-text alineacion-${promo.textoAlineacion} posicion-${textoPosicion}" style="color: ${promo.colorTexto}">
                        <h2>${promo.titulo}</h2>
                        <p>${promo.descripcion}</p>
                        <a href="#" class="carousel-btn" data-target="${targetUrl}">${promo.botonTexto}</a>
                    </div>
                    <div class="carousel-image posicion-${imagenPosicion}">
                        <img src="${promo.imagen}" alt="${promo.titulo}" class="floating">
                    </div>
                </div>
            </div>
        `;
  });

  carruselHTML += `</div>`;
  heroSection.innerHTML = carruselHTML;

  // Generar dots de control
  const controlsContainer = document.querySelector(".carousel-controls");
  promociones.forEach((_, index) => {
    const dotClass = index === 0 ? "carousel-dot active" : "carousel-dot";
    controlsContainer.innerHTML += `<div class="${dotClass}" data-slide="${index}"></div>`;
  });

  // Inicializar funcionalidad del carrusel
  inicializarControlesCarrusel(promociones.length);

  // Agregar event listeners a los botones del carrusel
  agregarEventListenersCarrusel();
}

// Agregar event listeners a los botones del carrusel
function agregarEventListenersCarrusel() {
  const carruselBotones = document.querySelectorAll(".carousel-btn");

  carruselBotones.forEach((boton) => {
    boton.addEventListener("click", function (e) {
      e.preventDefault();
      const targetSection = this.getAttribute("data-target");

      if (targetSection) {
        // Si el target incluye #, es un anchor interno
        if (targetSection.startsWith("#")) {
          const sectionId = targetSection.substring(1);
          scrollToSection(sectionId);
        } else {
          // Si no tiene #, asumimos que es un ID/clase de sección
          scrollToSection(targetSection);
        }
      }
    });
  });
}

// Inicializar controles del carrusel (esta función permanece igual)
function inicializarControlesCarrusel(totalSlides) {
  const slides = document.querySelectorAll(".carousel-slide");
  const dots = document.querySelectorAll(".carousel-dot");
  const prevBtn = document.querySelector(".carousel-prev");
  const nextBtn = document.querySelector(".carousel-next");
  let currentSlide = 0;
  let autoPlayInterval;

  function showSlide(index) {
    slides.forEach((slide) => slide.classList.remove("active"));
    dots.forEach((dot) => dot.classList.remove("active"));

    slides[index].classList.add("active");
    dots[index].classList.add("active");

    currentSlide = index;
  }

  function nextSlide() {
    let nextIndex = (currentSlide + 1) % totalSlides;
    showSlide(nextIndex);
  }

  function prevSlide() {
    let prevIndex = (currentSlide - 1 + totalSlides) % totalSlides;
    showSlide(prevIndex);
  }

  nextBtn.addEventListener("click", nextSlide);
  prevBtn.addEventListener("click", prevSlide);

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      showSlide(index);
      resetAutoPlay();
    });
  });

  function startAutoPlay() {
    autoPlayInterval = setInterval(nextSlide, 5000);
  }

  function resetAutoPlay() {
    clearInterval(autoPlayInterval);
    startAutoPlay();
  }

  startAutoPlay();

  const carousel = document.querySelector(".hero-carousel");
  carousel.addEventListener("mouseenter", () => {
    clearInterval(autoPlayInterval);
  });

  carousel.addEventListener("mouseleave", () => {
    startAutoPlay();
  });
}

// Función para desplazamiento suave a secciones
function scrollToSection(sectionId) {
  console.log("Buscando sección:", sectionId);

  let element = null;

  // Mapeo especial para textos de botones específicos
  const buttonTextMap = {
    calmantes: "why-choose-us", // "Conócenos mejor" debe ir a "why-choose-us"
    conocenos: "why-choose-us",
    "conoce-nosotros": "why-choose-us",
    about: "why-choose-us",
    nosotros: "why-choose-us",
    oferta: "featured-products", // "Aprovechar oferta" debe ir a productos destacados
    ofertas: "featured-products",
    promocion: "featured-products",
  };

  // Si el sectionId coincide con algún texto de botón especial, reemplazarlo
  if (buttonTextMap[sectionId]) {
    sectionId = buttonTextMap[sectionId];
    console.log("Sección mapeada a:", sectionId);
  }

  // Buscar por ID primero
  element = document.getElementById(sectionId);

  // Si no se encuentra por ID, buscar por clase
  if (!element) {
    element = document.querySelector("." + sectionId);
  }

  // Buscar en secciones comunes si aún no se encuentra
  if (!element) {
    const sectionMap = {
      categories: ".categories",
      productos: ".products-section",
      calmantes: ".why-choose-us", // Mapeo adicional para calmantes
      productsContainer: ".products-section",
      "featured-products": ".featured-products",
      destacados: ".featured-products",
      "ofertas-especiales": ".featured-products",
      "why-choose-us": ".why-choose-us",
      "why-choose-biofx": ".why-choose-us",
      "por-que-elegirnos": ".why-choose-us",
      "stats-section": ".stats-section",
      "testimonials-section": ".testimonials-section",
      hero: ".hero",
    };

    const mappedSection = sectionMap[sectionId];
    if (mappedSection) {
      element = document.querySelector(mappedSection);
    }
  }

  if (element) {
    const header = document.querySelector("header");
    const headerHeight = header ? header.offsetHeight : 0;
    const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
    const offsetPosition = elementPosition - headerHeight - 20;

    window.scrollTo({
      top: offsetPosition,
      behavior: "smooth",
    });

    console.log("Desplazándose a:", sectionId);
  } else {
    console.warn("No se encontró la sección:", sectionId);

    // Fallback: desplazarse al inicio de los productos
    const productsSection = document.querySelector(".products-section");
    if (productsSection) {
      const header = document.querySelector("header");
      const headerHeight = header ? header.offsetHeight : 0;
      const elementPosition = productsSection.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - headerHeight - 20;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  }
}

// Agregar event listeners a los enlaces del footer
function agregarEventListenersFooter() {
  const footerLinks = document.querySelectorAll("footer a[data-section]");

  footerLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const targetSection = this.getAttribute("data-section");

      if (targetSection) {
        scrollToSection(targetSection);
      }
    });
  });
}

// Animación de conteo para las estadísticas
function animateValue(id, start, end, duration, options = {}) {
  const element = document.getElementById(id);
  if (!element) return;

  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);

    // Calcular valor actual
    let currentValue;
    if (options.isPercentage) {
      currentValue = Math.floor(progress * (end - start) + start);
      element.innerHTML = currentValue + "%";
    } else if (options.isFraction) {
      currentValue = Math.floor(progress * (end - start) + start);
      element.innerHTML = currentValue + "/10";
    } else {
      currentValue = Math.floor(progress * (end - start) + start);

      // Formatear número con separador de miles y signo +
      if (currentValue >= 1000) {
        element.innerHTML = "+" + currentValue.toLocaleString();
      } else {
        element.innerHTML = "+" + currentValue;
      }
    }

    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

// Iniciar animaciones cuando la sección es visible
function initStatsAnimation() {
  const statsSection = document.querySelector(".stats-section");
  if (!statsSection) return;

  const rect = statsSection.getBoundingClientRect();
  const isVisible = rect.top <= window.innerHeight * 0.8 && rect.bottom >= 0;

  if (isVisible) {
    // +1,500 clientes felices
    animateValue("stat1", 0, 1500, 2000);

    // 95% de entregas
    animateValue("stat2", 0, 95, 2000, { isPercentage: true });

    // 98% de consultas atendidas
    animateValue("stat3", 0, 98, 2000, { isPercentage: true });

    // 10/10 pedidos incluyen regalos
    animateValue("stat4", 0, 10, 2000, { isFraction: true });

    // 70% de clientes vuelven
    animateValue("stat5", 0, 70, 2000, { isPercentage: true });

    window.removeEventListener("scroll", initStatsAnimation);
  }
}

// Iniciar cuando la página carga
document.addEventListener("DOMContentLoaded", function () {
  // Iniciar la animación de estadísticas si ya son visibles
  initStatsAnimation();

  // O escuchar al scroll si no son visibles aún
  window.addEventListener("scroll", initStatsAnimation);
});

// Funcionalidad para el modal de login
document.addEventListener("DOMContentLoaded", function () {
  const userButton = document.getElementById("userButton");
  const loginModal = document.getElementById("loginModal");

  if (userButton && loginModal) {
    userButton.addEventListener("click", async function (e) {
      e.preventDefault();
      e.stopPropagation();

      try {
        const perfil = await window.api.getMiPerfil();
        if (perfil) {
          window.location.assign(linkProfile);
        } else {
          loginModal.style.display = "flex";
        }
      } catch {
        loginModal.style.display = "flex";
      }
    });

    // cierre del modal
    const closeLoginModal = document.getElementById("closeLoginModal");
    if (closeLoginModal) {
      closeLoginModal.addEventListener("click", function () {
        loginModal.style.display = "none";
      });
    }
    loginModal.addEventListener("click", function (e) {
      if (e.target === loginModal) loginModal.style.display = "none";
    });
  }
});
// Función de búsqueda en tiempo real
function buscarEnTiempoReal() {
  const searchTerm = searchInput.value.toLowerCase().trim();

  if (searchTerm.length < 2) {
    searchResults.style.display = "none";
    return;
  }

  // Asegúrate de que 'productos' es tu array de productos
  const resultados = productos.filter(
    (producto) =>
      producto.nombre.toLowerCase().includes(searchTerm) ||
      producto.descripcion.toLowerCase().includes(searchTerm)
  );

  mostrarResultadosBusqueda(resultados);
}

// Función para mostrar los resultados de búsqueda
function mostrarResultadosBusqueda(resultados) {
  if (resultados.length === 0) {
    searchResults.innerHTML = '<div class="search-result-item">No se encontraron productos</div>';
    searchResults.style.display = "block";
    return;
  }

  searchResults.innerHTML = resultados
    .map((producto) => {
      // Calcular precio con descuento si existe
      const precioOriginal = producto.precio;
      const tieneDescuento = producto.descuento && producto.descuento > 0;
      const precioConDescuento = tieneDescuento
        ? precioOriginal * (1 - producto.descuento / 100)
        : precioOriginal;

      return `
            <div class="search-result-item" data-id="${producto.id}">
                <img src="${producto.imagen}" alt="${producto.nombre}" class="search-result-image" 
                     onerror="this.src='https://via.placeholder.com/40x40/cccccc/666666?text=IMG'">
                <div class="search-result-info">
                    <div class="search-result-name">${producto.nombre}</div>
                    <!-- Eliminada la descripción como solicitaste -->
                </div>
                <div class="search-result-price">
                    ${
                      tieneDescuento
                        ? `<span class="price-original">$${precioOriginal.toFixed(2)}</span>
                         <span class="price-discount">$${precioConDescuento.toFixed(2)}</span>`
                        : `<span class="price-normal">$${precioOriginal.toFixed(2)}</span>`
                    }
                </div>
            </div>
        `;
    })
    .join("");

  searchResults.style.display = "block";
}

// Función de búsqueda al hacer clic en el botón
function buscarProductos() {
  const searchTerm = searchInput.value.toLowerCase().trim();

  if (searchTerm === "") {
    // Si está vacío, restaurar vista normal
    currentCategory = "todos";
    renderizarProductos();
    searchResults.style.display = "none";
    return;
  }

  buscarEnTiempoReal(); // Reutilizamos la misma lógica
}

// Event listeners
searchInput.addEventListener("input", buscarEnTiempoReal);
searchButton.addEventListener("click", buscarProductos);

// Mostrar resultados cuando el input recibe foco (si ya hay texto)
searchInput.addEventListener("focus", function () {
  if (searchInput.value.length >= 2) {
    buscarEnTiempoReal();
  }
});

// Event listener para cuando se hace clic en un resultado
searchResults.addEventListener("click", function (e) {
  const item = e.target.closest(".search-result-item");
  if (item) {
    const productId = item.dataset.id;
    // Aquí puedes redirigir a la página del producto
    console.log("Producto seleccionado:", productId);
    // Ejemplo: window.location.href = `/producto.html?id=${productId}`;

    // O si tienes una función para abrir el modal/producto:
    // abrirProducto(productId);

    searchResults.style.display = "none";
    searchInput.value = "";
  }
});

// Cerrar resultados cuando se hace clic fuera
document.addEventListener("click", function (e) {
  if (!e.target.closest(".search-container")) {
    searchResults.style.display = "none";
  }
});

// Añadir event listeners cuando el DOM esté cargado
document.addEventListener("DOMContentLoaded", function () {
  const sectionLinks = document.querySelectorAll("a[data-section]");
  sectionLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      let sectionId = this.getAttribute("data-section");

      // Ajustes personalizados de redirección
      if (sectionId === "biofx") sectionId = "why-choose-us";
      if (["amigo", "estudiantes", "packs"].includes(sectionId)) sectionId = "featured-products";
      if (sectionId === "Estadísticas") sectionId = "stats-section";
      if (sectionId === "Testimonios") sectionId = "testimonials-section";

      scrollToSection(sectionId);
    });
  });

  // Enlaces de WhatsApp
  const whatsappLinks = document.querySelectorAll(".whatsapp-link");
  whatsappLinks.forEach((link) => {
    link.addEventListener("click", function () {
      console.log("Redirigiendo a WhatsApp");
    });
  });
});

// Función para manejar el cambio de tamaño del logo al hacer scroll
function handleLogoScroll() {
  const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
  const header = document.querySelector(".header");

  // Cambiar al isotipo al hacer scroll hacia abajo
  if (currentScroll > 50) {
    header.classList.add("shrink");
  } else {
    header.classList.remove("shrink");
  }
}
// Event listener
window.addEventListener("scroll", handleLogoScroll);

// Inicializar eventos cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", function () {
  // Agregar event listener para el scroll
  window.addEventListener("scroll", handleLogoScroll, { passive: true });

  // Opcional: Asegurarse de que el header tenga el tamaño correcto al cargar
  handleLogoScroll();
});
document.addEventListener("DOMContentLoaded", () => {
  const footerLogo = document.querySelector(".footer .logo-img");
  const overlay = document.querySelector(".secret-lab-overlay");
  const closeBtn = document.querySelector(".close-secret-lab");
  const canvas = document.getElementById("secretLabCanvas");
  const ctx = canvas.getContext("2d");

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // === Partículas ===
  class Particle {
    constructor(x, y, color) {
      // posición inicial aleatoria
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;

      // posición objetivo (del path del SVG)
      this.ox = x;
      this.oy = y;

      this.color = color;
      this.radius = 2 + Math.random() * 2;
      this.vx = 0;
      this.vy = 0;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 12;
      ctx.fill();
    }

    update(mouse) {
      // atracción a su posición original
      const dx = this.ox - this.x;
      const dy = this.oy - this.y;
      this.vx += dx * 0.01;
      this.vy += dy * 0.01;

      // interacción con mouse (repulsión)
      const mdx = this.x - mouse.x;
      const mdy = this.y - mouse.y;
      const dist = Math.sqrt(mdx * mdx + mdy * mdy);
      if (dist < 100) {
        this.vx += mdx * 0.1;
        this.vy += mdy * 0.1;
      }

      // fricción
      this.vx *= 0.9;
      this.vy *= 0.9;

      // mover
      this.x += this.vx;
      this.y += this.vy;

      this.draw();
    }
  }

  let particles = [];
  let mouse = { x: -9999, y: -9999 };

  function createParticlesFromSVG() {
    particles = [];
    const path = document.getElementById("logo-path");
    const length = path.getTotalLength();
    const colors = ["#9bc431", "#2eb198", "#616160"];

    for (let i = 0; i < length; i += 8) {
      const point = path.getPointAtLength(i);
      const px = canvas.width / 2 - 640 + point.x; // centrar
      const py = canvas.height / 2 - 512 + point.y;
      const color = colors[Math.floor(Math.random() * colors.length)];
      particles.push(new Particle(px, py, color));
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // conectar partículas
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 40) {
          ctx.strokeStyle = "rgba(46,177,152,0.2)";
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    particles.forEach((p) => p.update(mouse));
    requestAnimationFrame(animate);
  }

  // eventos de mouse
  canvas.addEventListener("mousemove", (e) => {
    mouse.x = e.offsetX;
    mouse.y = e.offsetY;
  });

  canvas.addEventListener("mouseleave", () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });

  // Abrir / Cerrar overlay
  footerLogo.addEventListener("click", (e) => {
    e.preventDefault();
    overlay.style.display = "flex";
    createParticlesFromSVG();
    animate();
  });

  closeBtn.addEventListener("click", () => {
    overlay.style.display = "none";
    particles = [];
  });
});

// Ajustar dinámicamente la posición del banner cuando el header cambia
function inicializarBannerFijo() {
  const header = document.querySelector(".header");
  const promoBanner = document.querySelector(".promo-banner");
  const mainContent = document.querySelector(".main-content");

  if (!header || !promoBanner || !mainContent) return;

  // Función para actualizar posiciones
  function actualizarPosiciones() {
    const headerHeight = header.offsetHeight;
    const bannerHeight = promoBanner.offsetHeight;

    // Actualizar posición del banner
    promoBanner.style.top = headerHeight + "px";

    // Actualizar margen del contenido principal
    mainContent.style.marginTop = headerHeight + bannerHeight + "px";
  }

  // Ejecutar al cargar
  actualizarPosiciones();

  // Observar cambios en el header
  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.attributeName === "class") {
        // Pequeño delay para que termine la transición del header
        setTimeout(actualizarPosiciones, 300);
      }
    });
  });

  // Configurar el observer
  observer.observe(header, {
    attributes: true,
    attributeFilter: ["class"],
  });

  // También actualizar en resize
  window.addEventListener("resize", actualizarPosiciones);
}

// Inicializar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", function () {
  inicializarBannerFijo();
});
