class ApiService {
  constructor(baseURL = window.API_BASE_URL) {
    this.baseURL = baseURL;
  }

  async request(path, { method = "GET", body, headers = {} } = {}) {
    const res = await fetch(`${this.baseURL}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    });

    if (!res.ok) {
      const err = new Error();
      err.status = res.status;
      try {
        const j = await res.json();
        const parts = [];
        if (j.message) parts.push(j.message);
        if (j.code) parts.push(`SQL ${j.code}`);
        if (j.error) parts.push(j.error);
        err.message = parts.join(" • ") || `HTTP ${res.status} ${res.statusText}`;
      } catch {
        err.message = `HTTP ${res.status} ${res.statusText}`;
      }
      throw err;
    }

    if (res.status === 204) return null;

    // Soporta respuestas no-JSON o envueltas
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        return { raw: text };
      }
    }
    return await res.json();
  }

  // Auth
  login(email, password) {
    return this.request("/api/Auth/login", {
      method: "POST",
      body: { email, password },
    });
  }
  logout() {
    return this.request("/api/Auth/logout", { method: "POST" });
  }

  // Perfil
  async getMiPerfil() {
    try {
      return await this.request("/api/Persona/mi-perfil");
    } catch (e) {
      if (e?.status === 401) return null;
      throw e;
    }
  }

  updatePersona({ nombre, apellido, telefono }) {
    return this.request("/api/Persona/actualizar", {
      method: "PUT",
      body: { nombre, apellido, telefono },
    });
  }

  getPromociones() {
    return this.request("/api/Promociones");
  }

  getTestimonios() {
    return this.request("/api/Testimonios");
  }

  getCategorias() {
    return this.request("/api/Categorias");
  }

  getProductos() {
    return this.request("/api/Productos");
  }

  getProductosPorCategoria(categoriaId) {
    return this.request(`/api/Productos/categoria/${categoriaId}`);
  }

  register({ email, password, nombre, apellido, telefono }) {
    return this.request("/api/Account/register", {
      method: "POST",
      body: { email, password, nombre, apellido, telefono },
    });
  }

  // Carrito
  getMyCart() {
    return this.request("/api/ShoppingCart/mine"); // crea si no existe
  }
  clearMyCart() {
    return this.request("/api/ShoppingCart/clear", { method: "POST" });
  }
  addCartItem(productId, quantity) {
    return this.request("/api/CartItems/add", {
      method: "POST",
      body: { productId, quantity },
    });
  }
  updateCartItemQty(itemId, quantity) {
    return this.request(`/api/CartItems/${itemId}`, {
      method: "PUT",
      body: { quantity },
    });
  }
  removeCartItem(itemId) {
    return this.request(`/api/CartItems/${itemId}`, { method: "DELETE" });
  }

  // Orders / Checkout
  async createOrderFromCart(reference, description) {
    const r = await this.request("/api/Orders/create", {
      method: "POST",
      body: { reference, description },
    });

    console.log("createOrderFromCart raw response:", r);

    const oid = Number(r?.orderId ?? r?.id ?? r?.OrderId);

    // Guarda el último orderId creado en la instancia
    if (Number.isFinite(oid) && oid > 0) {
      this.lastOrderId = oid;
    } else {
      this.lastOrderId = undefined;
    }

    return { ...r, orderId: oid };
  }

  createPlacetoPaySession(orderOrId, returnUrl) {
    // 1) Intenta usar el valor que le pasen
    let oid = Number(orderOrId);

    // 2) Si vino un objeto, intenta extraer el id de sus propiedades
    if ((!Number.isFinite(oid) || oid <= 0) && orderOrId && typeof orderOrId === "object") {
      oid = Number(orderOrId.orderId ?? orderOrId.id ?? orderOrId.OrderId);
    }

    // 3) Si sigue siendo inválido, usa el último orderId creado
    if (!Number.isFinite(oid) || oid <= 0) {
      oid = Number(this.lastOrderId);
    }

    console.log("createPlacetoPaySession input:", { orderOrId, oid });

    if (!Number.isFinite(oid) || oid <= 0) {
      throw new Error("orderId inválido");
    }

    return this.request(`/api/Orders/${oid}/placetopay/session`, {
      method: "POST",
      body: { returnUrl },
    });
  }

  getOrderStatus(orderId) {
    return this.request(`/api/Orders/${orderId}/status`);
  }

  refreshByRequestId(requestId) {
    return this.request(`/api/Transactions/refresh-by-request`, {
      method: "POST",
      body: { requestId },
    });
  }
}

window.api = new ApiService();
