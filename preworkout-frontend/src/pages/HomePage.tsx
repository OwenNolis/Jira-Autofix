import React, { useMemo, useState } from 'react';
import FilterSidebar from '../components/FilterSidebar';
import ProductCard from '../components/ProductCard';
import { mockProducts } from '../data/mockData';
import { ProductFilters } from '../types';
import './HomePage.css';

const DEFAULT_FILTERS: ProductFilters = {
  search: '',
  flavor: '',
  minPrice: null,
  maxPrice: null,
  inStock: false,
  minCaffeine: null,
  maxCaffeine: null,
  sort: 'name_asc',
};

export default function HomePage() {
  const [filters, setFilters] = useState<ProductFilters>(DEFAULT_FILTERS);

  function handleFilterChange(partial: Partial<ProductFilters>) {
    setFilters((prev) => ({ ...prev, ...partial }));
  }

  const products = useMemo(() => {
    let result = mockProducts.filter((p) => p.isActive);

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      );
    }
    if (filters.flavor) result = result.filter((p) => p.flavor === filters.flavor);
    if (filters.minPrice != null) result = result.filter((p) => p.price >= filters.minPrice!);
    if (filters.maxPrice != null) result = result.filter((p) => p.price <= filters.maxPrice!);
    if (filters.inStock) result = result.filter((p) => p.stock > 0);
    if (filters.minCaffeine != null) result = result.filter((p) => p.caffeineMg >= filters.minCaffeine!);
    if (filters.maxCaffeine != null) result = result.filter((p) => p.caffeineMg <= filters.maxCaffeine!);

    switch (filters.sort) {
      case 'price_asc': result = [...result].sort((a, b) => a.price - b.price); break;
      case 'price_desc': result = [...result].sort((a, b) => b.price - a.price); break;
      case 'caffeine_desc': result = [...result].sort((a, b) => b.caffeineMg - a.caffeineMg); break;
      default: result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [filters]);

  return (
    <div>
      <section className="hero">
        <div className="hero-content">
          <p className="hero-tag">Premium Supplementen</p>
          <h1>FUEL YOUR <span>PERFORMANCE</span></h1>
          <p className="hero-sub">
            Krachtige pre-workout formules voor maximale energie, focus en pump.
          </p>
          <a href="#shop" className="btn-primary">Shop Nu</a>
        </div>
      </section>

      <section id="shop" className="shop-section">
        <FilterSidebar filters={filters} onChange={handleFilterChange} onReset={() => setFilters(DEFAULT_FILTERS)} />

        <div className="shop-main">
          <div className="shop-results-bar">
            <span>{products.length} product{products.length !== 1 ? 'en' : ''} gevonden</span>
          </div>

          {products.length === 0 ? (
            <div className="shop-empty">
              <p>Geen producten gevonden voor deze filters.</p>
              <button className="btn-secondary" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Filters wissen
              </button>
            </div>
          ) : (
            <div className="product-grid">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
