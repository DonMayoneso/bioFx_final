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
        err.message = j.message || j.error || JSON.stringify(j);
      } catch {
        err.message = `HTTP ${res.status} ${res.statusText}`;
      }
      throw err;
    }
    // 204 no content
    if (res.status === 204) return null;
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
}

window.api = new ApiService();
