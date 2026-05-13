export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  flavor: string;
  caffeineMg: number;
  servings: number;
  stock: number;
  imageUrl: string;
  isActive: boolean;
  category: string;
}

export interface CartItem {
  id: number;
  productId: number;
  product: Product;
  quantity: number;
  flavor: string;
}

export interface Order {
  id: number;
  totalPrice: number;
  status: 'Pending' | 'Paid' | 'Shipped' | 'Delivered' | 'Cancelled';
  createdAt: string;
  lines: OrderLine[];
}

export interface OrderLine {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  flavor: string;
}

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: 'Customer' | 'Admin';
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ProductFilters {
  search: string;
  flavor: string;
  minPrice: number | null;
  maxPrice: number | null;
  inStock: boolean;
  minCaffeine: number | null;
  maxCaffeine: number | null;
  sort: 'price_asc' | 'price_desc' | 'name_asc' | 'caffeine_desc';
}

export type StockStatus = 'Op voorraad' | 'Beperkt' | 'Niet op voorraad';

export function getStockStatus(stock: number): StockStatus {
  if (stock === 0) return 'Niet op voorraad';
  if (stock <= 5) return 'Beperkt';
  return 'Op voorraad';
}
