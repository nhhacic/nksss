import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, PlusCircle, AlertTriangle, User, Clock, CheckCircle2, Search, ChevronRight, Paperclip } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n/LanguageContext';
import { useToast } from '../components/Toast';
import { getPatients } from '../lib/storage';
import { formatDistanceToNow } from 'date-fns';
import { vi, enUS } from 'date-fns/locale';

export default function Consult() {
    const [consults, setConsults] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const { currentUser } = useAuth();
    const { t, locale } = useTranslation();
    const toast = useToast();
    const [userProfile, setUserProfile] = useState(null);
    const [myPatients, setMyPatients] = useState([]);
    const [selectedPatientId, setSelectedPatientId] = useState('');

    // Fetch user profile logic and patients
    useEffect(() => {
        const fetchProfile = async () => {
            if (!currentUser) return;
            const docRef = doc(db, 'users', currentUser.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setUserProfile(docSnap.data());
            }

            // Load patients for attachment
            const pts = await getPatients();
            setMyPatients(pts);
        };
        fetchProfile();
    }, [currentUser]);

    // Load consults
    useEffect(() => {
        const q = query(collection(db, 'consults'), orderBy('updatedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = [];
            snapshot.forEach((doc) => {
                list.push({ id: doc.id, ...doc.data() });
            });
            setConsults(list);
        });
        return unsubscribe;
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!agreedToTerms) return toast.warning(t('consult.agreeFirst'));
        if (!title.trim() || !content.trim()) return toast.warning(t('consult.fillRequired'));

        setSubmitting(true);
        try {
            const authorAttr = (userProfile?.department ? `${userProfile.department} - ` : '') + (userProfile?.hospital || '');

            // Build patient snapshot if attached
            let patientSnapshot = null;
            if (selectedPatientId) {
                const pt = myPatients.find(p => p.id === selectedPatientId);
                if (pt) {
                    patientSnapshot = {
                        id: pt.id,
                        createdAt: pt.createdAt,
                        maternalFactors: pt.maternalFactors || {},
                        clinicalSigns: pt.clinicalSigns || {},
                        labResults: pt.labResults || {},
                        evaluationResult: pt.evaluationResult || null,
                        recommendation: pt.recommendation || null,
                        diagnosis: pt.diagnosis || null,
                        treatment: pt.treatment || null,
                    };
                }
            }

            await addDoc(collection(db, 'consults'), {
                title: title.trim(),
                content: content.trim(),
                patientSnapshot,
                authorId: currentUser.uid,
                authorName: currentUser.displayName || t('consult.anonymousDoctor'),
                authorAvatar: currentUser.photoURL || '',
                authorAttr: authorAttr,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                replyCount: 0,
                isClosed: false,
            });
            setIsCreating(false);
            setTitle('');
            setContent('');
            setAgreedToTerms(false);
            setSelectedPatientId('');
        } catch (error) {
            console.error("Lỗi khi tạo ca hội chẩn:", error);
            toast.error(t('consult.createError'));
        } finally {
            setSubmitting(false);
        }
    };

    const filteredConsults = consults.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.authorName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="forum-page">
            <div className="forum-hero">
                <div className="forum-hero-inner">
                    <div className="forum-hero-row">
                        <div>
                            <h1 className="forum-title">
                                <MessageSquare size={24} /> {t('consult.title')}
                            </h1>
                            <p className="forum-subtitle">
                                {t('consult.subtitle')}
                            </p>
                        </div>
                        <button
                            className="btn btn-primary"
                            style={{ borderRadius: '999px', padding: '0.6rem 1.25rem' }}
                            onClick={() => setIsCreating(true)}
                        >
                            <PlusCircle size={18} /> {t('consult.newPost')}
                        </button>
                    </div>
                </div>
            </div>

            {isCreating && (
                <div className="card animate-slide-down">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 className="card-title">{t('consult.createTitle')}</h2>
                        <button className="btn btn-secondary" onClick={() => setIsCreating(false)} style={{ padding: '0.4rem 0.75rem' }}>{t('common.close')}</button>
                    </div>

                    <div style={{
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1rem',
                        marginBottom: '1.5rem',
                        color: 'var(--color-warning)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                            <AlertTriangle size={18} /> {t('consult.legalWarning')}
                        </div>
                        <ul style={{ fontSize: '0.85rem', paddingLeft: '1.5rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem', fontWeight: 500 }}>
                            <li>{t('consult.legal1')}</li>
                            <li>{t('consult.legal2')}</li>
                            <li>{t('consult.legal3')}</li>
                            <li>{t('consult.legal4')}</li>
                        </ul>
                    </div>

                    <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="input-group">
                            <label className="input-label">{t('consult.postTitle')}</label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="VD: Trẻ sinh non 32 tuần viêm phổi nặng kháng kháng sinh"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">{t('consult.postContent')}</label>
                            <textarea
                                className="input-field"
                                placeholder="Mô tả chi tiết triệu chứng, quá trình điều trị, các kết quả xét nghiệm đã có và câu hỏi cần tư vấn..."
                                style={{ minHeight: '180px', resize: 'vertical' }}
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                required
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Paperclip size={14} /> {t('consult.attachRecord')}
                            </label>
                            <select
                                className="input-field"
                                value={selectedPatientId}
                                onChange={(e) => setSelectedPatientId(e.target.value)}
                            >
                                <option value="">{t('consult.noAttach')}</option>
                                {myPatients.map(pt => (
                                    <option key={pt.id} value={pt.id}>
                                        {t('consult.caseLabel')} {pt.id} ({formatDistanceToNow(new Date(pt.createdAt), { locale: locale === 'vi' ? vi : enUS, addSuffix: true })})
                                    </option>
                                ))}
                            </select>
                            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.4rem' }}>
                                {t('consult.attachNote')}
                            </p>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', marginTop: '0.5rem', background: 'var(--color-surface-raised)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                            <input
                                type="checkbox"
                                style={{ marginTop: '0.2rem', width: '18px', height: '18px', accentColor: 'var(--color-primary)' }}
                                checked={agreedToTerms}
                                onChange={(e) => setAgreedToTerms(e.target.checked)}
                            />
                            <span style={{ fontSize: '0.9rem', color: 'var(--color-text)', fontWeight: 500, lineHeight: 1.4 }}>
                                {t('consult.agreeTerms')}
                            </span>
                        </label>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                            <button type="submit" className="btn btn-primary" disabled={submitting || !agreedToTerms}>
                                <PlusCircle size={18} /> {submitting ? t('common.saving') : t('consult.postBtn')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="search-bar">
                <Search size={18} color="var(--color-text-muted)" />
                <input
                    type="text"
                    placeholder={t('consult.searchPlaceholder')}

                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="forum-list">
                {filteredConsults.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)' }}>
                        <MessageSquare size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                        <p>{t('consult.noConsults')}</p>
                    </div>
                ) : (
                    filteredConsults.map(c => (
                        <Link to={`/consult/${c.id}`} key={c.id} className="card action-card forum-card">
                            <div className="forum-avatar">
                                {c.authorAvatar ? (
                                    <img src={c.authorAvatar} alt="Avatar" />
                                ) : (
                                    <User size={20} color="var(--color-text-muted)" />
                                )}
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.4rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, lineHeight: 1.3 }}>
                                        {c.title}
                                    </h3>
                                    {c.isClosed && (
                                        <span className="status-badge status-badge-success">
                                            <CheckCircle2 size={12} /> {t('consult.closed')}
                                        </span>
                                    )}
                                </div>
                                <p className="forum-content-preview">
                                    {c.content}
                                </p>
                                {c.patientSnapshot && (
                                    <div className="attachment-badge">
                                        <Paperclip size={12} /> {t('consult.hasAttachment')}
                                    </div>
                                )}
                                <div className="forum-meta">
                                    <span className="forum-meta-item" style={{ color: 'var(--color-primary)' }}>
                                        {locale === 'vi' ? 'Bs.' : 'Dr.'} {c.authorName}
                                    </span>
                                    <span className="forum-meta-item">
                                        <Clock size={14} />
                                        {c.createdAt ? formatDistanceToNow(c.createdAt.toDate(), { addSuffix: true, locale: locale === 'vi' ? vi : enUS }) : t('common.justNow')}
                                    </span>
                                    <span className="forum-meta-item" style={{ background: c.replyCount > 0 ? 'rgba(14, 165, 233, 0.1)' : 'transparent', color: c.replyCount > 0 ? 'var(--color-primary)' : 'inherit', padding: c.replyCount > 0 ? '0.1rem 0.5rem' : 0, borderRadius: '999px' }}>
                                        <MessageSquare size={14} /> {c.replyCount} {t('consult.reply')}
                                    </span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--color-border)', flexShrink: 0 }}>
                                <ChevronRight size={24} />
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
}
