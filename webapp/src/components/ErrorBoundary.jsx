import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            // Use locale from localStorage since we can't use hooks in class components
            const locale = localStorage.getItem('nksss_locale') || 'vi';
            const title = locale === 'vi' ? 'Đã xảy ra lỗi' : 'An error occurred';
            const message = locale === 'vi'
                ? 'Hệ thống gặp sự cố không mong muốn. Vui lòng tải lại trang để tiếp tục sử dụng.'
                : 'The application encountered an unexpected error. Please reload the page to continue.';
            const detail = locale === 'vi' ? 'Chi tiết lỗi' : 'Error details';
            const reload = locale === 'vi' ? 'Tải lại trang' : 'Reload page';

            return (
                <div style={{
                    minHeight: '60vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem',
                }}>
                    <div className="card" style={{
                        maxWidth: '420px',
                        width: '100%',
                        textAlign: 'center',
                        padding: '2.5rem 2rem',
                        borderColor: 'var(--color-danger)',
                    }}>
                        <div style={{
                            width: '56px', height: '56px',
                            borderRadius: '50%',
                            background: 'var(--color-danger-bg)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1.25rem',
                        }}>
                            <AlertTriangle size={28} color="var(--color-danger)" />
                        </div>
                        <h2 style={{ marginBottom: '0.5rem', fontSize: '1.2rem' }}>{title}</h2>
                        <p style={{
                            color: 'var(--color-text-muted)',
                            fontSize: '0.9rem',
                            marginBottom: '1.5rem',
                            lineHeight: 1.5,
                        }}>
                            {message}
                        </p>
                        {this.state.error && (
                            <details style={{
                                textAlign: 'left',
                                marginBottom: '1.5rem',
                                padding: '0.75rem',
                                background: 'var(--color-surface-raised)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.8rem',
                                color: 'var(--color-text-muted)',
                            }}>
                                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{detail}</summary>
                                <pre style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                    {this.state.error.toString()}
                                </pre>
                            </details>
                        )}
                        <button
                            className="btn btn-primary"
                            onClick={() => window.location.reload()}
                            style={{ margin: '0 auto' }}
                        >
                            <RefreshCcw size={16} /> {reload}
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
