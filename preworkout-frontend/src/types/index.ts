export interface Product {
  id: number;
  categoryId?: number;
  name: string;
  description: string;
  price: number;
  flavor: string;
  caffeineMg: number;
  servings: number;
  imageUrl: string;
  isActive: boolean;
  stock: number;
  category: string;
  stockStatus?: string;
  quantity?: number;
  availableSizes?: string[];
}

export interface CartItem {
  id: number;
  userId?: number;
  productId: number;
  product: Product;
  quantity: number;
  flavor: string;
}

export interface OrderLine {
  id: number;
  orderId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  flavor: string;
}

export interface Order {
  id: number;
  userId: number;
  addressId: number;
  totalPrice: number;
  status: string;
  createdAt: string;
  lines?: OrderLine[];
}

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ProductFilters {
  search: string;
  flavor: string;
  minPrice: number | null;
  maxPrice: number | null;
  inStock: boolean;
  minCaffeine: number | null;
  maxCaffeine: number | null;
  sort: string;
}

export function getStockStatus(stock: number): string {
  if (stock === 0) return 'Uitverkocht';
  if (stock <= 5) return 'Beperkt';
  return 'Op voorraad';
}
