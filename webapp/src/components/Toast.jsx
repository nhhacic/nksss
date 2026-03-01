import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext();

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const idRef = useRef(0);

    const addToast = useCallback((message, type = 'info', duration = 4000) => {
        const id = ++idRef.current;
        setToasts(prev => [...prev, { id, message, type, duration }]);
        if (duration > 0) {
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, duration);
        }
        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const toast = useCallback({
        success: (msg, dur) => addToast(msg, 'success', dur),
        error: (msg, dur) => addToast(msg, 'error', dur ?? 6000),
        warning: (msg, dur) => addToast(msg, 'warning', dur),
        info: (msg, dur) => addToast(msg, 'info', dur),
    }, [addToast]);

    // Make toast callable as toast.success(), etc.
    const toastApi = useCallback(Object.assign(
        (msg, type, dur) => addToast(msg, type, dur),
        {
            success: (msg, dur) => addToast(msg, 'success', dur),
            error: (msg, dur) => addToast(msg, 'error', dur ?? 6000),
            warning: (msg, dur) => addToast(msg, 'warning', dur),
            info: (msg, dur) => addToast(msg, 'info', dur),
        }
    ), [addToast]);

    return (
        <ToastContext.Provider value={toastApi}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
}

export const useToast = () => useContext(ToastContext);

const iconMap = {
    success: <CheckCircle2 size={18} />,
    error: <AlertTriangle size={18} />,
    warning: <AlertTriangle size={18} />,
    info: <Info size={18} />,
};

const colorMap = {
    success: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.4)', color: 'var(--color-success)' },
    error: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.4)', color: 'var(--color-danger)' },
    warning: { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.4)', color: 'var(--color-warning)' },
    info: { bg: 'rgba(14, 165, 233, 0.12)', border: 'rgba(14, 165, 233, 0.4)', color: 'var(--color-primary)' },
};

function ToastContainer({ toasts, onRemove }) {
    if (toasts.length === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            maxWidth: '380px',
            width: 'calc(100vw - 2rem)',
        }}>
            {toasts.map(t => (
                <ToastItem key={t.id} toast={t} onRemove={onRemove} />
            ))}
        </div>
    );
}

function ToastItem({ toast, onRemove }) {
    const colors = colorMap[toast.type] || colorMap.info;

    return (
        <div
            className="animate-slide-down"
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.875rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                color: colors.color,
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                fontSize: '0.9rem',
                fontWeight: 500,
                lineHeight: 1.4,
                animation: 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
        >
            <span style={{ flexShrink: 0, marginTop: '1px' }}>{iconMap[toast.type]}</span>
            <span style={{ flex: 1, color: 'var(--color-text)' }}>{toast.message}</span>
            <button
                onClick={() => onRemove(toast.id)}
                style={{
                    background: 'none', border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer', padding: '2px',
                    flexShrink: 0,
                }}
            >
                <X size={16} />
            </button>
        </div>
    );
}
