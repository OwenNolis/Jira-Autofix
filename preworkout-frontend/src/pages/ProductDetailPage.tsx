import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { mockProducts } from '../data/mockData';
import { getStockStatus } from '../types';
import './ProductDetailPage.css';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const product = mockProducts.find((p) => p.id === Number(id));

  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  if (!product) {
    return (
      <div className="detail-not-found">
        <h2>Product niet gevonden</h2>
        <button className="btn-secondary" onClick={() => navigate('/')}>Terug naar shop</button>
      </div>
    );
  }

  const stockStatus = getStockStatus(product.stock);
  const outOfStock = product.stock === 0;
  const maxQty = Math.min(product.stock, 10);

  function handleAdd() {
    if (!outOfStock) {
      addItem(product!, quantity, product!.flavor);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    }
  }

  return (
    <div className="detail-page">
      <div className="detail-container">
        <button className="detail-back" onClick={() => navigate(-1)}>← Terug</button>

        <div className="detail-grid">
          <div className="detail-img-wrap">
            <img src={product.imageUrl} alt={product.name} className="detail-img" />
          </div>

          <div className="detail-info">
            <p className="detail-category">{product.category}</p>
            <h1 className="detail-name">{product.name}</h1>
            <p className="detail-flavor">{product.flavor} smaak</p>

            <div className="detail-stats">
              <div className="stat-pill">
                <span className="stat-value">{product.caffeineMg}mg</span>
                <span className="stat-label">Cafeïne</span>
              </div>
              <div className="stat-pill">
                <span className="stat-value">{product.servings}</span>
                <span className="stat-label">Servings</span>
              </div>
              <div className="stat-pill">
                <span className={`stat-value stat-value--${stockStatus === 'Op voorraad' ? 'ok' : stockStatus === 'Beperkt' ? 'low' : 'out'}`}>
                  {stockStatus}
                </span>
                <span className="stat-label">Voorraad</span>
              </div>
            </div>

            <p className="detail-price">€{product.price.toFixed(2)}</p>

            <p className="detail-desc">{product.description}</p>

            {!outOfStock && (
              <div className="detail-qty-row">
                <label className="detail-qty-label">Aantal:</label>
                <div className="detail-qty-ctrl">
                  <button className="qty-btn" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
                  <span className="detail-qty-val">{quantity}</span>
                  <button className="qty-btn" onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} disabled={quantity >= maxQty}>+</button>
                </div>
              </div>
            )}

            <button
              className={`btn-primary btn-add ${added ? 'btn-add--added' : ''}`}
              onClick={handleAdd}
              disabled={outOfStock}
            >
              {outOfStock ? 'Uitverkocht' : added ? '✓ Toegevoegd!' : 'In winkelmand'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
