// src/services/api.js
// Production-ready API service for VOO Ward Admin Dashboard

const CONFIG = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://your-backend.onrender.com/api',
  MAX_RETRY_ATTEMPTS: 3,
  REQUEST_TIMEOUT: 30000, // 30 seconds
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
};

class APIService {
  constructor() {
    this.token = localStorage.getItem('auth_token');
    this.cache = new Map();
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  async request(endpoint, options = {}, retries = CONFIG.MAX_RETRY_ATTEMPTS) {
    const url = `${CONFIG.API_BASE_URL}${endpoint}`;
    const cacheKey = `${options.method || 'GET'}-${url}`;
    if ((!options.method || options.method === 'GET') && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < CONFIG.CACHE_DURATION) {
        return cached.data;
      }
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
          ...options.headers,
        },
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken();
          window.location.reload();
          throw new Error('Session expired. Please login again.');
        }
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }
      const data = await response.json();
      if (!options.method || options.method === 'GET') {
        this.cache.set(cacheKey, { data, timestamp: Date.now() });
      }
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout. Please check your connection.');
      }
      if (retries > 0 && !error.message.includes('401')) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (CONFIG.MAX_RETRY_ATTEMPTS - retries + 1)));
        return this.request(endpoint, options, retries - 1);
      }
      throw error;
    }
  }

  // Auth
  async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    await this.request('/auth/logout', { method: 'POST' });
    this.clearToken();
  }

  // Dashboard Stats
  async getDashboardStats() {
    return this.request('/analytics/dashboard');
  }

  // Issues
  async getIssues(filters = {}) {
    const query = new URLSearchParams(filters).toString();
    return this.request(`/issues${query ? `?${query}` : ''}`);
  }

  async getIssue(id) {
    return this.request(`/issues/${id}`);
  }

  async updateIssueStatus(id, status, notes) {
    return this.request(`/issues/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, notes }),
    });
  }

  async exportIssues(filters = {}) {
    const query = new URLSearchParams(filters).toString();
    const response = await fetch(`${CONFIG.API_BASE_URL}/issues/export?${query}`, {
      headers: { 'Authorization': `Bearer ${this.token}` },
    });
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `issues-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  // Bursary
  async getBursaryApplications(filters = {}) {
    const query = new URLSearchParams(filters).toString();
    return this.request(`/bursary${query ? `?${query}` : ''}`);
  }

  async reviewBursaryApplication(id, status, notes, amount) {
    return this.request(`/bursary/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, notes, amount }),
    });
  }

  async exportBursary(filters = {}) {
    const query = new URLSearchParams(filters).toString();
    const response = await fetch(`${CONFIG.API_BASE_URL}/bursary/export?${query}`, {
      headers: { 'Authorization': `Bearer ${this.token}` },
    });
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bursary-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  // Announcements
  async getAnnouncements(filters = {}) {
    const query = new URLSearchParams(filters).toString();
    return this.request(`/announcements${query ? `?${query}` : ''}`);
  }

  async createAnnouncement(data) {
    return this.request('/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAnnouncement(id, data) {
    return this.request(`/announcements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAnnouncement(id) {
    return this.request(`/announcements/${id}`, { method: 'DELETE' });
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }
}

const apiService = new APIService();
export default apiService;
