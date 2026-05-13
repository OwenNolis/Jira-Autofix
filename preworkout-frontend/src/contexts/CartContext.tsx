import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CartItem, Product } from '../types';

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  addItem: (product: Product, quantity: number, flavor: string) => void;
  updateItem: (productId: number, quantity: number) => void;
  removeItem: (productId: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    const stored = localStorage.getItem('cart');
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((product: Product, quantity: number, flavor: string) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id && i.flavor === flavor);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id && i.flavor === flavor
            ? { ...i, quantity: Math.min(i.quantity + quantity, product.stock) }
            : i
        );
      }
      const newItem: CartItem = {
        id: Date.now(),
        productId: product.id,
        product,
        quantity,
        flavor,
      };
      return [...prev, newItem];
    });
  }, []);

  const updateItem = useCallback((productId: number, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.productId !== productId)
        : prev.map((i) => (i.productId === productId ? { ...i, quantity } : i))
    );
  }, []);

  const removeItem = useCallback((productId: number) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.quantity * i.product.price, 0);

  return (
    <CartContext.Provider value={{ items, totalItems, totalPrice, addItem, updateItem, removeItem, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
