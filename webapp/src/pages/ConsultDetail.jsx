import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MessageSquare, ArrowLeft, User, Clock, CheckCircle2, ChevronRight, Send, AlertTriangle, Paperclip, Activity } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n/LanguageContext';
import { useToast } from '../components/Toast';
import { formatDistanceToNow, format } from 'date-fns';
import { vi, enUS } from 'date-fns/locale';

export default function ConsultDetail() {
    const { id } = useParams();
    const [consult, setConsult] = useState(null);
    const [replies, setReplies] = useState([]);
    const [newReply, setNewReply] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { currentUser } = useAuth();
    const { t, locale } = useTranslation();
    const toast = useToast();
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [agreedToTerms, setAgreedToTerms] = useState(false); // Only ask once per session for reply
    const [showWarningModal, setShowWarningModal] = useState(false);

    // Fetch user profile logic
    useEffect(() => {
        const fetchProfile = async () => {
            if (!currentUser) return;
            const docRef = doc(db, 'users', currentUser.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setUserProfile(docSnap.data());
            }
        };
        fetchProfile();
    }, [currentUser]);

    // Load Consult
    useEffect(() => {
        const loadThread = async () => {
            try {
                const docRef = doc(db, 'consults', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setConsult({ id: docSnap.id, ...docSnap.data() });
                }
            } catch (error) {
                console.error("Lỗi tải ca hội chẩn:", error);
            } finally {
                setLoading(false);
            }
        };
        loadThread();
    }, [id]);

    // Load Replies
    useEffect(() => {
        const repliesRef = collection(db, 'consults', id, 'replies');
        const q = query(repliesRef, orderBy('createdAt', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = [];
            snapshot.forEach((doc) => {
                list.push({ id: doc.id, ...doc.data() });
            });
            setReplies(list);
        });
        return unsubscribe;
    }, [id]);

    const handleSendReply = async () => {
        if (!newReply.trim()) return;

        if (!agreedToTerms) {
            setShowWarningModal(true);
            return;
        }

        setSubmitting(true);
        try {
            const authorAttr = (userProfile?.department ? `${userProfile.department} - ` : '') + (userProfile?.hospital || '');

            // Add reply
            await addDoc(collection(db, 'consults', id, 'replies'), {
                content: newReply.trim(),
                authorId: currentUser.uid,
                authorName: currentUser.displayName || t('consult.anonymousDoctor'),
                authorAvatar: currentUser.photoURL || '',
                authorAttr: authorAttr,
                createdAt: serverTimestamp(),
            });

            // Update reply count and last update time on consult doc
            await updateDoc(doc(db, 'consults', id), {
                replyCount: increment(1),
                updatedAt: serverTimestamp()
            });

            // Gửi thông báo cho chủ sở hữu bài viết nếu người trả lời không phải là họ
            if (consult.authorId !== currentUser.uid) {
                await addDoc(collection(db, 'notifications'), {
                    userId: consult.authorId,
                    type: 'consult_reply',
                    title: t('consultDetail.replyNotifTitle'),
                    message: `${locale === 'vi' ? 'Bs.' : 'Dr.'} ${currentUser.displayName || t('consult.anonymousDoctor')} ${t('consultDetail.replyNotifMsg')} "${consult.title}"`,
                    consultId: id,
                    isRead: false,
                    createdAt: serverTimestamp(),
                });
            }

            setNewReply('');
        } catch (error) {
            console.error("Lỗi gửi tư vấn:", error);
            toast.error(t('consult.createError'));
        } finally {
            setSubmitting(false);
        }
    };

    const confirmTermsAndSend = () => {
        setAgreedToTerms(true);
        setShowWarningModal(false);
        handleSendReply();
    };

    if (loading) {
        return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>;
    }

    if (!consult) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)' }}>
                <AlertTriangle size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                <h3>{t('consultDetail.notFound')}</h3>
                <p>{t('consultDetail.notFoundDesc')}</p>
                <Link to="/consult" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-flex' }}>{t('consultDetail.backToForum')}</Link>
            </div>
        );
    }

    return (
        <div className="forum-page">
            <Link to="/consult" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.9rem', alignSelf: 'flex-start', padding: '0.5rem 0', textDecoration: 'none' }}>
                <ArrowLeft size={16} /> {t('consultDetail.backToForum')}
            </Link>

            {/* Original Post */}
            <div className="card animate-slide-up" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem 1.5rem 1rem 1.5rem', background: 'var(--color-surface-raised)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div className="forum-avatar-lg">
                                {consult.authorAvatar ? (
                                    <img src={consult.authorAvatar} alt="Avatar" />
                                ) : (
                                    <User size={24} color="var(--color-text-muted)" />
                                )}
                            </div>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                    {locale === 'vi' ? 'Bs.' : 'Dr.'} {consult.authorName}
                                </h4>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Clock size={12} /> {consult.createdAt ? formatDistanceToNow(consult.createdAt.toDate(), { addSuffix: true, locale: locale === 'vi' ? vi : enUS }) : t('common.justNow')}
                                    {consult.authorAttr && (
                                        <>
                                            <span>•</span>
                                            <span>{consult.authorAttr}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ padding: '1.5rem' }}>
                    <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '1rem', lineHeight: 1.35 }}>
                        {consult.title}
                    </h1>
                    <div style={{
                        fontSize: '0.95rem',
                        color: 'var(--color-text)',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        background: 'rgba(14, 165, 233, 0.05)',
                        padding: '1.25rem',
                        borderRadius: 'var(--radius-md)',
                        borderLeft: '4px solid var(--color-primary)'
                    }}>
                        {consult.content}
                    </div>

                    {consult.patientSnapshot && (
                        <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-warning)', fontWeight: 700, marginBottom: '1rem', fontSize: '1.05rem' }}>
                                <Paperclip size={18} /> {t('consultDetail.attachedRecord')}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', fontSize: '0.9rem', color: 'var(--color-text)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                    <div style={{ background: 'var(--color-surface-raised)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                                        <strong style={{ display: 'block', color: 'var(--color-text-muted)', marginBottom: '0.4rem', fontSize: '0.8rem', textTransform: 'uppercase' }}>{t('consultDetail.basicInfo')}</strong>
                                        <div>{t('consultDetail.recordId')}: {consult.patientSnapshot.id}</div>
                                        <div>{t('consultDetail.registered')}: {consult.patientSnapshot.createdAt ? format(new Date(consult.patientSnapshot.createdAt), 'dd/MM/yyyy HH:mm') : 'N/A'}</div>
                                    </div>
                                    <div style={{ background: 'var(--color-surface-raised)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                                        <strong style={{ display: 'block', color: 'var(--color-text-muted)', marginBottom: '0.4rem', fontSize: '0.8rem', textTransform: 'uppercase' }}>{t('consultDetail.initialClassification')}</strong>
                                        <div style={{ color: consult.patientSnapshot.evaluationResult === 'ĐỎ' ? 'var(--color-danger)' : consult.patientSnapshot.evaluationResult === 'VÀNG' ? 'var(--color-warning)' : 'var(--color-success)', fontWeight: 600 }}>
                                            {t('consultDetail.resultLabel')}: {locale === 'vi' ? 'Nhóm' : 'Group'} {consult.patientSnapshot.evaluationResult || t('consultDetail.notEvaluated')}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ background: 'var(--color-surface-raised)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                                    <strong style={{ display: 'block', color: 'var(--color-text-muted)', marginBottom: '0.4rem', fontSize: '0.8rem', textTransform: 'uppercase' }}>{t('consultDetail.clinicalSigns')}</strong>
                                    <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                                        {Object.entries(consult.patientSnapshot.maternalFactors || {}).filter(([_, v]) => v).map(([k]) => <li key={k}>{k.replace(/([A-Z])/g, ' $1').toLowerCase()} (Từ Mẹ)</li>)}
                                        {Object.entries(consult.patientSnapshot.clinicalSigns || {}).filter(([_, v]) => v).map(([k]) => <li key={k}>{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</li>)}
                                        {Object.keys(consult.patientSnapshot.maternalFactors || {}).filter(k => consult.patientSnapshot.maternalFactors[k]).length === 0 &&
                                            Object.keys(consult.patientSnapshot.clinicalSigns || {}).filter(k => consult.patientSnapshot.clinicalSigns[k]).length === 0 &&
                                            <li>{t('consultDetail.noSpecialFactors')}</li>}
                                    </ul>
                                </div>

                                <div style={{ background: 'var(--color-surface-raised)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                                    <strong style={{ display: 'block', color: 'var(--color-text-muted)', marginBottom: '0.4rem', fontSize: '0.8rem', textTransform: 'uppercase' }}>{t('consultDetail.labAndAbx')}</strong>
                                    <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                                        {Object.entries(consult.patientSnapshot.labResults || {}).filter(([_, v]) => v).map(([k]) => <li key={k}>{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</li>)}
                                        {consult.patientSnapshot.diagnosis && <li>{t('consultDetail.currentDiagnosis')}: {consult.patientSnapshot.diagnosis}</li>}
                                        {consult.patientSnapshot.treatment && <li>{t('consultDetail.treatmentDirection')}: {consult.patientSnapshot.treatment}</li>}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Replies List */}
            <div className="reply-thread">
                {replies.length > 0 ? (
                    <div className="section-header" style={{ color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                        <MessageSquare size={16} /> {t('consultDetail.commentsSection')} ({replies.length})
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)' }}>
                        <p>{t('consultDetail.noReplies')}</p>
                    </div>
                )}

                {replies.map(r => (
                    <div key={r.id} className="card animate-slide-up" style={{ padding: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                            <div className="forum-avatar" style={{ width: '36px', height: '36px', marginTop: '0.2rem' }}>
                                {r.authorAvatar ? (
                                    <img src={r.authorAvatar} alt="Avatar" />
                                ) : (
                                    <User size={18} color="var(--color-text-muted)" />
                                )}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                                    <strong style={{ fontSize: '1rem', color: 'var(--color-primary)' }}>{locale === 'vi' ? 'Bs.' : 'Dr.'} {r.authorName}</strong>
                                    {r.authorAttr && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'var(--color-surface-raised)', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>{r.authorAttr}</span>}
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <Clock size={12} /> {r.createdAt ? formatDistanceToNow(r.createdAt.toDate(), { addSuffix: true, locale: locale === 'vi' ? vi : enUS }) : t('common.justNow')}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.95rem', color: 'var(--color-text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                    {r.content}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Reply Input */}
            <div className="sticky-reply">
                <div className="card animate-slide-up" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)' }}>
                    <div style={{ position: 'relative' }}>
                        <textarea
                            className="input-field"
                            placeholder={t('consultDetail.replyPlaceholder')}
                            style={{ minHeight: '80px', maxHeight: '200px', resize: 'vertical', paddingRight: '3rem', whiteSpace: 'pre-wrap' }}
                            value={newReply}
                            onChange={(e) => setNewReply(e.target.value)}
                        />
                        <button
                            className="btn btn-primary"
                            style={{ position: 'absolute', bottom: '10px', right: '10px', width: '36px', height: '36px', borderRadius: '50%', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={handleSendReply}
                            disabled={submitting || !newReply.trim()}
                        >
                            <Send size={16} style={{ marginLeft: '-2px' }} />
                        </button>
                    </div>
                    {!agreedToTerms && newReply.trim().length > 0 && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <AlertTriangle size={14} /> {t('consultDetail.replyDisclaimer')}
                        </div>
                    )}
                </div>
            </div>

            {/* Warning Modal */}
            {showWarningModal && (
                <div className="modal-overlay">
                    <div className="card animate-slide-up modal-content">
                        <h3 style={{ fontSize: '1.2rem', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                            <AlertTriangle size={24} /> {t('consultDetail.confirmPost')}
                        </h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--color-text)', lineHeight: 1.5, margin: 0 }}>
                            {t('consultDetail.confirmPostDesc')}
                            <br /><br />
                            {t('consultDetail.finalResponsibility')}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                            <button className="btn" onClick={() => setShowWarningModal(false)}>{t('common.cancel')}</button>
                            <button className="btn btn-primary" onClick={confirmTermsAndSend}>{t('consultDetail.agreeAndPost')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
