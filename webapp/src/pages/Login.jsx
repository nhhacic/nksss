import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Activity } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, register, resetPassword } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            setError('');
            setMessage('');
            setLoading(true);
            await login(email, password);
            navigate('/');
        } catch (err) {
            setError('Đăng nhập thất bại. Vui lòng kiểm tra lại mật khẩu hoặc Tài khoản chưa được đăng ký.');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async () => {
        if (!email || !password) {
            setError('Vui lòng điền Email và Mật khẩu để Đăng ký.');
            return;
        }
        if (password.length < 6) {
            setError('Mật khẩu quá ngắn, cần tối thiểu 6 ký tự.');
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
                setError('Tài khoản Email này đã được sử dụng.');
            } else {
                setError('Lỗi hệ thống: ' + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!email) {
            setError('Vui lòng nhập chính xác Tài khoản (Email) để khôi phục.');
            return;
        }
        try {
            setError('');
            setMessage('');
            setLoading(true);
            await resetPassword(email);
            setMessage('Đã gửi email khôi phục! Vui lòng kiểm tra Hộp thư của bạn.');
        } catch (err) {
            if (err.code === 'auth/user-not-found') {
                setError('Tài khoản không tồn tại trong hệ thống.');
            } else {
                setError('Lỗi khôi phục: ' + err.message);
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
                    <h1 style={{ color: 'var(--color-primary)', fontSize: '1.75rem', marginBottom: '0.25rem' }}>NKSSS Online</h1>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Nền tảng kiểm soát chuyên khoa Sơ sinh</p>
                </div>

                {error && <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>{error}</div>}
                {message && <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--color-success)', color: 'var(--color-success)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>{message}</div>}

                <form onSubmit={handleLogin}>
                    <div className="input-group">
                        <label className="input-label">Tài khoản (Email bác sĩ)</label>
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
                            <label className="input-label" style={{ marginBottom: 0 }}>Mật khẩu</label>
                            <button type="button" onClick={handleResetPassword} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }} disabled={loading}>Quên mật khẩu?</button>
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
                        {loading ? 'Đang kết nối...' : 'Đăng nhập Hệ thống'}
                    </button>

                    <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ width: '100%', marginTop: '0.5rem' }}
                        onClick={handleRegister}
                        disabled={loading}
                    >
                        {loading ? 'Đang xử lý...' : 'Tạo mới Tài khoản'}
                    </button>
                </form>

            </div>
        </div>
    );
}
