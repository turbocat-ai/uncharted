import { storage } from './storage';

// Base URL for backend routes
const BASE_URL = 'http://localhost:5000/api'; 
const TOKEN_KEY = 'auth_jwt_token';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await storage.getItem(TOKEN_KEY);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    // If token is invalid or expired, clear it so app context updates
    if (response.status === 401 || response.status === 403) {
      await storage.removeItem(TOKEN_KEY);
      await storage.removeItem('user_info');
    }
    throw new Error(data.error || 'Something went wrong');
  }

  return data as T;
}

export const api = {
  // Save JWT token and user details to local storage upon successful register
  register: async (payload: { username: string; email: string; password: string }) => {
    const res = await request<{ message: string; user: any; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.token) {
      await storage.setItem(TOKEN_KEY, res.token);
      await storage.setItem('user_info', JSON.stringify(res.user));
    }
    return res;
  },

  // Save JWT token and user details to local storage upon successful login
  login: async (payload: { email: string; password: string }) => {
    const res = await request<{ message: string; user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.token) {
      await storage.setItem(TOKEN_KEY, res.token);
      await storage.setItem('user_info', JSON.stringify(res.user));
    }
    return res;
  },

  // Manual logout helper
  logout: async () => {
    await storage.removeItem(TOKEN_KEY);
    await storage.removeItem('user_info');
  },

  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body: any) =>
    request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};