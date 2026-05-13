import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import CartDrawer from './CartDrawer';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <>
      <nav className="navbar">
        <Link to="/" className="navbar-brand">
          PULSE <span>PRE</span>
        </Link>

        <button className="navbar-hamburger" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
          ☰
        </button>

        <ul className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          <li><Link to="/" onClick={() => setMenuOpen(false)}>Shop</Link></li>
          {user ? (
            <>
              <li><Link to="/orders" onClick={() => setMenuOpen(false)}>Mijn Bestellingen</Link></li>
              {user.role === 'Admin' && (
                <li><Link to="/admin" onClick={() => setMenuOpen(false)}>Admin</Link></li>
              )}
              <li>
                <button className="navbar-link-btn" onClick={() => { handleLogout(); setMenuOpen(false); }}>
                  Uitloggen
                </button>
              </li>
            </>
          ) : (
            <>
              <li><Link to="/login" onClick={() => setMenuOpen(false)}>Inloggen</Link></li>
              <li><Link to="/register" onClick={() => setMenuOpen(false)}>Registreren</Link></li>
            </>
          )}
          <li>
            <button className="cart-btn" onClick={() => { setCartOpen(true); setMenuOpen(false); }}>
              🛒 <span className="cart-badge">{totalItems}</span>
            </button>
          </li>
        </ul>
      </nav>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
