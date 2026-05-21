export interface Product {
  id: number;
  categoryId: number;
  name: string;
  description: string;
  price: number;
  flavor: string;
  caffeineMg: number;
  servings: number;
  imageUrl: string;
  isActive: boolean;
  stockStatus?: string;
  quantity?: number;
  availableSizes?: string[];
}

export interface CartItem {
  id: number;
  userId?: number;
  productId: number;
  product?: Product;
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
