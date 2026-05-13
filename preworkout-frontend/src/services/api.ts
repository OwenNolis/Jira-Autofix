import { AuthResponse, CartItem, Order, Product, ProductFilters } from '../types';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function buildProductQuery(filters: Partial<ProductFilters>): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.flavor) params.set('flavor', filters.flavor);
  if (filters.minPrice != null) params.set('minPrice', String(filters.minPrice));
  if (filters.maxPrice != null) params.set('maxPrice', String(filters.maxPrice));
  if (filters.inStock) params.set('inStock', 'true');
  if (filters.minCaffeine != null) params.set('minCaffeine', String(filters.minCaffeine));
  if (filters.maxCaffeine != null) params.set('maxCaffeine', String(filters.maxCaffeine));
  if (filters.sort) params.set('sort', filters.sort);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const productsApi = {
  list: (filters?: Partial<ProductFilters>) =>
    request<Product[]>(`/api/products${buildProductQuery(filters || {})}`),
  get: (id: number) => request<Product>(`/api/products/${id}`),
};

export const authApi = {
  register: (data: { firstName: string; lastName: string; email: string; password: string }) =>
    request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
};

export const cartApi = {
  get: () => request<CartItem[]>('/api/cart'),
  addItem: (data: { productId: number; quantity: number; flavor: string }) =>
    request<CartItem>('/api/cart/items', { method: 'POST', body: JSON.stringify(data) }),
  updateItem: (id: number, data: { quantity: number }) =>
    request<CartItem>(`/api/cart/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeItem: (id: number) => request<void>(`/api/cart/items/${id}`, { method: 'DELETE' }),
};

export const ordersApi = {
  create: (data: { addressId?: number; paymentMethod: string }) =>
    request<Order>('/api/orders', { method: 'POST', body: JSON.stringify(data) }),
  mine: () => request<Order[]>('/api/orders/me'),
};
