import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import './index.css';
import ProductDetailPage from './pages/ProductDetailPage';
import { CartProvider } from './contexts/CartContext';

function App() {
  return (
    <CartProvider>
      <Router>
        <Routes>
          <Route path="/product/:id" element={<ProductDetailPage />} />
          {/* Add other routes here */}
        </Routes>
      </Router>
    </CartProvider>
  );
}

export default App;
