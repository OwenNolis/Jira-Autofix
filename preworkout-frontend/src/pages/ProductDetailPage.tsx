import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import '../components/ProductCard.css';
import './ProductDetailPage.css';

interface Product {
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
}

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8080/api';

function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProduct() {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch(`${API_BASE}/products/${id}`);
        if (!resp.ok) throw new Error('Product not found');
        const data = await resp.json();
        setProduct(data);
      } catch (e: any) {
        setError(e.message || 'Failed to load product');
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchProduct();
  }, [id]);

  if (loading) {
    return <div className="product-detail-page"><div className="product-detail-loading">Loading...</div></div>;
  }
  if (error) {
    return <div className="product-detail-page"><div className="product-detail-error">{error}</div></div>;
  }
  if (!product) {
    return <div className="product-detail-page"><div className="product-detail-error">Product not found.</div></div>;
  }

  return (
    <div className="product-detail-page">
      <div className="product-detail-card">
        <div className="product-detail-image-wrapper">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="product-detail-image" />
          ) : (
            <div className="product-detail-image-placeholder">No Image</div>
          )}
        </div>
        <div className="product-detail-info">
          <h1 className="product-detail-title">{product.name}</h1>
          <div className="product-detail-desc">{product.description}</div>
          <div className="product-detail-meta">
            <div><strong>Flavor:</strong> {product.flavor}</div>
            <div><strong>Caffeine:</strong> {product.caffeineMg} mg</div>
            <div><strong>Servings:</strong> {product.servings}</div>
            <div><strong>Price:</strong> €{product.price.toFixed(2)}</div>
            <div><strong>Stock:</strong> <span className={`product-detail-stock product-detail-stock-${(product.stockStatus||'').toLowerCase().replace(/\s/g,'-')}`}>{product.stockStatus}</span> {typeof product.quantity === 'number' && <span>({product.quantity} left)</span>}</div>
          </div>
          <button className="product-detail-addcart-btn" disabled={product.quantity === 0}>Add to Cart</button>
        </div>
      </div>
    </div>
  );
}

export default ProductDetailPage;
