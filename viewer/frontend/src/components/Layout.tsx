import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Search, Home, Library, BookOpen, Menu, X } from 'lucide-react';
import { useDebounce } from '../hooks';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchText.trim()) {
      navigate(`/collection?search=${encodeURIComponent(searchText.trim())}`);
    }
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/collection', label: 'Collection', icon: Library },
    { path: '/binders', label: 'Binders', icon: BookOpen },
  ];

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="header-left">
            <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <Link to="/" className="logo">
              <span className="logo-icon">⚾</span>
              <span className="logo-text">The Dugout</span>
            </Link>
          </div>

          <form className="search-form" onSubmit={handleSearch}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search cards..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="search-input"
            />
          </form>

          <nav className={`nav ${mobileMenuOpen ? 'nav-open' : ''}`}>
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <item.icon size={16} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="main">
        {children}
      </main>
    </div>
  );
}
