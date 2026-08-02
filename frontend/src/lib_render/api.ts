import { storage } from './storage';

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
    throw new Error(data.error || 'Something went wrong');
  }

  return data as T;
}

export const api = {
  register: (payload: { username: string; email: string; password: string }) => {
    return request<{ message: string; user: any; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  login: (payload: { email: string; password: string }) => {
    return request<{ message: string; user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body: any) =>
    request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};