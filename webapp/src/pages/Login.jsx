import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n/LanguageContext';
import { auth } from '../lib/firebase';
import { getRedirectResult } from 'firebase/auth';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, register, resetPassword, loginWithGoogle, currentUser } = useAuth();
    const { t, locale, setLocale } = useTranslation();
    const navigate = useNavigate();

    // Nếu user đã đăng nhập (bao gồm sau Google redirect) → vào thẳng trang chủ
    useEffect(() => {
        if (currentUser) navigate('/', { replace: true });
    }, [currentUser, navigate]);

    // Xử lý kết quả redirect Google ngay tại trang Login
    useEffect(() => {
        getRedirectResult(auth)
            .then(result => {
                if (result?.user) navigate('/', { replace: true });
            })
            .catch(err => {
                if (err.code !== 'auth/no-current-user') {
                    console.error('Google redirect result error:', err);
                    setError(t('login.errorGeneral'));
                }
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            setError('');
            setMessage('');
            setLoading(true);
            await login(email, password);
            navigate('/');
        } catch (err) {
            setError(t('login.errorLogin'));
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async () => {
        if (!email || !password) {
            setError(t('login.errorGeneral'));
            return;
        }
        if (password.length < 6) {
            setError(t('login.errorWeakPassword'));
            return;
        }
        try {
            setError('');
            setMessage('');
            setLoading(true);
            await register(email, password);
            // Đăng ký thành công tự vào app
            navigate('/');
        } catch (err) {
            if (err.code === 'auth/email-already-in-use') {
                setError(t('login.errorEmailInUse'));
            } else {
                setError(t('login.errorGeneral') + ': ' + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            setError('');
            setLoading(true);
            await loginWithGoogle();
            navigate('/');
        } catch (err) {
            setError(t('login.errorGeneral'));
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!email) {
            setError(t('login.errorGeneral'));
            return;
        }
        try {
            setError('');
            setMessage('');
            setLoading(true);
            await resetPassword(email);
            setMessage(t('login.resetSuccess'));
        } catch (err) {
            if (err.code === 'auth/user-not-found') {
                setError(t('login.errorGeneral'));
            } else {
                setError(t('login.errorGeneral') + ': ' + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-background)', padding: '1rem' }}>
            <div className="card glass-panel animate-slide-up" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem 2rem' }}>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
                    <img src="/logo.png" alt="NKSSS Logo" style={{ width: '64px', height: '64px', borderRadius: '50%', marginBottom: '1rem', boxShadow: '0 4px 10px rgba(14, 165, 233, 0.2)' }} />
                    <h1 style={{ color: 'var(--color-primary)', fontSize: '1.75rem', marginBottom: '0.25rem' }}>{t('login.title')}</h1>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{t('login.subtitle')}</p>
                    {/* Language toggle on login page */}
                    <button onClick={() => setLocale(locale === 'vi' ? 'en' : 'vi')}
                        style={{ marginTop: '0.5rem', background: 'none', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)', fontFamily: 'var(--font-sans)' }}>
                        {locale === 'vi' ? '🇬🇧 English' : '🇻🇳 Tiếng Việt'}
                    </button>
                </div>

                {error && <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>{error}</div>}
                {message && <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--color-success)', color: 'var(--color-success)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>{message}</div>}

                <form onSubmit={handleLogin}>
                    <div className="input-group">
                        <label className="input-label">{t('login.email')}</label>
                        <input
                            type="email"
                            className="input-field"
                            placeholder="bacsia@benhvien.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label className="input-label" style={{ marginBottom: 0 }}>{t('login.password')}</label>
                            <button type="button" onClick={handleResetPassword} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }} disabled={loading}>{t('login.forgotPassword')}</button>
                        </div>
                        <input
                            type="password"
                            className="input-field"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '1rem' }}
                        disabled={loading}
                    >
                        {loading ? t('common.loading') : t('login.signIn')}
                    </button>

                    <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ width: '100%', marginTop: '0.5rem' }}
                        onClick={handleRegister}
                        disabled={loading}
                    >
                        {loading ? t('common.loading') : t('login.signUp')}
                    </button>

                    {/* Divider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.25rem 0 0.5rem' }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>{locale === 'vi' ? 'hoặc' : 'or'}</span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
                    </div>

                    {/* Google Sign-In */}
                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            border: '1.5px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--color-surface)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.6rem',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-sans)',
                            fontWeight: 600,
                            fontSize: '0.95rem',
                            color: 'var(--color-text)',
                            transition: 'all 0.2s',
                        }}
                    >
                        {/* Google logo SVG */}
                        <svg width="20" height="20" viewBox="0 0 48 48">
                            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                        </svg>
                        {t('login.googleLogin')}
                    </button>
                </form>

            </div>
        </div>
    );
}
