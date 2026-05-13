import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Product, getStockStatus } from '../types';
import { useCart } from '../contexts/CartContext';
import './ProductCard.css';

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const stockStatus = getStockStatus(product.stock);
  const outOfStock = product.stock === 0;

  function handleAddToCart(e: React.MouseEvent) {
    e.stopPropagation();
    if (!outOfStock) {
      addItem(product, 1, product.flavor);
    }
  }

  return (
    <div className="product-card" onClick={() => navigate(`/products/${product.id}`)}>
      <div className="product-card-img-wrap">
        <img src={product.imageUrl} alt={product.name} className="product-card-img" />
        <span className={`stock-badge stock-badge--${stockStatus === 'Op voorraad' ? 'ok' : stockStatus === 'Beperkt' ? 'low' : 'out'}`}>
          {stockStatus}
        </span>
      </div>
      <div className="product-card-body">
        <p className="product-card-category">{product.category}</p>
        <h3 className="product-card-name">{product.name}</h3>
        <p className="product-card-flavor">{product.flavor} · {product.caffeineMg}mg caffeine</p>
        <div className="product-card-footer">
          <span className="product-card-price">€{product.price.toFixed(2)}</span>
          <button
            className="btn-primary"
            onClick={handleAddToCart}
            disabled={outOfStock}
            title={outOfStock ? 'Niet op voorraad' : 'Toevoegen aan winkelmand'}
          >
            {outOfStock ? 'Uitverkocht' : 'In winkelmand'}
          </button>
        </div>
      </div>
    </div>
  );
}
