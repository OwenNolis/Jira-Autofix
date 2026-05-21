import { createContext, useContext, useState, ReactNode } from 'react';
import { CartItem, Product } from '../types';

export interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity: number, flavor?: string) => void;
  removeItem: (productId: number) => void;
  updateItem: (productId: number, quantity: number) => void;
  clearCart: () => void;
  totalPrice: number;
  totalItems: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (product: Product, quantity: number, flavor?: string) => {
    const itemFlavor = flavor ?? product.flavor;
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.productId === product.id && i.flavor === itemFlavor
      );
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id && i.flavor === itemFlavor
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [
        ...prev,
        { id: Date.now(), productId: product.id, product, quantity, flavor: itemFlavor },
      ];
    });
  };

  const removeItem = (productId: number) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const updateItem = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => setItems([]);

  const totalPrice = items.reduce(
    (sum, i) => (i.product ? sum + i.product.price * i.quantity : sum),
    0
  );

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateItem, clearCart, totalPrice, totalItems }}
    >
      {children}
    </CartContext.Provider>
  );
};
