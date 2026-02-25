import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Activity, Moon, Sun, User as UserIcon, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AppLayout() {
    const [theme, setTheme] = useState(() => localStorage.getItem('nksss_theme') || 'light');
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('nksss_theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'));

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="app-container">
            <header style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', position: 'sticky', top: 0, zIndex: 10 }}>
                <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '700', fontSize: '1.25rem', color: 'var(--color-primary)' }}>
                    <img src="/logo.png" alt="NKSSS Logo" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                    NKSSS
                </Link>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {currentUser && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.9rem', borderRight: '1px solid var(--color-border)', paddingRight: '1rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', background: 'rgba(14, 165, 233, 0.1)', padding: '0.3rem', borderRadius: '50%', color: 'var(--color-primary)' }}>
                                <UserIcon size={16} />
                            </span>
                            <span className="hide-on-mobile">Bs. {currentUser.displayName}</span>
                        </div>
                    )}
                    <button className="btn btn-secondary" onClick={toggleTheme} style={{ padding: '0.5rem', borderRadius: '50%' }} aria-label="Toggle Theme">
                        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                    </button>
                    <button className="btn" onClick={handleLogout} style={{ padding: '0.5rem', borderRadius: '50%', color: 'var(--color-danger)' }} aria-label="Đăng xuất" title="Đăng xuất">
                        <LogOut size={20} />
                    </button>
                </div>
            </header>
            <main className="page-content animate-slide-up">
                <Outlet />
            </main>
        </div>
    );
}
