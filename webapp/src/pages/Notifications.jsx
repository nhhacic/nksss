import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, BellRing, MessageSquare, Clock, Trash2, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n/LanguageContext';
import { formatDistanceToNow } from 'date-fns';
import { vi, enUS } from 'date-fns/locale';

export default function Notifications() {
    const [notifications, setNotifications] = useState([]);
    const { currentUser } = useAuth();
    const { t, locale } = useTranslation();
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = [];
            snapshot.forEach((d) => {
                list.push({ id: d.id, ...d.data() });
            });
            setNotifications(list);
            setLoading(false);
        });

        return unsubscribe;
    }, [currentUser]);

    const markAllAsRead = async () => {
        if (notifications.length === 0) return;

        const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
        if (unreadIds.length === 0) return;

        const batch = writeBatch(db);
        unreadIds.forEach(id => {
            const ref = doc(db, 'notifications', id);
            batch.update(ref, { isRead: true });
        });

        try {
            await batch.commit();
        } catch (error) {
            console.error("Error marking as read:", error);
        }
    };

    const markAsRead = async (id, isRead) => {
        if (isRead) return;
        try {
            await updateDoc(doc(db, 'notifications', id), { isRead: true });
        } catch (error) {
            console.error("Error marking as read:", error);
        }
    };

    const deleteNotification = async (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            await deleteDoc(doc(db, 'notifications', id));
        } catch (error) {
            console.error("Error deleting notification:", error);
        }
    };

    const deleteAllNotifications = async () => {
        if (notifications.length === 0) return;
        if (!window.confirm(locale === 'vi' ? 'Xoá toàn bộ thông báo?' : 'Delete all notifications?')) return;

        const batch = writeBatch(db);
        notifications.forEach(n => {
            batch.delete(doc(db, 'notifications', n.id));
        });

        try {
            await batch.commit();
        } catch (error) {
            console.error("Error deleting all:", error);
        }
    };

    // Extract patient ID from notification for linking
    const getNotificationLink = (n) => {
        if (n.type === 'consult_reply' && n.consultId) return `/consult/${n.consultId}`;
        if (n.patientId) return `/reevaluation/${n.patientId}`;
        // Try to extract patient ID from message (backward compat)
        const match = n.message?.match(/(?:bệnh nhân|patient)\s+(\S+)/i);
        if (match) return `/reevaluation/${match[1].replace(/[!.,;:]$/, '')}`;
        return null;
    };

    const handleClick = (n) => {
        markAsRead(n.id, n.isRead);
        const link = getNotificationLink(n);
        if (link) navigate(link);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <BellRing size={24} /> {t('notifications.title')}
                </h1>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {notifications.some(n => !n.isRead) && (
                        <button
                            className="btn btn-secondary"
                            onClick={markAllAsRead}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}
                        >
                            {t('notifications.markAllRead')}
                        </button>
                    )}
                    {notifications.length > 0 && (
                        <button
                            className="btn"
                            onClick={deleteAllNotifications}
                            style={{
                                padding: '0.4rem 0.8rem', fontSize: '0.82rem',
                                background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)',
                                border: '1px solid rgba(239,68,68,0.2)',
                            }}
                        >
                            <Trash2 size={14} /> {locale === 'vi' ? 'Xoá tất cả' : 'Clear All'}
                        </button>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
                ) : notifications.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)' }}>
                        <Bell size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                        <p>{t('notifications.noNotifications')}</p>
                    </div>
                ) : (
                    notifications.map(n => (
                        <div
                            key={n.id}
                            onClick={() => handleClick(n)}
                            className={`card animate-slide-up ${!n.isRead ? 'unread' : ''}`}
                            style={{
                                cursor: getNotificationLink(n) ? 'pointer' : 'default',
                                display: 'flex',
                                flexDirection: 'row',
                                gap: '1rem',
                                padding: '1rem',
                                borderLeft: !n.isRead ? '4px solid var(--color-primary)' : '1px solid var(--color-border)',
                                background: !n.isRead ? 'rgba(14, 165, 233, 0.05)' : 'var(--color-surface)',
                                position: 'relative',
                            }}
                        >
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: n.type === 'consult_reply' ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                {n.type === 'consult_reply' ? <MessageSquare size={20} color="var(--color-success)" /> : <Bell size={20} color="var(--color-text-muted)" />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.2rem' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: !n.isRead ? 700 : 600, color: 'var(--color-text)', margin: 0 }}>
                                        {n.title}
                                    </h3>
                                </div>
                                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', margin: 0 }}>
                                    {n.message}
                                </p>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <Clock size={12} /> {n.createdAt ? formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true, locale: locale === 'vi' ? vi : enUS }) : t('common.justNow')}
                                </div>
                            </div>

                            {/* Delete button */}
                            <button
                                onClick={(e) => deleteNotification(e, n.id)}
                                style={{
                                    background: 'none', border: 'none', padding: '6px',
                                    cursor: 'pointer', color: 'var(--color-text-muted)',
                                    borderRadius: '50%', display: 'flex', alignSelf: 'center',
                                    flexShrink: 0, opacity: 0.5, transition: 'opacity 0.2s',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--color-danger)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                                title={locale === 'vi' ? 'Xoá thông báo' : 'Delete notification'}
                            >
                                <X size={18} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
