import React from 'react';
import './Footer.css';

const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <span>&copy; {new Date().getFullYear()} Preworkout Webshop. All rights reserved.</span>
      </div>
    </footer>
  );
};

export default Footer;
