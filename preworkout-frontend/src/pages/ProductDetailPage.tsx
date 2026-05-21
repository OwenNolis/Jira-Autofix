import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import '../components/ProductCard.css';
import './ProductDetailPage.css';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  flavor: string;
  caffeineMg: number;
  servings: number;
  imageUrl: string;
  stockStatus?: string;
  quantity?: number;
}

type ApiProduct = Product;

function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProduct() {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch(`/api/products/${id}`);
        if (!resp.ok) throw new Error('Product not found');
        const data = await resp.json();
        setProduct(data);
      } catch (e: any) {
        setError(e.message || 'Failed to fetch product');
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
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
            <div><strong>Stock:</strong> <span className={`product-detail-stock product-detail-stock-${(product.stockStatus||'').toLowerCase().replace(/\s/g, '-')}`}>{product.stockStatus}</span></div>
          </div>
          <div className="product-detail-price">€{product.price.toFixed(2)}</div>
          <button className="product-detail-add-btn" disabled={product.quantity === 0}>Add to Cart</button>
        </div>
      </div>
    </div>
  );
}

export default ProductDetailPage;
