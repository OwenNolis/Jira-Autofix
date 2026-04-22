// Add a conditional className to the nav bar based on authentication status
<nav className={isAuthenticated ? 'nav-bar authenticated' : 'nav-bar'}>
  <li>Home</li>
  <li>About</li>
  <li className="logout-link">Logout</li>
</nav>