import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import CheckoutPage from './pages/CheckoutPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import OrdersPage from './pages/OrdersPage';
import ProductDetailPage from './pages/ProductDetailPage';
import RegisterPage from './pages/RegisterPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/products/:id" element={<ProductDetailPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Routes>
          </main>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
