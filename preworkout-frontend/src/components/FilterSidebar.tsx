import React from 'react';
import { flavors } from '../data/mockData';
import { ProductFilters } from '../types';
import './FilterSidebar.css';

interface Props {
  filters: ProductFilters;
  onChange: (f: Partial<ProductFilters>) => void;
  onReset: () => void;
}

export default function FilterSidebar({ filters, onChange, onReset }: Props) {
  return (
    <aside className="filter-sidebar">
      <div className="filter-sidebar-header">
        <h2>Filters</h2>
        <button className="filter-reset-btn" onClick={onReset}>Reset</button>
      </div>

      <div className="filter-group">
        <label className="filter-label">Zoeken</label>
        <input
          type="text"
          className="filter-input"
          placeholder="Productnaam..."
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
        />
      </div>

      <div className="filter-group">
        <label className="filter-label">Smaak</label>
        <select
          className="filter-select"
          value={filters.flavor}
          onChange={(e) => onChange({ flavor: e.target.value })}
        >
          <option value="">Alle smaken</option>
          {flavors.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">Prijs (€)</label>
        <div className="filter-range-row">
          <input
            type="number"
            className="filter-input filter-input--sm"
            placeholder="Min"
            value={filters.minPrice ?? ''}
            min={0}
            onChange={(e) => onChange({ minPrice: e.target.value ? Number(e.target.value) : null })}
          />
          <span className="filter-range-sep">—</span>
          <input
            type="number"
            className="filter-input filter-input--sm"
            placeholder="Max"
            value={filters.maxPrice ?? ''}
            min={0}
            onChange={(e) => onChange({ maxPrice: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      </div>

      <div className="filter-group">
        <label className="filter-label">Cafeïne (mg)</label>
        <div className="filter-range-row">
          <input
            type="number"
            className="filter-input filter-input--sm"
            placeholder="Min"
            value={filters.minCaffeine ?? ''}
            min={0}
            onChange={(e) => onChange({ minCaffeine: e.target.value ? Number(e.target.value) : null })}
          />
          <span className="filter-range-sep">—</span>
          <input
            type="number"
            className="filter-input filter-input--sm"
            placeholder="Max"
            value={filters.maxCaffeine ?? ''}
            min={0}
            onChange={(e) => onChange({ maxCaffeine: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      </div>

      <div className="filter-group">
        <label className="filter-checkbox-label">
          <input
            type="checkbox"
            checked={filters.inStock}
            onChange={(e) => onChange({ inStock: e.target.checked })}
          />
          Alleen op voorraad
        </label>
      </div>

      <div className="filter-group">
        <label className="filter-label">Sorteren</label>
        <select
          className="filter-select"
          value={filters.sort}
          onChange={(e) => onChange({ sort: e.target.value as ProductFilters['sort'] })}
        >
          <option value="name_asc">Naam A–Z</option>
          <option value="price_asc">Prijs laag–hoog</option>
          <option value="price_desc">Prijs hoog–laag</option>
          <option value="caffeine_desc">Meeste cafeïne</option>
        </select>
      </div>
    </aside>
  );
}
