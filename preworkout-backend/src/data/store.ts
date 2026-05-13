import bcrypt from 'bcryptjs';
import {
  Address, CartItem, Category, Inventory, Order,
  OrderLine, Payment, Product, ReturnRequest, User,
} from '../types';

// In-memory store — replace with a real DB in production

export const categories: Category[] = [
  { id: 1, name: 'Pre-Workout' },
  { id: 2, name: 'Pump Formula' },
  { id: 3, name: 'Hydration' },
];

export const products: Product[] = [
  { id: 1, categoryId: 1, name: 'Nitro Peach', description: 'Intense pre-workout with 250mg caffeine.', price: 34.99, flavor: 'Peach', caffeineMg: 250, servings: 30, imageUrl: '', isActive: true },
  { id: 2, categoryId: 1, name: 'Mango Rush',  description: 'Creatine blend pre-workout with 300mg caffeine.', price: 39.99, flavor: 'Mango', caffeineMg: 300, servings: 25, imageUrl: '', isActive: true },
  { id: 3, categoryId: 2, name: 'Blue Ice',    description: 'Stimulant-free pump formula.', price: 32.99, flavor: 'Blueberry', caffeineMg: 80, servings: 30, imageUrl: '', isActive: true },
  { id: 4, categoryId: 1, name: 'Cherry Bomb', description: 'Nootropic pre-workout with 350mg caffeine.', price: 44.99, flavor: 'Cherry', caffeineMg: 350, servings: 20, imageUrl: '', isActive: true },
];

export const inventory: Inventory[] = [
  { id: 1, productId: 1, quantity: 42 },
  { id: 2, productId: 2, quantity: 18 },
  { id: 3, productId: 3, quantity: 5 },
  { id: 4, productId: 4, quantity: 0 },
];

export const users: User[] = [
  {
    id: 1,
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@pulsepre.be',
    passwordHash: bcrypt.hashSync('admin123', 10),
    role: 'Admin',
    createdAt: new Date().toISOString(),
  },
];

export const addresses: Address[] = [];
export const cartItems: CartItem[] = [];
export const orders: Order[] = [];
export const orderLines: OrderLine[] = [];
export const payments: Payment[] = [];
export const returnRequests: ReturnRequest[] = [];

let nextUserId = 2;
let nextCartId = 1;
let nextOrderId = 1;
let nextLineId  = 1;
let nextPayId   = 1;
let nextReturnId = 1;
let nextAddressId = 1;

export const ids = {
  nextUser:    () => nextUserId++,
  nextCart:    () => nextCartId++,
  nextOrder:   () => nextOrderId++,
  nextLine:    () => nextLineId++,
  nextPay:     () => nextPayId++,
  nextReturn:  () => nextReturnId++,
  nextAddress: () => nextAddressId++,
};
