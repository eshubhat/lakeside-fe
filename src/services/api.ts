import axios, { type InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export let memoryToken: string | null = null;
export const setMemoryToken = (token: string | null) => {
  memoryToken = token;
};

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Securely attaches the HttpOnly `/auth/refresh` cookies sequentially across CORS natively
});

// ─── Request Interceptor ──────────────────────────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (memoryToken && config.headers) {
    config.headers.Authorization = `Bearer ${memoryToken}`;
  }
  return config;
}, (error: any) => Promise.reject(error));

// ─── Response Interceptor ─────────────────────────────────────────────────────
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: any) => {
    const originalRequest = error.config;

    const isAuthRequest = originalRequest.url?.startsWith('/auth/login') || 
                          originalRequest.url?.startsWith('/auth/google') || 
                          originalRequest.url?.startsWith('/auth/signup') || 
                          originalRequest.url?.startsWith('/auth/refresh');

    // Trigger intercept loops on 401s excluding initialization attempts inherently mapping bounds gracefully
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRequest) {
      
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
        setMemoryToken(data.token);
        
        processQueue(null, data.token);
        
        // Replay identically natively safely
        originalRequest.headers.Authorization = `Bearer ${data.token}`;
        return api(originalRequest);
        
      } catch (err) {
        processQueue(err, null);
        
        // Wipe isolated properties identically enforcing secure session boundaries uniformly
        setMemoryToken(null);
        localStorage.removeItem('user');

        const toast = document.createElement('div');
        toast.textContent = '⚠️ Secure Session expired — verification re-authentication required.';
        toast.style.cssText = [
          'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
          'background:#1a1a2e', 'color:#fff', 'font-family:inherit',
          'padding:12px 24px', 'border-radius:12px', 'font-size:14px',
          'font-weight:600', 'box-shadow:0 8px 32px rgba(0,0,0,0.3)',
          'z-index:99999', 'opacity:0', 'transition:opacity 0.3s ease',
        ].join(';');
        document.body.appendChild(toast);

        requestAnimationFrame(() => { toast.style.opacity = '1'; });
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);

        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
