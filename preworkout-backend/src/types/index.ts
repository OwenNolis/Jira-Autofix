export type UserRole = 'Customer' | 'Admin';
export type OrderStatus = 'Pending' | 'Paid' | 'Shipped' | 'Delivered' | 'Cancelled';
export type PaymentStatus = 'Pending' | 'Completed' | 'Failed';
export type ReturnStatus = 'Requested' | 'Approved' | 'Rejected';

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;           // unique
  passwordHash: string;    // bcrypt hash — NFR-003
  role: UserRole;
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  categoryId: number;
  name: string;
  description: string;
  price: number;           // price > 0
  flavor: string;
  caffeineMg: number;
  servings: number;
  imageUrl: string;
  isActive: boolean;
}

export interface Inventory {
  id: number;
  productId: number;       // unique per productId (pre-workout has one size)
  quantity: number;        // quantity >= 0
}

export interface CartItem {
  id: number;
  userId: number;
  productId: number;
  quantity: number;        // quantity > 0; must not exceed inventory
  flavor: string;
}

export interface Order {
  id: number;
  userId: number;
  addressId: number;
  totalPrice: number;
  status: OrderStatus;     // starts as Pending — BR-003
  createdAt: string;
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

export interface Payment {
  id: number;
  orderId: number;         // orderId unique
  provider: string;
  status: PaymentStatus;
  transactionRef: string;  // unique
}

export interface ReturnRequest {
  id: number;
  orderId: number;
  orderLineId: number;
  reason: string;
  status: ReturnStatus;
  requestedAt: string;
}

export interface Address {
  id: number;
  userId: number;
  street: string;
  houseNumber: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface AuthPayload {
  userId: number;
  role: UserRole;
}
