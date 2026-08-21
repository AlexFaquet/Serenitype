export class SerenityAPI {
  constructor() { this.user = null; this.revision = null; this.available = true; }

  async request(path, options = {}) {
    if (!this.available) throw new Error("Sync server is unavailable.");
    let response;
    try {
      response = await fetch(`/api${path}`, {
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options,
        body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
      });
    } catch {
      this.available = false;
      throw new Error("Sync server is unavailable. Your local garden is safe.");
    }
    const payload = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) { const error = new Error(payload?.error || "The sync server could not complete that request."); error.status = response.status; error.payload = payload; throw error; }
    return payload;
  }

  async checkSession() {
    try { const result = await this.request("/me"); this.user = result.user; return this.user; }
    catch (error) { if (error.message.includes("unavailable")) return null; this.user = null; return null; }
  }

  async register(email, password, displayName) {
    const result = await this.request("/auth/register", { method: "POST", body: { email, password, displayName } });
    this.user = result.user; return result;
  }
  async login(email, password) { const result = await this.request("/auth/login", { method: "POST", body: { email, password } }); this.user = result.user; return result; }
  async logout() { await this.request("/auth/logout", { method: "POST" }); this.user = null; this.revision = null; }
  async load() { const result = await this.request("/data"); this.revision = result.revision; return result.data; }
  async save(data) { const result = await this.request("/data", { method: "PUT", body: { data, revision: this.revision } }); this.revision = result.revision; return result; }
}
