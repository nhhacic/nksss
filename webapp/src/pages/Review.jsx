import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatient } from '../context/PatientContext';
import { useTranslation } from '../i18n/LanguageContext';
import { ClipboardCheck, Tag, X } from 'lucide-react';
import { savePatient } from '../lib/storage';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { format } from 'date-fns';

const SUGGESTED_TAGS = ['sinh non', 'đủ tháng', 'GBS+', 'viêm màng não', 'kháng thuốc', 'sốc NK', 'thở máy', 'bệnh não'];

export default function Review() {
    const navigate = useNavigate();
    const { patient, updatePatient, resetPatient } = usePatient();
    const { currentUser } = useAuth();
    const toast = useToast();
    const { t } = useTranslation();
    const [tags, setTags] = useState(patient.tags || []);
    const [tagInput, setTagInput] = useState('');

    const addTag = (tag) => {
        const t = tag.trim().toLowerCase();
        if (t && !tags.includes(t)) {
            setTags([...tags, t]);
        }
        setTagInput('');
    };

    const removeTag = (tag) => {
        setTags(tags.filter(t => t !== tag));
    };

    const handleSave = async () => {
        try {
            const patientWithTags = { ...patient, tags };
            updatePatient({ tags });
            await savePatient(patientWithTags);

            // Create system notification
            if (currentUser) {
                await addDoc(collection(db, 'notifications'), {
                    userId: currentUser.uid,
                    type: 'system_alert',
                    title: 'Hồ sơ mới được lưu trữ',
                    message: `Hồ sơ bệnh nhân sơ sinh ${patient.id} đã được lưu. Định kỳ 24h hệ thống sẽ nhắc tái khám.`,
                    patientId: patient.id,
                    isRead: false,
                    createdAt: serverTimestamp(),
                });
            }

            toast.success(t('review.savedSuccess'));
            resetPatient();
            setTimeout(() => navigate('/'), 500);
        } catch (error) {
            toast.error(t('login.errorGeneral') + ': ' + error.message);
        }
    };

    return (
        <div className="card">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)' }}>
                <ClipboardCheck size={24} />
                {t('review.title')}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--color-background)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>{t('review.patientId')}:</span>
                    <strong>{patient.id}</strong>

                    <span style={{ color: 'var(--color-text-muted)' }}>{t('review.admTime')}:</span>
                    <strong>{patient.admissionTime ? format(new Date(patient.admissionTime), 'HH:mm dd/MM/yyyy') : 'N/A'}</strong>

                    <span style={{ color: 'var(--color-text-muted)' }}>{t('review.patientInfo')}:</span>
                    <strong>{patient.weight}g, {patient.gestationalAge} {t('common.weeks')} ({patient.ageDays} {t('calculator.days')})</strong>
                </div>

                <div>
                    <strong style={{ color: 'var(--color-warning)' }}>{t('review.clinicalSigns')}:</strong>
                    <ul style={{ paddingLeft: '1.5rem', margin: '0.5rem 0', color: 'var(--color-text)' }}>
                        {patient.warningSigns?.map((w, i) => <li key={i}>{w}</li>)}
                        {patient.riskFactors?.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                </div>

                <div>
                    <strong style={{ color: 'var(--color-primary)' }}>{t('review.treatmentPlan')}:</strong>
                    <div style={{ padding: '0.5rem', background: 'rgba(14, 165, 233, 0.1)', borderRadius: 'var(--radius-sm)', marginTop: '0.5rem' }}>
                        {patient.antibioticGroup?.label}<br />
                        <small>({patient.antibioticGroup?.rec})</small>
                    </div>
                </div>

                {patient.doses?.length > 0 && (
                    <div>
                        <strong style={{ color: 'var(--color-success)' }}>{t('review.drugOrders')}:</strong>
                        {patient.doses.map((d, i) => (
                            <div key={i} style={{ background: 'var(--color-surface)', padding: '0.5rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 'bold' }}>{d.med}</span>
                                <span><span style={{ fontSize: '1.2rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>{d.totalDose} mg</span> / {d.interval}h</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* === TAG SECTION (NEW) === */}
            <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--color-primary)' }}>
                    <Tag size={16} /> {t('review.tagSection')}
                </h3>

                {/* Suggested tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
                    {SUGGESTED_TAGS.filter(t => !tags.includes(t)).map(tag => (
                        <button
                            key={tag}
                            onClick={() => addTag(tag)}
                            style={{
                                padding: '0.2rem 0.6rem',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                background: 'var(--color-surface-raised)',
                                border: '1px solid var(--color-border)',
                                borderRadius: '999px',
                                cursor: 'pointer',
                                color: 'var(--color-text-muted)',
                                fontFamily: 'var(--font-sans)',
                            }}
                        >
                            + {tag}
                        </button>
                    ))}
                </div>

                {/* Custom tag input */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                        type="text"
                        className="input-field"
                        placeholder={t('review.customTag')}
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }}
                        style={{ flex: 1, padding: '0.4rem 0.75rem', fontSize: '0.88rem' }}
                    />
                    <button className="btn btn-secondary" onClick={() => addTag(tagInput)} disabled={!tagInput.trim()}
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
                        {t('review.addTag')}
                    </button>
                </div>

                {/* Current tags */}
                {tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.75rem' }}>
                        {tags.map(tag => (
                            <span key={tag} style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                padding: '0.2rem 0.6rem',
                                fontSize: '0.8rem', fontWeight: 600,
                                background: 'rgba(14,165,233,0.1)',
                                color: 'var(--color-primary)',
                                borderRadius: '999px',
                                border: '1px solid rgba(14,165,233,0.25)',
                            }}>
                                #{tag}
                                <button onClick={() => removeTag(tag)} style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--color-text-muted)', padding: '0', display: 'flex',
                                }}>
                                    <X size={12} />
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                <button className="btn btn-secondary" onClick={() => navigate(-1)}>
                    &larr; {t('review.backToEdit')}
                </button>
                <button className="btn btn-primary" onClick={handleSave} style={{ alignSelf: 'flex-end', background: 'var(--color-success)' }}>
                    {t('review.saveRecord')}
                </button>
            </div>
        </div>
    );
}
