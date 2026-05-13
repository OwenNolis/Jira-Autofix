import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './OrdersPage.css';

const STATUS_LABEL: Record<string, string> = {
  Pending: 'In afwachting',
  Paid: 'Betaald',
  Shipped: 'Verzonden',
  Delivered: 'Geleverd',
  Cancelled: 'Geannuleerd',
};

const STATUS_COLOR: Record<string, string> = {
  Pending: 'status--pending',
  Paid: 'status--paid',
  Shipped: 'status--shipped',
  Delivered: 'status--delivered',
  Cancelled: 'status--cancelled',
};

const DEMO_ORDERS = [
  {
    id: 1001,
    createdAt: '2026-04-28T10:30:00Z',
    status: 'Delivered',
    totalPrice: 74.98,
    lines: [
      { id: 1, productName: 'Nitro Peach', flavor: 'Peach', quantity: 1, unitPrice: 34.99 },
      { id: 2, productName: 'Mango Rush', flavor: 'Mango', quantity: 1, unitPrice: 39.99 },
    ],
  },
  {
    id: 1002,
    createdAt: '2026-05-02T14:15:00Z',
    status: 'Shipped',
    totalPrice: 32.99,
    lines: [
      { id: 3, productName: 'Blue Ice', flavor: 'Blueberry', quantity: 1, unitPrice: 32.99 },
    ],
  },
];

export default function OrdersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="orders-login-prompt">
        <h2>Log in om je bestellingen te bekijken</h2>
        <button className="btn-primary" onClick={() => navigate('/login')}>Inloggen</button>
      </div>
    );
  }

  return (
    <div className="orders-page">
      <div className="orders-container">
        <h1 className="orders-title">Mijn Bestellingen</h1>

        {DEMO_ORDERS.length === 0 ? (
          <div className="orders-empty">
            <p>Je hebt nog geen bestellingen geplaatst.</p>
            <button className="btn-primary" onClick={() => navigate('/')}>Naar de shop</button>
          </div>
        ) : (
          <div className="orders-list">
            {DEMO_ORDERS.map((order) => (
              <div key={order.id} className="order-card">
                <div className="order-card-header">
                  <div>
                    <span className="order-id">Bestelling #{order.id}</span>
                    <span className="order-date">{new Date(order.createdAt).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  <span className={`order-status ${STATUS_COLOR[order.status]}`}>
                    {STATUS_LABEL[order.status]}
                  </span>
                </div>

                <ul className="order-lines">
                  {order.lines.map((line) => (
                    <li key={line.id} className="order-line">
                      <span className="order-line-name">{line.productName}</span>
                      <span className="order-line-meta">{line.flavor} × {line.quantity}</span>
                      <span className="order-line-price">€{(line.quantity * line.unitPrice).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>

                <div className="order-card-footer">
                  <span className="order-total-label">Totaal</span>
                  <strong className="order-total-price">€{order.totalPrice.toFixed(2)}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
