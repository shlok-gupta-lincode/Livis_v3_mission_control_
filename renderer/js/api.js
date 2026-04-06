/* ══════════════════════════════════════════════════════════════════════
   api.js — Thin fetch wrapper for all backend calls
   Base URL defaults to http://localhost:9000 (daemon API)
   ══════════════════════════════════════════════════════════════════════ */

const API_BASE = 'http://localhost:9000';

const Api = {
  /** GET JSON */
  async get(path) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) {
      const err = new Error(`GET ${path} failed`);
      err.status = res.status;
      try { err.data = await res.json(); } catch { err.data = {}; }
      throw err;
    }
    return res.json();
  },

  /** POST JSON */
  async post(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = new Error(`POST ${path} failed`);
      err.status = res.status;
      try { err.data = await res.json(); } catch { err.data = {}; }
      throw err;
    }
    return res.json();
  },

  /** POST FormData (file upload) */
  async postForm(path, formData) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = new Error(`POST ${path} failed`);
      err.status = res.status;
      try { err.data = await res.json(); } catch { err.data = {}; }
      throw err;
    }
    return res.json();
  },

  /** DELETE */
  async delete(path) {
    const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = new Error(`DELETE ${path} failed`);
      err.status = res.status;
      try { err.data = await res.json(); } catch { err.data = {}; }
      throw err;
    }
    try { return await res.json(); } catch { return {}; }
  },

  /** Extract error detail string from caught error */
  errorDetail(err) {
    if (!err) return 'Unknown error';
    const d = err.data?.detail;
    if (typeof d === 'string') return d;
    if (d && typeof d === 'object') return d.message || d.detail || JSON.stringify(d);
    return err.message || 'Unknown error';
  },
};

// Make available globally
window.Api = Api;
