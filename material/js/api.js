// 简易API封装
// API_BASE: 本地开发留空走相对路径；部署到GitHub Pages时改为后端域名
const API_BASE = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? '' : 'https://api.xwq-design.com';

const api = {
  async request(url, method = 'GET', data = {}) {
    const token = localStorage.getItem('token');
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    if (method !== 'GET' && data) opts.body = JSON.stringify(data);
    const res = await fetch(API_BASE + url, opts);
    if (res.status === 401) { localStorage.clear(); location.href = 'login.html'; throw new Error('未登录'); }
    const json = await res.json();
    if (json.code === 0) return json.data;
    else { alert(json.message || '请求失败'); throw new Error(json.message); }
  },
  get: (url) => api.request(url, 'GET'),
  post: (url, data) => api.request(url, 'POST', data),
  put: (url, data) => api.request(url, 'PUT', data),
  del: (url) => api.request(url, 'DELETE'),
  async upload(url, file, extra = {}) {
    const token = localStorage.getItem('token');
    const fd = new FormData();
    fd.append('file', file);
    Object.entries(extra).forEach(([k, v]) => fd.append(k, v));
    const res = await fetch(API_BASE + url, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd });
    const json = await res.json();
    if (json.code === 0) return json.data;
    else { alert(json.message); throw new Error(json.message); }
  }
};
