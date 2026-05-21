import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import '../pages/ProductDetailPage.css';
import { useCart } from '../contexts/CartContext';
import { Product } from '../types';

interface ProductDetail extends Product {
  stockStatus: string;
  quantity: number;
}

const PLACEHOLDER_IMG = 'https://via.placeholder.com/320x220?text=No+Image';

function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addQty, setAddQty] = useState(1);
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(`/api/products/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Product not found');
        return res.json();
      })
      .then((data) => setProduct(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddToCart = () => {
    if (!product) return;
    addToCart(product, addQty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  if (loading) return <div className="product-detail-page">Loading...</div>;
  if (error) return <div className="product-detail-page">{error}</div>;
  if (!product) return <div className="product-detail-page">Product not found.</div>;

  return (
    <div className="product-detail-page">
      <div className="product-detail-card">
        <div className="product-detail-img-wrapper">
          <img
            src={product.imageUrl || PLACEHOLDER_IMG}
            alt={product.name}
            className="product-detail-img"
            style={{ maxWidth: 320, maxHeight: 220, borderRadius: 10, background: '#f8fafc' }}
          />
        </div>
        <div className="product-detail-info">
          <h1 className="product-detail-title">{product.name}</h1>
          <div className="product-detail-desc">{product.description}</div>
          <div className="product-detail-meta">
            <div><strong>Flavor:</strong> {product.flavor}</div>
            <div><strong>Caffeine:</strong> {product.caffeineMg}mg</div>
            <div><strong>Servings:</strong> {product.servings}</div>
            <div><strong>Stock:</strong> <span className={`stock-badge stock-badge-${product.stockStatus === 'Op voorraad' ? 'in' : product.stockStatus === 'Beperkt' ? 'low' : 'out'}`}>{product.stockStatus}</span></div>
          </div>
          <div className="product-detail-price">€{product.price.toFixed(2)}</div>
          <div className="product-detail-actions">
            <label htmlFor="qty" style={{ marginRight: 8 }}>Qty:</label>
            <input
              id="qty"
              type="number"
              min={1}
              max={product.quantity}
              value={addQty}
              onChange={e => setAddQty(Math.max(1, Math.min(product.quantity, Number(e.target.value))))}
              style={{ width: 60, marginRight: 14, padding: 6, borderRadius: 6, border: '1px solid #ccc' }}
              disabled={product.quantity === 0}
            />
            <button
              className="add-to-cart-btn"
              onClick={handleAddToCart}
              disabled={product.quantity === 0}
              style={{
                background: product.quantity === 0 ? '#bdbdbd' : 'var(--color-button-bg)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '10px 28px',
                fontWeight: 600,
                fontSize: '1.08rem',
                cursor: product.quantity === 0 ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {product.quantity === 0 ? 'Out of Stock' : added ? 'Added!' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductDetailPage;
