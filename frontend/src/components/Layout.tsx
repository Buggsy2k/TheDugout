import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Search, Home, Library, BookOpen, PlusCircle, Menu, X, Cpu } from 'lucide-react';
import { useDebounce } from '../hooks';
import { useTokenUsage } from '../contexts/TokenUsageContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const debouncedSearch = useDebounce(searchText, 300);
  const { tokenUsage } = useTokenUsage();

  const usagePercent = tokenUsage?.tokensLimit && tokenUsage?.tokensRemaining != null
    ? Math.min(100, Math.round(((tokenUsage.tokensLimit - tokenUsage.tokensRemaining) / tokenUsage.tokensLimit) * 100))
    : 0;

  const getUsageColor = (pct: number) => {
    if (pct < 50) return '#22c55e';
    if (pct < 75) return '#eab308';
    if (pct < 90) return '#f97316';
    return '#ef4444';
  };

  const meterTitle = tokenUsage
    ? (tokenUsage.tokensLimit != null && tokenUsage.tokensRemaining != null
      ? `API tokens: ${usagePercent}% used (${tokenUsage.tokensRemaining.toLocaleString()} remaining of ${tokenUsage.tokensLimit.toLocaleString()})`
      : `Last call: ${tokenUsage.totalTokens.toLocaleString()} tokens`)
    : 'AI token usage — no calls made yet';

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
    { path: '/bulk-entry', label: 'Bulk Entry', icon: PlusCircle },
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

          <div className="token-meter" title={meterTitle}>
            <Cpu size={14} className="token-meter-icon" />
            <div className="token-meter-bar">
              <div
                className="token-meter-fill"
                style={{ width: `${usagePercent}%`, background: getUsageColor(usagePercent) }}
              />
            </div>
            <span className="token-meter-pct">{usagePercent}%</span>
          </div>
        </div>
      </header>

      <main className="main">
        {children}
      </main>
    </div>
  );
}
