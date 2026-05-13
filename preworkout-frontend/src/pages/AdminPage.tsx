import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { mockProducts } from '../data/mockData';
import { getStockStatus, Product } from '../types';
import './AdminPage.css';

const DEMO_ORDERS = [
  { id: 1001, userId: 2, email: 'jan@example.be', totalPrice: 74.98, status: 'Delivered', createdAt: '2026-04-28T10:30:00Z' },
  { id: 1002, userId: 3, email: 'marie@example.be', totalPrice: 32.99, status: 'Shipped',   createdAt: '2026-05-02T14:15:00Z' },
  { id: 1003, userId: 4, email: 'tom@example.be',   totalPrice: 44.99, status: 'Pending',   createdAt: '2026-05-12T09:00:00Z' },
];

const ORDER_STATUSES = ['Pending', 'Paid', 'Shipped', 'Delivered', 'Cancelled'];

const STATUS_COLOR: Record<string, string> = {
  Pending:   'status--pending',
  Paid:      'status--paid',
  Shipped:   'status--shipped',
  Delivered: 'status--delivered',
  Cancelled: 'status--cancelled',
};

type Tab = 'products' | 'orders';

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('products');
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [orders, setOrders] = useState(DEMO_ORDERS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', flavor: '', caffeineMg: '', servings: '', stock: '', description: '' });
  const [formError, setFormError] = useState('');

  // AC-007-2: redirect non-admin users — BR-006
  if (!user || user.role !== 'Admin') {
    return (
      <div className="admin-forbidden">
        <h2>403 — Toegang geweigerd</h2>
        <p>Je hebt geen adminrechten om deze pagina te bekijken.</p>
        <button className="btn-secondary" onClick={() => navigate('/')}>Terug naar shop</button>
      </div>
    );
  }

  function handleToggleActive(id: number) {
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, isActive: !p.isActive } : p));
  }

  function handleOrderStatus(id: number, status: string) {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
  }

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!form.name || !form.price || !form.flavor) { setFormError('Naam, prijs en smaak zijn verplicht.'); return; }
    const newProduct: Product = {
      id: products.length + 100,
      name: form.name,
      price: parseFloat(form.price),
      flavor: form.flavor,
      caffeineMg: parseInt(form.caffeineMg) || 0,
      servings: parseInt(form.servings) || 30,
      stock: parseInt(form.stock) || 0,
      description: form.description,
      imageUrl: `https://placehold.co/400x400/00BFA5/FFFFFF?text=${encodeURIComponent(form.name)}`,
      isActive: true,
      category: 'Pre-Workout',
    };
    setProducts((prev) => [...prev, newProduct]);
    setForm({ name: '', price: '', flavor: '', caffeineMg: '', servings: '', stock: '', description: '' });
    setShowForm(false);
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="admin-header">
          <h1>Admin Dashboard</h1>
          <span className="admin-badge">Admin</span>
        </div>

        <div className="admin-tabs">
          <button className={`admin-tab ${tab === 'products' ? 'admin-tab--active' : ''}`} onClick={() => setTab('products')}>
            Producten ({products.length})
          </button>
          <button className={`admin-tab ${tab === 'orders' ? 'admin-tab--active' : ''}`} onClick={() => setTab('orders')}>
            Bestellingen ({orders.length})
          </button>
        </div>

        {tab === 'products' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2>Productbeheer</h2>
              <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
                {showForm ? 'Annuleren' : '+ Nieuw product'}
              </button>
            </div>

            {showForm && (
              <form className="admin-product-form" onSubmit={handleAddProduct}>
                <h3>Nieuw product toevoegen</h3>
                <div className="form-row">
                  <div className="form-group"><label>Naam *</label><input name="name" className="form-input" value={form.name} onChange={handleFormChange} /></div>
                  <div className="form-group"><label>Prijs (€) *</label><input name="price" type="number" step="0.01" className="form-input" value={form.price} onChange={handleFormChange} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Smaak *</label><input name="flavor" className="form-input" value={form.flavor} onChange={handleFormChange} /></div>
                  <div className="form-group"><label>Cafeïne (mg)</label><input name="caffeineMg" type="number" className="form-input" value={form.caffeineMg} onChange={handleFormChange} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Servings</label><input name="servings" type="number" className="form-input" value={form.servings} onChange={handleFormChange} /></div>
                  <div className="form-group"><label>Voorraad</label><input name="stock" type="number" className="form-input" value={form.stock} onChange={handleFormChange} /></div>
                </div>
                <div className="form-group">
                  <label>Beschrijving</label>
                  <textarea name="description" className="form-input admin-textarea" value={form.description} onChange={handleFormChange} />
                </div>
                {formError && <p className="checkout-error">{formError}</p>}
                <button type="submit" className="btn-primary">Product toevoegen</button>
              </form>
            )}

            <table className="admin-table">
              <thead>
                <tr><th>Naam</th><th>Smaak</th><th>Prijs</th><th>Voorraad</th><th>Status</th><th>Actie</th></tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className={!p.isActive ? 'admin-row--inactive' : ''}>
                    <td className="admin-td-name">{p.name}</td>
                    <td>{p.flavor}</td>
                    <td>€{p.price.toFixed(2)}</td>
                    <td>
                      <span className={`stock-badge stock-badge--${getStockStatus(p.stock) === 'Op voorraad' ? 'ok' : getStockStatus(p.stock) === 'Beperkt' ? 'low' : 'out'}`}>
                        {p.stock} — {getStockStatus(p.stock)}
                      </span>
                    </td>
                    <td><span className={`order-status ${p.isActive ? 'status--paid' : 'status--cancelled'}`}>{p.isActive ? 'Actief' : 'Inactief'}</span></td>
                    <td>
                      <button className="admin-action-btn" onClick={() => handleToggleActive(p.id)}>
                        {p.isActive ? 'Deactiveren' : 'Activeren'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'orders' && (
          <div className="admin-section">
            <div className="admin-section-header"><h2>Bestellingenbeheer</h2></div>
            <table className="admin-table">
              <thead>
                <tr><th>#</th><th>Klant</th><th>Totaal</th><th>Datum</th><th>Status</th><th>Wijzig status</th></tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>#{o.id}</td>
                    <td>{o.email}</td>
                    <td>€{o.totalPrice.toFixed(2)}</td>
                    <td>{new Date(o.createdAt).toLocaleDateString('nl-BE')}</td>
                    <td><span className={`order-status ${STATUS_COLOR[o.status]}`}>{o.status}</span></td>
                    <td>
                      <select
                        className="admin-status-select"
                        value={o.status}
                        onChange={(e) => handleOrderStatus(o.id, e.target.value)}
                      >
                        {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
