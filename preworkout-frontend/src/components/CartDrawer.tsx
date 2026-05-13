import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import './CartDrawer.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CartDrawer({ open, onClose }: Props) {
  const { items, totalPrice, updateItem, removeItem } = useCart();
  const navigate = useNavigate();

  function handleCheckout() {
    onClose();
    navigate('/checkout');
  }

  return (
    <>
      <div className={`cart-overlay ${open ? 'cart-overlay--visible' : ''}`} onClick={onClose} />
      <aside className={`cart-drawer ${open ? 'cart-drawer--open' : ''}`}>
        <div className="cart-drawer-header">
          <h2>Winkelmand</h2>
          <button className="cart-drawer-close" onClick={onClose}>✕</button>
        </div>

        {items.length === 0 ? (
          <p className="cart-empty">Je winkelmand is leeg.</p>
        ) : (
          <>
            <ul className="cart-item-list">
              {items.map((item) => (
                <li key={item.id} className="cart-item">
                  <img src={item.product.imageUrl} alt={item.product.name} className="cart-item-img" />
                  <div className="cart-item-info">
                    <p className="cart-item-name">{item.product.name}</p>
                    <p className="cart-item-meta">{item.flavor}</p>
                    <div className="cart-item-qty">
                      <button
                        className="qty-btn"
                        onClick={() => updateItem(item.productId, item.quantity - 1)}
                      >−</button>
                      <span>{item.quantity}</span>
                      <button
                        className="qty-btn"
                        onClick={() => updateItem(item.productId, Math.min(item.quantity + 1, item.product.stock))}
                        disabled={item.quantity >= item.product.stock}
                      >+</button>
                    </div>
                  </div>
                  <div className="cart-item-right">
                    <span className="cart-item-price">€{(item.quantity * item.product.price).toFixed(2)}</span>
                    <button className="cart-item-remove" onClick={() => removeItem(item.productId)}>🗑</button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="cart-drawer-footer">
              <div className="cart-total-row">
                <span>Totaal</span>
                <strong>€{totalPrice.toFixed(2)}</strong>
              </div>
              <button className="btn-primary btn-full" onClick={handleCheckout}>
                Afrekenen
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
