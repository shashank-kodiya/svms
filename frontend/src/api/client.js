import axios from 'axios';

const TOKEN_KEY = 'svms_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY)
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 15000
});

// Attach the JWT to every request.
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Turn any API failure into a readable message.
export function errorMessage(err) {
  if (err.response?.data?.message) return err.response.data.message;
  if (err.code === 'ECONNABORTED') return 'The server took too long to respond.';
  if (!err.response) return 'Cannot reach the server. Is the backend running on port 5000?';
  return 'Something went wrong. Please try again.';
}

export default api;

// Downloads a file that needs the login token (for example an invoice PDF) and saves it.
export async function downloadFile(url, filename) {
  const { data } = await api.get(url, { responseType: 'blob' });
  const href = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
