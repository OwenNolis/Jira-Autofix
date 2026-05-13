import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import './CheckoutPage.css';

interface ShippingForm {
  firstName: string;
  lastName: string;
  email: string;
  street: string;
  houseNumber: string;
  city: string;
  postalCode: string;
  country: string;
}

const EMPTY_FORM: ShippingForm = {
  firstName: '',
  lastName: '',
  email: '',
  street: '',
  houseNumber: '',
  city: '',
  postalCode: '',
  country: 'België',
};

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<ShippingForm>({
    ...EMPTY_FORM,
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
  });
  const [paymentMethod, setPaymentMethod] = useState('bancontact');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (items.length === 0 && !submitted) {
    return (
      <div className="checkout-empty">
        <h2>Je winkelmand is leeg</h2>
        <p>Voeg producten toe voordat je afrekent.</p>
        <button className="btn-primary" onClick={() => navigate('/')}>Terug naar shop</button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="checkout-success">
        <div className="success-icon">✓</div>
        <h2>Bestelling geplaatst!</h2>
        <p>Je ontvangt een bevestiging per e-mail. Bedankt voor je bestelling!</p>
        <button className="btn-primary" onClick={() => navigate('/orders')}>Mijn bestellingen</button>
      </div>
    );
  }

  function validate() {
    const required: (keyof ShippingForm)[] = ['firstName', 'lastName', 'email', 'street', 'houseNumber', 'city', 'postalCode'];
    for (const key of required) {
      if (!form[key].trim()) return `Veld "${key}" is verplicht.`;
    }
    return '';
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    clearCart();
    setSubmitted(true);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <h1 className="checkout-title">Afrekenen</h1>

        <div className="checkout-grid">
          <form className="checkout-form" onSubmit={handleSubmit} noValidate>
            <section className="checkout-section">
              <h2>Verzendgegevens</h2>
              <div className="form-row">
                <div className="form-group">
                  <label>Voornaam *</label>
                  <input name="firstName" value={form.firstName} onChange={handleChange} className="form-input" placeholder="John" />
                </div>
                <div className="form-group">
                  <label>Achternaam *</label>
                  <input name="lastName" value={form.lastName} onChange={handleChange} className="form-input" placeholder="Doe" />
                </div>
              </div>
              <div className="form-group">
                <label>E-mailadres *</label>
                <input name="email" type="email" value={form.email} onChange={handleChange} className="form-input" placeholder="john@example.com" />
              </div>
              <div className="form-row">
                <div className="form-group form-group--wide">
                  <label>Straat *</label>
                  <input name="street" value={form.street} onChange={handleChange} className="form-input" placeholder="Voorbeeldstraat" />
                </div>
                <div className="form-group form-group--narrow">
                  <label>Nr *</label>
                  <input name="houseNumber" value={form.houseNumber} onChange={handleChange} className="form-input" placeholder="12" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group form-group--narrow">
                  <label>Postcode *</label>
                  <input name="postalCode" value={form.postalCode} onChange={handleChange} className="form-input" placeholder="1000" />
                </div>
                <div className="form-group form-group--wide">
                  <label>Stad *</label>
                  <input name="city" value={form.city} onChange={handleChange} className="form-input" placeholder="Brussel" />
                </div>
              </div>
              <div className="form-group">
                <label>Land</label>
                <select name="country" value={form.country} onChange={handleChange} className="form-select">
                  <option>België</option>
                  <option>Nederland</option>
                  <option>Luxemburg</option>
                </select>
              </div>
            </section>

            <section className="checkout-section">
              <h2>Betaalmethode</h2>
              <div className="payment-options">
                {[
                  { value: 'bancontact', label: 'Bancontact' },
                  { value: 'creditcard', label: 'Creditcard' },
                  { value: 'ideal', label: 'iDEAL' },
                  { value: 'paypal', label: 'PayPal' },
                ].map((opt) => (
                  <label key={opt.value} className={`payment-option ${paymentMethod === opt.value ? 'payment-option--selected' : ''}`}>
                    <input
                      type="radio"
                      name="payment"
                      value={opt.value}
                      checked={paymentMethod === opt.value}
                      onChange={() => setPaymentMethod(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </section>

            {error && <p className="checkout-error">{error}</p>}

            <button type="submit" className="btn-primary btn-full checkout-submit">
              Bestelling bevestigen
            </button>
          </form>

          <aside className="order-summary">
            <h2>Overzicht</h2>
            <ul className="summary-items">
              {items.map((item) => (
                <li key={item.id} className="summary-item">
                  <img src={item.product.imageUrl} alt={item.product.name} className="summary-img" />
                  <div className="summary-item-info">
                    <p className="summary-item-name">{item.product.name}</p>
                    <p className="summary-item-meta">{item.flavor} × {item.quantity}</p>
                  </div>
                  <span className="summary-item-price">€{(item.quantity * item.product.price).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <div className="summary-divider" />
            <div className="summary-row">
              <span>Subtotaal</span>
              <span>€{totalPrice.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>Verzending</span>
              <span className="summary-free">Gratis</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-row summary-row--total">
              <strong>Totaal</strong>
              <strong className="summary-total-price">€{totalPrice.toFixed(2)}</strong>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
