import { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, AlertTriangle, FileDown, RefreshCw, Upload, X, Send, Beaker, Pill, History, ZoomIn, ZoomOut, Maximize2, Lightbulb } from 'lucide-react';
import { db, storage } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../context/AuthContext';
import { usePatient } from '../context/PatientContext';
import { useTranslation } from '../i18n/LanguageContext';
import { useToast } from '../components/Toast';
import { addTimelineEvent, deleteStorageFile, transferPatient } from '../lib/storage';
import { checkDoseAdjustmentNeeded, getRecommendedDuration } from '../lib/patientUtils';
import { differenceInHours, differenceInDays, format, formatDistanceToNow } from 'date-fns';
import { vi, enUS } from 'date-fns/locale';

export default function ReEvaluation() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { updatePatient: setGlobalPatient } = usePatient();
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [evaluationResult, setEvaluationResult] = useState('');
    const [evaluationNote, setEvaluationNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [images, setImages] = useState([]);
    const [uploading, setUploading] = useState(false);

    // Paraclinical images (X-ray, ultrasound...)
    const [paraclinicalImages, setParaclinicalImages] = useState([]);

    // Image viewer
    const [viewerImage, setViewerImage] = useState(null);
    const [viewerZoom, setViewerZoom] = useState(1);
    const [viewerPan, setViewerPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [uploadingParaclinical, setUploadingParaclinical] = useState(false);

    // Transfer
    const [showTransfer, setShowTransfer] = useState(false);
    const [transferEmail, setTransferEmail] = useState('');
    const [transferNote, setTransferNote] = useState('');
    const [transferring, setTransferring] = useState(false);

    // Lab tracking
    const [showLabForm, setShowLabForm] = useState(false);
    const [labData, setLabData] = useState({
        crp1: '', crp1Level: '', crp2: '', crp2Level: '',
        cultureResult: '', cultureGram: '',
        antibiogram: [],
    });
    const [savingLab, setSavingLab] = useState(false);

    const { currentUser } = useAuth();
    const { t, locale } = useTranslation();
    const toast = useToast();

    useEffect(() => {
        const loadPatient = async () => {
            try {
                const docRef = doc(db, 'patients', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = { id: docSnap.id, ...docSnap.data() };
                    setPatient(data);
                    setImages(data.clinicalImages || []);
                    setParaclinicalImages(data.paraclinicalImages || []);
                    if (data.evaluationResult) setEvaluationResult(data.evaluationResult);
                    if (data.evaluationNote) setEvaluationNote(data.evaluationNote);
                    if (data.labData) setLabData(prev => ({ ...prev, ...data.labData }));
                }
            } catch (error) {
                console.error('Error loading patient:', error);
            } finally {
                setLoading(false);
            }
        };
        loadPatient();
    }, [id]);

    // Dose adjustment alerts
    const doseAlerts = useMemo(() => {
        if (!patient) return [];
        const ageDays = patient.dob ? differenceInDays(new Date(), new Date(patient.dob)) : (patient.ageDays || 0);
        return checkDoseAdjustmentNeeded({ ...patient, ageDays });
    }, [patient]);

    // Recommended antibiotic duration
    const durationRecommendation = useMemo(() => {
        if (!patient) return null;
        return getRecommendedDuration({ ...patient, labData });
    }, [patient, labData]);

    // Protocol suggestion based on evaluation result
    const protocolSuggestion = useMemo(() => {
        if (!evaluationResult || !patient) return null;

        const groupId = patient.antibioticGroup?.id;

        switch (evaluationResult) {
            case 'ĐỎ':
                if (!groupId) return t('reeval.addAntibiotic');
                if (groupId === 1) return t('reeval.escalateToGroup2or3');
                if (groupId === 2 || groupId === 4) return t('reeval.escalateToGroup3');
                if (groupId === 3 || groupId === 5) return t('reeval.consultSpecialist');
                return t('reeval.addAntibiotic');
            case 'VÀNG':
                return t('reeval.continueProtocol');
            case 'XANH':
                return t('reeval.deescalate');
            case 'XUẤT VIỆN':
                return t('reeval.dischargeSuggestion');
            default:
                return null;
        }
    }, [evaluationResult, patient, t]);

    const hours = patient ? differenceInHours(new Date(), new Date(patient.admissionTime || patient.createdAt)) : 0;
    const isOverdue = patient && !patient.evaluationResult && hours >= 24;

    // ── Image Upload ──────────────────────────────────────
    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return toast.error(t('reeval.invalidImageFile'));
        if (file.size > 5 * 1024 * 1024) return toast.error(t('reeval.imageTooLarge'));

        setUploading(true);
        try {
            const fileRef = ref(storage, `clinical_images/${currentUser.uid}/${id}/${Date.now()}_${file.name}`);
            await uploadBytes(fileRef, file);
            const downloadUrl = await getDownloadURL(fileRef);
            const updatedImages = [...images, downloadUrl];
            setImages(updatedImages);

            await setDoc(doc(db, 'patients', id), { clinicalImages: updatedImages, updatedAt: new Date().toISOString() }, { merge: true });
            toast.success(t('reeval.imageUploaded'));
        } catch (error) {
            console.error('Image upload error:', error);
            toast.error(t('reeval.imageUploadError'));
        } finally {
            setUploading(false);
            e.target.value = null;
        }
    };

    const removeImage = async (index) => {
        if (!window.confirm(t('reeval.confirmDeleteImage'))) return;
        const urlToDelete = images[index];
        const updatedImages = images.filter((_, i) => i !== index);
        setImages(updatedImages);

        await deleteStorageFile(urlToDelete);
        await setDoc(doc(db, 'patients', id), { clinicalImages: updatedImages, updatedAt: new Date().toISOString() }, { merge: true });
    };

    // ── Paraclinical Image Upload ──────────────────────────────
    const handleParaclinicalUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return toast.error(t('reeval.invalidImageFile'));
        if (file.size > 5 * 1024 * 1024) return toast.error(t('reeval.imageTooLarge'));

        setUploadingParaclinical(true);
        try {
            const fileRef = ref(storage, `clinical_images/${currentUser.uid}/paraclinical/${id}/${Date.now()}_${file.name}`);
            await uploadBytes(fileRef, file);
            const downloadUrl = await getDownloadURL(fileRef);
            const updated = [...paraclinicalImages, downloadUrl];
            setParaclinicalImages(updated);

            await setDoc(doc(db, 'patients', id), { paraclinicalImages: updated, updatedAt: new Date().toISOString() }, { merge: true });
            toast.success(t('reeval.imageUploaded'));
        } catch (error) {
            console.error('Paraclinical image upload error:', error);
            toast.error(t('reeval.imageUploadError'));
        } finally {
            setUploadingParaclinical(false);
            e.target.value = null;
        }
    };

    const removeParaclinicalImage = async (index) => {
        if (!window.confirm(t('reeval.confirmDeleteImage'))) return;
        const urlToDelete = paraclinicalImages[index];
        const updated = paraclinicalImages.filter((_, i) => i !== index);
        setParaclinicalImages(updated);

        await deleteStorageFile(urlToDelete);
        await setDoc(doc(db, 'patients', id), { paraclinicalImages: updated, updatedAt: new Date().toISOString() }, { merge: true });
    };

    // ── Image Viewer ──────────────────────────────────────────
    const openViewer = (url) => {
        setViewerImage(url);
        setViewerZoom(1);
        setViewerPan({ x: 0, y: 0 });
    };
    const closeViewer = () => setViewerImage(null);
    const handleViewerMouseDown = (e) => {
        if (viewerZoom <= 1) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - viewerPan.x, y: e.clientY - viewerPan.y });
    };
    const handleViewerMouseMove = (e) => {
        if (!isDragging) return;
        setViewerPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    };
    const handleViewerMouseUp = () => setIsDragging(false);
    const handleViewerTouchStart = (e) => {
        if (viewerZoom <= 1 || e.touches.length !== 1) return;
        setIsDragging(true);
        setDragStart({ x: e.touches[0].clientX - viewerPan.x, y: e.touches[0].clientY - viewerPan.y });
    };
    const handleViewerTouchMove = (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        e.preventDefault();
        setViewerPan({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
    };
    const handleViewerTouchEnd = () => setIsDragging(false);

    // ── Save Evaluation ────────────────────────────────────
    const handleSaveEvaluation = async () => {
        if (!evaluationResult) return toast.warning(t('reeval.selectResult'));
        setSaving(true);
        try {
            await setDoc(doc(db, 'patients', id), {
                evaluationResult,
                evaluationNote,
                evaluatedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }, { merge: true });

            await addTimelineEvent(id, {
                type: 'evaluation',
                result: evaluationResult,
                note: evaluationNote,
                by: currentUser.displayName || currentUser.email,
                at: new Date().toISOString(),
            });

            // System notification
            await addDoc(collection(db, 'notifications'), {
                userId: currentUser.uid,
                type: 'system_alert',
                title: t('reeval.title'),
                message: `${t('reeval.savedSuccess').replace('{id}', id)}`,
                patientId: id,
                isRead: false,
                createdAt: serverTimestamp(),
            });

            setPatient(prev => ({ ...prev, evaluationResult, evaluationNote }));
            toast.success(t('reeval.savedSuccess').replace('{id}', id));
            return true;
        } catch (error) {
            console.error('Save error:', error);
            toast.error(t('reeval.saveError'));
            return false;
        } finally {
            setSaving(false);
        }
    };

    // ── Change Protocol (save eval then redirect to Treatment) ──
    const handleChangeProtocol = async () => {
        const saved = await handleSaveEvaluation();
        if (!saved) return;
        // Load the full patient data into global PatientContext
        setGlobalPatient(patient);
        navigate('/treatment');
    };

    // ── Lab Data Save ──────────────────────────────────────
    const handleSaveLabData = async () => {
        setSavingLab(true);
        try {
            await setDoc(doc(db, 'patients', id), {
                labData,
                updatedAt: new Date().toISOString(),
            }, { merge: true });

            await addTimelineEvent(id, {
                type: 'lab_update',
                data: labData,
                by: currentUser.displayName || currentUser.email,
                at: new Date().toISOString(),
            });

            toast.success(t('lab.labSaved'));
        } catch (error) {
            toast.error(t('lab.labSaveError'));
        } finally {
            setSavingLab(false);
        }
    };

    // ── Transfer ───────────────────────────────────────────
    const handleTransfer = async () => {
        if (!transferEmail.trim()) return toast.warning(t('reeval.enterEmail'));
        if (transferEmail === currentUser.email) return toast.error(t('transfer.errorSelf'));

        if (!window.confirm(t('transfer.confirmMsg').replace('{id}', id).replace('{email}', transferEmail))) return;

        setTransferring(true);
        try {
            // Find doctor by email
            const usersQuery = query(collection(db, 'users'), where('email', '==', transferEmail.trim()));
            const snapshot = await getDocs(usersQuery);

            // Also check auth — in some cases users doc might not exist but auth does
            // We'll transfer even if user doc doesn't exist, using email as identifier
            let receiverUid = null;
            if (!snapshot.empty) {
                receiverUid = snapshot.docs[0].id;
            }

            // Actually transfer the patient
            await transferPatient(id, receiverUid || transferEmail, currentUser.uid);

            // Add transfer timeline event
            await addTimelineEvent(id, {
                type: 'transfer',
                from: currentUser.displayName || currentUser.email,
                fromUid: currentUser.uid,
                to: transferEmail,
                toUid: receiverUid,
                note: transferNote,
                at: new Date().toISOString(),
            });

            // Send notification to receiver (if they have an account)
            if (receiverUid) {
                await addDoc(collection(db, 'notifications'), {
                    userId: receiverUid,
                    type: 'system_alert',
                    title: t('transfer.title'),
                    message: t('transfer.successMsg').replace('{id}', id).replace('{email}', currentUser.displayName || currentUser.email),
                    isRead: false,
                    createdAt: serverTimestamp(),
                });
            }

            toast.success(t('transfer.successMsg').replace('{id}', id).replace('{email}', transferEmail));
            setShowTransfer(false);

            // Navigate home since we no longer own this patient
            setTimeout(() => window.location.href = '/', 1500);
        } catch (error) {
            console.error('Transfer error:', error);
            toast.error(t('transfer.errorGeneral'));
        } finally {
            setTransferring(false);
        }
    };

    // ── PDF Export ─────────────────────────────────────────
    const handleExportPdf = () => {
        if (!patient) return;
        const p = patient;
        const appUrl = window.location.origin;
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${t('reeval.exportPdf')} - ${p.id}</title>
        <style>body{font-family:Arial,sans-serif;padding:2rem;max-width:800px;margin:auto;color:#222}
        h1{color:#0ea5e9;border-bottom:2px solid #0ea5e9;padding-bottom:0.5rem}
        .section{margin:1.5rem 0;padding:1rem;background:#f8f9fa;border-radius:8px;border-left:4px solid #0ea5e9}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:0.5rem}
        .label{font-weight:600;color:#666}.value{font-weight:700}
        .badge{display:inline-block;padding:0.2rem 0.8rem;border-radius:12px;font-weight:700;font-size:0.9rem}
        .red{background:#fef2f2;color:#dc2626}.yellow{background:#fffbeb;color:#d97706}.green{background:#f0fdf4;color:#16a34a}
        table{width:100%;border-collapse:collapse;margin:0.5rem 0}td,th{padding:0.4rem;border:1px solid #ddd;text-align:left}
        .nav-bar{display:flex;gap:0.5rem;margin-bottom:1.5rem;padding:0.75rem 1rem;background:#f0f9ff;border-radius:8px;border:1px solid #bae6fd;align-items:center}
        .nav-btn{display:inline-flex;align-items:center;gap:0.4rem;padding:0.5rem 1rem;border-radius:6px;font-weight:600;font-size:0.9rem;text-decoration:none;cursor:pointer;border:none;font-family:Arial,sans-serif}
        .nav-btn-home{background:#0ea5e9;color:#fff}.nav-btn-home:hover{background:#0284c7}
        .nav-btn-print{background:#fff;color:#0ea5e9;border:1.5px solid #0ea5e9}.nav-btn-print:hover{background:#f0f9ff}
        @media print{body{padding:1rem}.section{break-inside:avoid}.nav-bar{display:none!important}}</style></head><body>
        <div class="nav-bar">
        <button onclick="window.close()" class="nav-btn nav-btn-home">✕ ${locale === 'vi' ? 'Đóng cửa sổ' : 'Close Window'}</button>
        <button onclick="window.print()" class="nav-btn nav-btn-print">🖨️ ${locale === 'vi' ? 'In / Lưu PDF' : 'Print / Save PDF'}</button>
        </div>
        <h1>📋 NKSSS - ${t('reeval.title')}</h1>
        <div class="section"><div class="grid">
        <div><span class="label">${t('review.patientId')}:</span> <span class="value">${p.id}</span></div>
        <div><span class="label">${t('reeval.dob')}:</span> <span class="value">${p.dob || 'N/A'}</span></div>
        <div><span class="label">${t('home.weight')}:</span> <span class="value">${p.weight}g</span></div>
        <div><span class="label">${t('home.gestationalAge')}:</span> <span class="value">${p.gestationalAge} ${t('common.weeks')}</span></div>
        <div><span class="label">${t('reeval.diagnosisLabel')}:</span> <span class="value badge ${p.diagnosis === 'A' ? 'red' : 'yellow'}">${t('dashboard.categoryA').split(' ')[0]} ${p.diagnosis}</span></div>
        <div><span class="label">${t('review.admTime')}:</span> <span class="value">${p.admissionTime || p.createdAt}</span></div>
        </div></div>
        ${p.evaluationResult ? `<div class="section"><h3>${t('reeval.evalResult')}</h3><span class="badge ${p.evaluationResult === 'ĐỎ' || p.evaluationResult === 'RED' ? 'red' : p.evaluationResult === 'VÀNG' || p.evaluationResult === 'YELLOW' ? 'yellow' : 'green'}">${p.evaluationResult}</span>${p.evaluationNote ? `<p>${p.evaluationNote}</p>` : ''}</div>` : ''}
        ${p.labData ? `<div class="section"><h3>${t('lab.title')}</h3><table><tr><th>CRP 1</th><td>${p.labData.crp1 || 'N/A'} ${p.labData.crp1Level || ''}</td></tr><tr><th>CRP 2</th><td>${p.labData.crp2 || 'N/A'} ${p.labData.crp2Level || ''}</td></tr><tr><th>${t('lab.cultureResult')}</th><td>${p.labData.cultureResult || 'N/A'}</td></tr>${p.labData.cultureGram ? `<tr><th>${t('lab.cultureGram')}</th><td>${p.labData.cultureGram}</td></tr>` : ''}</table></div>` : ''}
        ${p.doses?.length ? `<div class="section"><h3>${t('review.drugOrders')}</h3><table><tr><th>${locale === 'vi' ? 'Thuốc' : 'Drug'}</th><th>${locale === 'vi' ? 'Liều' : 'Dose'}</th><th>${locale === 'vi' ? 'Tần suất' : 'Frequency'}</th></tr>${p.doses.map(d => `<tr><td>${d.med}</td><td>${d.totalDose || d.dose || 'N/A'} mg</td><td>${d.interval ? d.interval + 'h' : d.freq || 'N/A'}</td></tr>`).join('')}</table></div>` : ''}
        <div class="section" style="font-size:0.8rem;color:#999;text-align:center">
        ${t('common.appName')} — ${format(new Date(), 'dd/MM/yyyy HH:mm')}
        </div></body></html>`;

        const w = window.open('', '_blank');
        w.document.write(html);
        w.document.close();
        w.focus();
        toast.success(t('reeval.pdfOpened'));
    };

    // ── Render ─────────────────────────────────────────────
    if (loading) return <div className="empty-state" style={{ padding: '3rem' }}>{t('common.loading')}</div>;

    if (!patient) return (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <AlertTriangle size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
            <h3>{t('reeval.noPatientFound')}</h3>
            <p>{t('reeval.patientNotFound').replace('{id}', id)}</p>
            <Link to="/" className="btn btn-primary" style={{ marginTop: '1rem' }}>{t('reeval.backHome')}</Link>
        </div>
    );

    const p = patient;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '3rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <Link to="/" className="btn btn-secondary btn-sm"><ArrowLeft size={14} /> {t('reeval.backHome')}</Link>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-sm" onClick={handleExportPdf} style={{ background: 'rgba(14,165,233,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(14,165,233,0.3)' }}>
                        <FileDown size={14} /> {t('reeval.exportPdf')}
                    </button>
                    <button className="btn btn-sm" onClick={() => setShowTransfer(!showTransfer)} style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--color-warning)', border: '1px solid rgba(245,158,11,0.3)' }}>
                        <Send size={14} /> {t('reeval.transfer')}
                    </button>
                </div>
            </div>

            {/* Dose Alerts */}
            {doseAlerts.length > 0 && (
                <div className="card animate-slide-up" style={{ borderColor: 'var(--color-danger)', background: 'rgba(239,68,68,0.05)' }}>
                    <h3 style={{ color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.75rem' }}>
                        <Pill size={18} /> {t('doseAlert.title')}
                    </h3>
                    {doseAlerts.map((a, i) => (
                        <div key={i} style={{ padding: '0.5rem', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
                            ⚠️ {t('doseAlert.checkDose').replace('{drug}', a.drug).replace('{threshold}', a.threshold)}
                        </div>
                    ))}
                </div>
            )}

            {/* Duration Recommendation */}
            {durationRecommendation && (
                <div className="card animate-slide-up" style={{ borderColor: 'var(--color-primary)', background: 'rgba(14,165,233,0.05)' }}>
                    <h4 style={{ color: 'var(--color-primary)', margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Clock size={16} /> {t('doseAlert.durationRecommend')}
                    </h4>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {t('doseAlert.durationDays').replace('{days}', durationRecommendation.days)}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>
                        {t('doseAlert.reason')}: {durationRecommendation.reason}
                    </div>
                </div>
            )}

            {/* Patient Info Card */}
            <div className="card animate-slide-up">
                <h3 className="section-title" style={{ margin: '0 0 1rem' }}>{t('reeval.patientInfo')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
                    <div><span className="text-sm text-muted">{t('review.patientId')}</span><div className="fw-700 text-lg">{p.id}</div></div>
                    <div><span className="text-sm text-muted">{t('reeval.dob')}</span><div className="fw-600">{p.dob || 'N/A'}</div></div>
                    <div><span className="text-sm text-muted">{t('home.weight')}</span><div className="fw-600">{p.weight}g</div></div>
                    <div><span className="text-sm text-muted">{t('home.gestationalAge')}</span><div className="fw-600">{p.gestationalAge} {t('common.weeks')}</div></div>
                    <div>
                        <span className="text-sm text-muted">{t('reeval.diagnosisLabel')}</span>
                        <div className="fw-700" style={{ color: p.diagnosis === 'A' ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                            {t(`dashboard.category${p.diagnosis}`)}
                        </div>
                    </div>
                    <div>
                        <span className="text-sm text-muted">{t('reeval.admittedAgo')}</span>
                        <div className={`fw-600 ${isOverdue ? 'text-danger' : ''}`}>
                            {hours}h {isOverdue && `⚠️ ${t('reeval.overdue')}`}
                        </div>
                    </div>
                </div>

                {/* Drug Orders (if category A) */}
                {p.doses?.length > 0 && (
                    <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--color-surface-raised)', borderRadius: 'var(--radius-md)' }}>
                        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: 'var(--color-primary)' }}>{t('review.drugOrders')}</h4>
                        {p.doses.map((d, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: i < p.doses.length - 1 ? '1px solid var(--color-border)' : 'none', fontSize: '0.88rem' }}>
                                <span className="fw-600">{d.med}</span>
                                <span className="text-muted">{d.totalDose || d.dose} mg — {d.interval ? `${d.interval}h` : d.freq} — {d.route || 'IV'}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Transfer Modal */}
            {showTransfer && (
                <div className="card animate-slide-down" style={{ borderColor: 'var(--color-warning)' }}>
                    <h3 style={{ color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem' }}>
                        <Send size={18} /> {t('transfer.title')}
                    </h3>
                    <div className="input-group">
                        <label className="input-label">{t('transfer.emailLabel')}</label>
                        <input type="email" className="input-field" placeholder={t('transfer.emailPlaceholder')} value={transferEmail} onChange={e => setTransferEmail(e.target.value)} />
                    </div>
                    <div className="input-group">
                        <label className="input-label">{t('transfer.noteLabel')}</label>
                        <textarea className="input-field" placeholder={t('transfer.notePlaceholder')} value={transferNote} onChange={e => setTransferNote(e.target.value)} style={{ minHeight: '60px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowTransfer(false)}>{t('common.cancel')}</button>
                        <button className="btn btn-primary btn-sm" onClick={handleTransfer} disabled={transferring}>
                            <Send size={14} /> {transferring ? t('reeval.processing') : t('transfer.submitBtn')}
                        </button>
                    </div>
                </div>
            )}

            {/* Lab Tracking Section */}
            <div className="card animate-slide-up">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showLabForm ? '1rem' : 0 }}>
                    <h3 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Beaker size={18} color="var(--color-primary)" /> {t('lab.title')}
                    </h3>
                    <button className="btn btn-sm" onClick={() => setShowLabForm(!showLabForm)} style={{ background: 'rgba(14,165,233,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(14,165,233,0.2)' }}>
                        {showLabForm ? t('common.close') : t('common.edit')}
                    </button>
                </div>

                {/* Lab summary (always visible) */}
                {(labData.crp1 || labData.cultureResult) && !showLabForm && (
                    <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
                        {labData.crp1 && (
                            <div style={{ padding: '0.5rem', background: 'var(--color-surface-raised)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                                <div className="text-muted text-sm">{t('lab.crpTime1')}</div>
                                <div className="fw-700" style={{ color: parseFloat(labData.crp1) >= 10 ? 'var(--color-danger)' : 'var(--color-success)' }}>{labData.crp1} mg/L</div>
                            </div>
                        )}
                        {labData.crp2 && (
                            <div style={{ padding: '0.5rem', background: 'var(--color-surface-raised)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                                <div className="text-muted text-sm">{t('lab.crpTime2')}</div>
                                <div className="fw-700" style={{ color: parseFloat(labData.crp2) >= 10 ? 'var(--color-danger)' : 'var(--color-success)' }}>{labData.crp2} mg/L</div>
                            </div>
                        )}
                        {labData.cultureResult && (
                            <div style={{ padding: '0.5rem', background: 'var(--color-surface-raised)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                                <div className="text-muted text-sm">{t('lab.cultureResult')}</div>
                                <div className="fw-700" style={{ color: labData.cultureResult === 'positive' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                    {labData.cultureResult === 'positive' ? t('lab.culturePositive') : labData.cultureResult === 'negative' ? t('lab.cultureNegative') : t('lab.culturePending')}
                                    {labData.cultureGram && ` (${labData.cultureGram === 'positive' ? t('lab.gramPositive') : t('lab.gramNegative')})`}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Lab edit form */}
                {showLabForm && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div className="input-group">
                                <label className="input-label">{t('lab.crpTime1')}</label>
                                <input type="number" className="input-field" placeholder="mg/L" value={labData.crp1} onChange={e => setLabData(prev => ({ ...prev, crp1: e.target.value }))} />
                            </div>
                            <div className="input-group">
                                <label className="input-label">{t('lab.crpTime2')}</label>
                                <input type="number" className="input-field" placeholder="mg/L" value={labData.crp2} onChange={e => setLabData(prev => ({ ...prev, crp2: e.target.value }))} />
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="input-label">{t('lab.cultureResult')}</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {['pending', 'negative', 'positive'].map(val => (
                                    <button key={val} type="button" className="btn btn-sm" onClick={() => setLabData(prev => ({ ...prev, cultureResult: val }))}
                                        style={{
                                            flex: 1,
                                            background: labData.cultureResult === val ? (val === 'positive' ? 'rgba(239,68,68,0.1)' : val === 'negative' ? 'rgba(16,185,129,0.1)' : 'rgba(14,165,233,0.1)') : 'var(--color-surface)',
                                            border: `1.5px solid ${labData.cultureResult === val ? (val === 'positive' ? 'var(--color-danger)' : val === 'negative' ? 'var(--color-success)' : 'var(--color-primary)') : 'var(--color-border)'}`,
                                            color: labData.cultureResult === val ? (val === 'positive' ? 'var(--color-danger)' : val === 'negative' ? 'var(--color-success)' : 'var(--color-primary)') : 'var(--color-text)',
                                        }}>
                                        {val === 'positive' ? t('lab.culturePositive') : val === 'negative' ? t('lab.cultureNegative') : t('lab.culturePending')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {labData.cultureResult === 'positive' && (
                            <div className="input-group">
                                <label className="input-label">{t('lab.cultureGram')}</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {['positive', 'negative'].map(val => (
                                        <button key={val} type="button" className="btn btn-sm" onClick={() => setLabData(prev => ({ ...prev, cultureGram: val }))}
                                            style={{
                                                flex: 1,
                                                background: labData.cultureGram === val ? 'rgba(14,165,233,0.1)' : 'var(--color-surface)',
                                                border: `1.5px solid ${labData.cultureGram === val ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                                color: labData.cultureGram === val ? 'var(--color-primary)' : 'var(--color-text)',
                                            }}>
                                            {val === 'positive' ? t('lab.gramPositive') : t('lab.gramNegative')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Antibiogram */}
                        <div className="input-group">
                            <label className="input-label">{t('lab.antibiogram')}</label>
                            <p className="text-sm text-muted" style={{ margin: '0 0 0.5rem' }}>{t('lab.antibiogramDesc')}</p>
                            {(labData.antibiogram || []).map((item, i) => (
                                <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                                    <input className="input-field" placeholder="Antibiotic" value={item.drug} onChange={e => {
                                        const updated = [...labData.antibiogram];
                                        updated[i] = { ...updated[i], drug: e.target.value };
                                        setLabData(prev => ({ ...prev, antibiogram: updated }));
                                    }} style={{ flex: 2 }} />
                                    <select className="input-field" value={item.result} onChange={e => {
                                        const updated = [...labData.antibiogram];
                                        updated[i] = { ...updated[i], result: e.target.value };
                                        setLabData(prev => ({ ...prev, antibiogram: updated }));
                                    }} style={{ flex: 1 }}>
                                        <option value="">{t('common.all')}</option>
                                        <option value="sensitive">{t('lab.sensitive')}</option>
                                        <option value="intermediate">{t('lab.intermediate')}</option>
                                        <option value="resistant">{t('lab.resistant')}</option>
                                    </select>
                                    <button onClick={() => setLabData(prev => ({ ...prev, antibiogram: prev.antibiogram.filter((_, j) => j !== i) }))} className="btn btn-sm" style={{ padding: '0.3rem', color: 'var(--color-danger)' }}>
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                            <button onClick={() => setLabData(prev => ({ ...prev, antibiogram: [...(prev.antibiogram || []), { drug: '', result: '' }] }))}
                                className="btn btn-sm" style={{ alignSelf: 'flex-start', background: 'rgba(14,165,233,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(14,165,233,0.2)' }}>
                                + {t('lab.addAntibiogram')}
                            </button>
                        </div>

                        <button className="btn btn-primary btn-sm" onClick={handleSaveLabData} disabled={savingLab} style={{ alignSelf: 'flex-end' }}>
                            <Beaker size={14} /> {savingLab ? t('common.saving') : t('lab.saveLabData')}
                        </button>
                    </div>
                )}
            </div>

            {/* Timeline */}
            {(p.timeline || []).length > 0 && (
                <div className="card animate-slide-up">
                    <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem' }}>
                        <History size={18} color="var(--color-primary)" /> {t('reeval.timeline')}
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {p.timeline.slice().reverse().map((event, i) => (
                            <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.6rem', background: 'var(--color-surface-raised)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', borderLeft: `3px solid ${event.type === 'evaluation' ? 'var(--color-success)' : event.type === 'transfer' ? 'var(--color-warning)' : 'var(--color-primary)'}` }}>
                                <div style={{ flex: 1 }}>
                                    <div className="fw-600">{event.type === 'evaluation' ? t('reeval.evalResult') : event.type === 'transfer' ? t('transfer.title') : event.type === 'lab_update' ? t('lab.title') : event.type}</div>
                                    {event.result && <span className="fw-700" style={{ color: event.result.includes('ĐỎ') || event.result.includes('RED') ? 'var(--color-danger)' : event.result.includes('XANH') || event.result.includes('GREEN') ? 'var(--color-success)' : 'var(--color-warning)' }}>{event.result}</span>}
                                    {event.note && <div className="text-muted">{event.note}</div>}
                                    {event.from && <div className="text-muted">{t('transfer.from')}: {event.from} → {event.to}</div>}
                                </div>
                                <div className="text-muted text-sm" style={{ flexShrink: 0 }}>
                                    {event.at && formatDistanceToNow(new Date(event.at), { addSuffix: true, locale: locale === 'vi' ? vi : enUS })}
                                    {event.by && <div className="text-2xs">{event.by}</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Clinical Images */}
            <div className="card animate-slide-up">
                <h3 className="section-title" style={{ margin: '0 0 0.5rem' }}>{t('reeval.clinicalImages')}</h3>
                <p className="text-sm text-muted" style={{ margin: '0 0 0.75rem' }}>{t('reeval.imageDesc')}</p>

                {images.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        {images.map((url, i) => (
                            <div key={i} style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', aspectRatio: '1', border: '1px solid var(--color-border)', cursor: 'pointer' }} onClick={() => openViewer(url)}>
                                <img src={url} alt={`Clinical ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <button onClick={(e) => { e.stopPropagation(); removeImage(i); }} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', padding: '2px', cursor: 'pointer', color: 'white' }}>
                                    <X size={14} />
                                </button>
                                <div style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: '4px', display: 'flex' }}>
                                    <Maximize2 size={12} color="white" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <label className="btn btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'var(--color-surface-raised)', border: '1px dashed var(--color-border)' }}>
                    {uploading ? <RefreshCw size={14} className="pulse-danger" /> : <Upload size={14} />}
                    {uploading ? t('reeval.processing') : t('reeval.selectImage')}
                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} disabled={uploading} />
                </label>
            </div>

            {/* Paraclinical Images (X-ray, Ultrasound...) */}
            <div className="card animate-slide-up">
                <h3 className="section-title" style={{ margin: '0 0 0.5rem' }}>{t('reeval.paraclinicalImages')}</h3>
                <p className="text-sm text-muted" style={{ margin: '0 0 0.75rem' }}>{t('reeval.paraclinicalDesc')}</p>

                {paraclinicalImages.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        {paraclinicalImages.map((url, i) => (
                            <div key={i} style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', aspectRatio: '1', border: '1px solid var(--color-border)', cursor: 'pointer' }} onClick={() => openViewer(url)}>
                                <img src={url} alt={`Paraclinical ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <button onClick={(e) => { e.stopPropagation(); removeParaclinicalImage(i); }} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', padding: '2px', cursor: 'pointer', color: 'white' }}>
                                    <X size={14} />
                                </button>
                                <div style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: '4px', display: 'flex' }}>
                                    <Maximize2 size={12} color="white" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <label className="btn btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'var(--color-surface-raised)', border: '1px dashed var(--color-border)' }}>
                    {uploadingParaclinical ? <RefreshCw size={14} className="pulse-danger" /> : <Upload size={14} />}
                    {uploadingParaclinical ? t('reeval.processing') : t('reeval.selectImage')}
                    <input type="file" accept="image/*" onChange={handleParaclinicalUpload} style={{ display: 'none' }} disabled={uploadingParaclinical} />
                </label>
            </div>

            {/* Evaluation Form */}
            <div className="card animate-slide-up" style={{ borderColor: evaluationResult ? 'var(--color-success)' : 'var(--color-border)' }}>
                <h3 className="section-title" style={{ margin: '0 0 1rem' }}>{t('reeval.evaluationForm')}</h3>

                <div className="input-group">
                    <label className="input-label">{t('reeval.evalResult')}</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        {[
                            { value: 'ĐỎ', label: t('evalOptions.red'), color: 'var(--color-danger)', bg: 'rgba(239,68,68,0.1)' },
                            { value: 'VÀNG', label: t('evalOptions.yellow'), color: 'var(--color-warning)', bg: 'rgba(245,158,11,0.1)' },
                            { value: 'XANH', label: t('evalOptions.green'), color: 'var(--color-success)', bg: 'rgba(16,185,129,0.1)' },
                            { value: 'XUẤT VIỆN', label: t('evalOptions.discharge'), color: 'var(--color-primary)', bg: 'rgba(14,165,233,0.1)' },
                        ].map(opt => (
                            <button key={opt.value} type="button" className="btn" onClick={() => setEvaluationResult(opt.value)}
                                style={{
                                    padding: '0.75rem 0.5rem', fontSize: '0.82rem', fontWeight: evaluationResult === opt.value ? 700 : 500,
                                    background: evaluationResult === opt.value ? opt.bg : 'var(--color-surface)',
                                    border: `1.5px solid ${evaluationResult === opt.value ? opt.color : 'var(--color-border)'}`,
                                    color: evaluationResult === opt.value ? opt.color : 'var(--color-text)',
                                    textAlign: 'left',
                                }}>
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {protocolSuggestion && (
                        <div className="animate-slide-up" style={{
                            marginTop: '1rem',
                            padding: '0.85rem 1rem',
                            borderRadius: '8px',
                            backgroundColor: evaluationResult === 'ĐỎ' ? 'rgba(239, 68, 68, 0.08)' :
                                evaluationResult === 'VÀNG' ? 'rgba(245, 158, 11, 0.08)' :
                                    evaluationResult === 'XANH' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(14, 165, 233, 0.08)',
                            border: `1px solid ${evaluationResult === 'ĐỎ' ? 'var(--color-danger)' :
                                evaluationResult === 'VÀNG' ? 'var(--color-warning)' :
                                    evaluationResult === 'XANH' ? 'var(--color-success)' : 'var(--color-primary)'}`,
                            display: 'flex',
                            gap: '0.75rem',
                            alignItems: 'flex-start'
                        }}>
                            <div style={{
                                marginTop: '2px',
                                color: evaluationResult === 'ĐỎ' ? 'var(--color-danger)' :
                                    evaluationResult === 'VÀNG' ? 'var(--color-warning)' :
                                        evaluationResult === 'XANH' ? 'var(--color-success)' : 'var(--color-primary)'
                            }}>
                                <Lightbulb size={20} style={{ fill: 'currentColor', fillOpacity: 0.2 }} />
                            </div>
                            <div>
                                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', color: 'var(--color-text)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                                    {t('reeval.suggestedAction')}
                                </h4>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                                    {protocolSuggestion}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="input-group" style={{ marginTop: '0.75rem' }}>
                    <label className="input-label">{t('reeval.extraNote')}</label>
                    <textarea className="input-field" placeholder={t('reeval.extraNote')} value={evaluationNote} onChange={e => setEvaluationNote(e.target.value)} style={{ minHeight: '80px', resize: 'vertical' }} />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <button className="btn btn-primary" onClick={handleSaveEvaluation} disabled={saving} style={{ flex: 1 }}>
                        {saving ? t('common.saving') : t('reeval.saveEvaluation')}
                    </button>
                    {protocolSuggestion && evaluationResult !== 'XUẤT VIỆN' && (
                        <button className="btn" onClick={handleChangeProtocol} disabled={saving}
                            style={{ flex: 1, background: 'rgba(245, 158, 11, 0.1)', border: '1.5px solid var(--color-warning)', color: 'var(--color-warning)', fontWeight: 600 }}>
                            {saving ? t('common.saving') : t('reeval.changeProtocolBtn')}
                        </button>
                    )}
                </div>
                {protocolSuggestion && evaluationResult !== 'XUẤT VIỆN' && (
                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                        {t('reeval.changeProtocolDesc')}
                    </p>
                )}
            </div>

            {/* Image Viewer Modal — rendered via portal to sit above everything */}
            {viewerImage && ReactDOM.createPortal(
                <div
                    onClick={closeViewer}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        zIndex: 99999,
                        background: '#000',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden',
                    }}
                >
                    {/* Close button — top left */}
                    <button onClick={closeViewer} style={{
                        position: 'absolute', top: '12px', left: '12px', zIndex: 100001,
                        background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
                        width: '44px', height: '44px', cursor: 'pointer', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backdropFilter: 'blur(8px)',
                    }}><X size={22} /></button>

                    {/* Zoom percentage — top right */}
                    <div style={{
                        position: 'absolute', top: '16px', right: '16px', zIndex: 100001,
                        color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 700,
                    }}>{Math.round(viewerZoom * 100)}%</div>

                    {/* Image area */}
                    <div
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={handleViewerMouseDown}
                        onMouseMove={handleViewerMouseMove}
                        onMouseUp={handleViewerMouseUp}
                        onMouseLeave={handleViewerMouseUp}
                        onTouchStart={handleViewerTouchStart}
                        onTouchMove={handleViewerTouchMove}
                        onTouchEnd={handleViewerTouchEnd}
                        style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '100%', overflow: 'hidden',
                            cursor: viewerZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                            touchAction: 'none', userSelect: 'none',
                        }}
                    >
                        <img
                            src={viewerImage}
                            alt="Viewer"
                            draggable={false}
                            style={{
                                maxWidth: '100vw', maxHeight: 'calc(100vh - 80px)',
                                objectFit: 'contain',
                                transform: `scale(${viewerZoom}) translate(${viewerPan.x / viewerZoom}px, ${viewerPan.y / viewerZoom}px)`,
                                transition: isDragging ? 'none' : 'transform 0.2s ease',
                            }}
                        />
                    </div>

                    {/* Bottom toolbar */}
                    <div onClick={(e) => e.stopPropagation()} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem',
                        padding: '12px 20px',
                        background: 'rgba(255,255,255,0.08)',
                        backdropFilter: 'blur(12px)',
                        borderRadius: '999px',
                        marginBottom: '16px',
                    }}>
                        <button onClick={() => setViewerZoom(z => Math.max(0.5, z - 0.5))} style={{
                            background: 'none', border: 'none', padding: '8px',
                            cursor: 'pointer', color: 'white', display: 'flex',
                            opacity: viewerZoom <= 0.5 ? 0.3 : 1,
                        }}><ZoomOut size={22} /></button>

                        <button onClick={() => { setViewerZoom(1); setViewerPan({ x: 0, y: 0 }); }} style={{
                            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px',
                            padding: '6px 14px', cursor: 'pointer', color: 'white', fontSize: '0.8rem', fontWeight: 600,
                        }}>Reset</button>

                        <button onClick={() => setViewerZoom(z => Math.min(5, z + 0.5))} style={{
                            background: 'none', border: 'none', padding: '8px',
                            cursor: 'pointer', color: 'white', display: 'flex',
                            opacity: viewerZoom >= 5 ? 0.3 : 1,
                        }}><ZoomIn size={22} /></button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
