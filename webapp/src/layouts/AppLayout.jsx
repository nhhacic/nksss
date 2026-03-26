import { Outlet, Link, useNavigate, useLocation, useBlocker } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePatient } from '../context/PatientContext';
import { useTranslation } from '../i18n/LanguageContext';
import { LogOut, User as UserIcon, MessageSquare, Bell, Clock, Activity, Globe, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, writeBatch, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatDistanceToNow } from 'date-fns';
import { vi, enUS } from 'date-fns/locale';

export default function AppLayout() {
    const [theme, setTheme] = useState(() => localStorage.getItem('nksss_theme') || 'dark');
    const { currentUser, logout } = useAuth();
    const { t, locale, setLocale } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [unreadCount, setUnreadCount] = useState(0);
    const [latestNotifications, setLatestNotifications] = useState([]);
    const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
    const menuRef = useRef(null);

    const { patient } = usePatient();

    const isPatientFlow = (pathname) => {
        return ['/admission', '/diagnosis', '/treatment', '/review', '/calculator', '/followup'].includes(pathname);
    };

    const hasUnsavedData = isPatientFlow(location.pathname) && (patient.id || patient.dob || patient.weight);

    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) => {
            if (hasUnsavedData && !isPatientFlow(nextLocation.pathname) && currentLocation.pathname !== nextLocation.pathname) {
                return !window.confirm(t('nav.unsavedWarning'));
            }
            return false;
        }
    );

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedData) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedData]);

    useEffect(() => {
        if (!currentUser) return;

        // Unread count
        const qUnread = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid),
            where('isRead', '==', false)
        );

        const unsubUnread = onSnapshot(qUnread, (snapshot) => {
            setUnreadCount(snapshot.size);
        });

        // Top 5 latest
        const qLatest = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid),
            orderBy('createdAt', 'desc'),
            limit(5)
        );

        const unsubLatest = onSnapshot(qLatest, (snapshot) => {
            const list = [];
            snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
            setLatestNotifications(list);
        });

        return () => {
            unsubUnread();
            unsubLatest();
        };
    }, [currentUser]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowNotificationsMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNotificationClick = async (n) => {
        setShowNotificationsMenu(false);
        if (!n.isRead) {
            try {
                await updateDoc(doc(db, 'notifications', n.id), { isRead: true });
            } catch (error) {
                console.error("Lỗi cập nhật đã đọc", error);
            }
        }

        if (n.type === 'consult_reply' && n.consultId) {
            navigate(`/consult/${n.consultId}`);
        } else if (n.patientId) {
            navigate(`/reevaluation/${n.patientId}`);
        } else {
            // Try to extract patient ID from message (backward compat)
            const match = n.message?.match(/(?:bệnh nhân|patient)\s+(\S+)/i);
            if (match) {
                navigate(`/reevaluation/${match[1].replace(/[!.,;:]$/, '')}`);
            } else {
                navigate('/notifications');
            }
        }
    };

    const deleteDropdownNotification = async (e, id) => {
        e.stopPropagation();
        try {
            await deleteDoc(doc(db, 'notifications', id));
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('nksss_theme', theme);
    }, [theme]);

    useEffect(() => {
        const handleThemeChange = (e) => setTheme(e.detail || localStorage.getItem('nksss_theme') || 'dark');
        window.addEventListener('themeChange', handleThemeChange);
        return () => window.removeEventListener('themeChange', handleThemeChange);
    }, []);

    const handleLogout = async () => {
        if (hasUnsavedData) {
            const confirmLeave = window.confirm(t('nav.unsavedLogout'));
            if (!confirmLeave) return;
        }
        await logout();
        navigate('/login');
    };

    const isHome = location.pathname === '/';

    return (
        <div className="app-container">
            <header style={{
                padding: '0.75rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                boxShadow: 'var(--shadow-sm)',
            }}>
                <Link to="/" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    fontWeight: '800',
                    fontSize: '1.1rem',
                    color: 'var(--color-text)',
                    letterSpacing: '-0.03em',
                }}>
                    <img src="/logo.png" alt="NKSSS Logo" style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        border: '2px solid rgba(14,165,233,0.3)',
                    }} />
                    <span>
                        <span style={{ color: 'var(--color-primary)' }}>NEO</span>
                        <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, fontSize: '0.85rem', marginLeft: '4px' }}>SEPSIS</span>
                    </span>
                </Link>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {currentUser && (
                        <Link to="/profile" style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.25rem 0.75rem 0.25rem 0.25rem',
                            borderRadius: '999px',
                            background: 'rgba(14, 165, 233, 0.1)',
                            border: '1px solid rgba(14, 165, 233, 0.2)',
                        }}>
                            {currentUser.photoURL ? (
                                <img
                                    src={currentUser.photoURL}
                                    alt="Avatar"
                                    style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                                />
                            ) : (
                                <UserIcon size={14} style={{ color: 'var(--color-primary)', padding: '2px' }} />
                            )}
                            <span className="hide-on-mobile" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                                {currentUser.displayName
                                    ? `${locale === 'vi' ? 'Bs.' : 'Dr.'} ${currentUser.displayName.split(' ').pop()}`
                                    : t('common.doctor')}
                            </span>
                        </Link>
                    )}

                    <Link to="/consult" style={{
                        display: 'flex',
                        padding: '0.45rem',
                        borderRadius: '50%',
                        border: `1px solid ${location.pathname.startsWith('/consult') ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        color: location.pathname.startsWith('/consult') ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        background: location.pathname.startsWith('/consult') ? 'rgba(14, 165, 233, 0.1)' : 'var(--color-surface)',
                    }} title={t('nav.consult')}>
                        <MessageSquare size={18} />
                    </Link>

                    {currentUser && (
                        <div style={{ position: 'relative' }} ref={menuRef}>
                            <button onClick={() => setShowNotificationsMenu(!showNotificationsMenu)} style={{
                                display: 'flex',
                                position: 'relative',
                                padding: '0.45rem',
                                borderRadius: '50%',
                                border: `1px solid ${showNotificationsMenu || location.pathname.startsWith('/notifications') ? 'var(--color-warning)' : 'var(--color-border)'}`,
                                color: showNotificationsMenu || location.pathname.startsWith('/notifications') ? 'var(--color-warning)' : 'var(--color-text-muted)',
                                background: showNotificationsMenu || location.pathname.startsWith('/notifications') ? 'rgba(245, 158, 11, 0.1)' : 'var(--color-surface)',
                                cursor: 'pointer',
                            }} title={t('nav.notifications')}>
                                <Bell size={18} />
                                {unreadCount > 0 && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '-4px',
                                        right: '-4px',
                                        background: 'var(--color-danger)',
                                        color: 'white',
                                        fontSize: '0.65rem',
                                        fontWeight: 'bold',
                                        width: '18px',
                                        height: '18px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '50%',
                                        border: '2px solid var(--color-surface)'
                                    }}>
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {showNotificationsMenu && (
                                <div className="card animate-slide-down" style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 10px)',
                                    right: 0,
                                    width: '320px',
                                    padding: '0',
                                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
                                    zIndex: 1000,
                                    overflow: 'hidden'
                                }}>
                                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface-raised)' }}>
                                        <h3 style={{ margin: 0, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>{t('nav.newNotifications')}</h3>
                                        <Link to="/notifications" onClick={() => setShowNotificationsMenu(false)} style={{ fontSize: '0.75rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>{t('common.viewAll')}</Link>
                                    </div>
                                    <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                        {latestNotifications.length === 0 ? (
                                            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                                                {t('nav.noNotifications')}
                                            </div>
                                        ) : (
                                            latestNotifications.map(n => (
                                                <div
                                                    key={n.id}
                                                    onClick={() => handleNotificationClick(n)}
                                                    style={{
                                                        padding: '0.75rem 1rem',
                                                        borderBottom: '1px solid var(--color-border)',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        gap: '0.75rem',
                                                        alignItems: 'flex-start',
                                                        background: !n.isRead ? 'rgba(14, 165, 233, 0.05)' : 'transparent',
                                                        borderLeft: !n.isRead ? '3px solid var(--color-primary)' : '3px solid transparent',
                                                        transition: 'background 0.2s ease'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-raised)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = !n.isRead ? 'rgba(14, 165, 233, 0.05)' : 'transparent'}
                                                >
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: n.type === 'consult_reply' ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: n.type === 'consult_reply' ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                                                        {n.type === 'consult_reply' ? <MessageSquare size={14} /> : (n.type === 'system_alert' ? <Activity size={14} /> : <Bell size={14} />)}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.85rem', fontWeight: !n.isRead ? 700 : 500, color: 'var(--color-text)', lineHeight: 1.3 }}>{n.title}</h4>
                                                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>{n.message}</p>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                                            <Clock size={10} /> {n.createdAt ? formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true, locale: locale === 'vi' ? vi : enUS }) : t('common.justNow')}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={(e) => deleteDropdownNotification(e, n.id)}
                                                        style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--color-text-muted)', borderRadius: '50%', flexShrink: 0, opacity: 0.4, transition: 'all 0.2s', alignSelf: 'center' }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--color-danger)'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.4'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                                                        title={locale === 'vi' ? 'Xoá' : 'Delete'}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    {latestNotifications.length > 0 && (
                                        <div style={{ padding: '0.5rem', textAlign: 'center', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-raised)' }}>
                                            <Link to="/notifications" onClick={() => setShowNotificationsMenu(false)} style={{ fontSize: '0.8rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>{t('nav.viewAllNotifications')} &rarr;</Link>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Nút cài đặt giao diện đã chuyển vào Profile */}

                    {/* Language switcher */}
                    <button
                        onClick={() => setLocale(locale === 'vi' ? 'en' : 'vi')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.3rem 0.6rem',
                            borderRadius: '999px',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-surface)',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: 'var(--color-text)',
                            fontFamily: 'var(--font-sans)',
                        }}
                        title={t('profile.language')}
                    >
                        {locale === 'vi' ? '🇻🇳 VI' : '🇬🇧 EN'}
                    </button>

                    <button
                        onClick={handleLogout}
                        style={{
                            display: 'flex',
                            padding: '0.45rem',
                            borderRadius: '50%',
                            border: '1px solid rgba(239,68,68,0.2)',
                            color: 'var(--color-danger)',
                            background: 'rgba(239,68,68,0.05)',
                            cursor: 'pointer',
                        }}
                        aria-label={t('nav.logout')}
                        title={t('nav.logout')}
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </header >

            <main className="page-content animate-slide-up">
                <Outlet />
            </main>
            <div className="copyright-footer" style={{
                textAlign: 'center',
                padding: '1rem',
                fontSize: '0.75rem',
                color: 'var(--color-text-muted)',
                borderTop: '1px solid var(--color-border)',
                marginTop: '2rem'
            }}>
                © {new Date().getFullYear()} NKSSS - Bản quyền thuộc về Shark Hà đẹp trai
            </div>
        </div >
    );
}
