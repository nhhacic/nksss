import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { User, Building2, Stethoscope, Save, Link as LinkIcon, KeyRound, Moon, Sun, Monitor, Upload, Loader2, Bell, BellOff, Clock } from 'lucide-react';
import { useToast } from '../components/Toast';
import { useTranslation } from '../i18n/LanguageContext';
import usePushNotification from '../hooks/usePushNotification';

export default function Profile() {
    const { currentUser, updateDisplayName, updateUserPassword } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const { t } = useTranslation();
    const { pushEnabled, toggle: togglePush } = usePushNotification();

    // Auth settings
    const [name, setName] = useState(currentUser?.displayName || '');
    const [avatarUrl, setAvatarUrl] = useState(currentUser?.photoURL || '');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // System settings
    const [theme, setTheme] = useState(localStorage.getItem('nksss_theme') || 'dark');

    // Firestore settings
    const [hospital, setHospital] = useState('');
    const [department, setDepartment] = useState('');
    const [alertFrequency, setAlertFrequency] = useState(12); // hours: 6, 12, or 24

    const [loading, setLoading] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const loadProfile = async () => {
            if (!currentUser) return;
            try {
                const docRef = doc(db, 'users', currentUser.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.hospital) setHospital(data.hospital);
                    if (data.department) setDepartment(data.department);
                    if (data.alertFrequency) setAlertFrequency(data.alertFrequency);
                }
            } catch (error) {
                console.error("Error loading user profile:", error);
            }
        };

        loadProfile();
    }, [currentUser]);

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Update Auth Profile
            if (name !== currentUser.displayName || avatarUrl !== currentUser.photoURL) {
                await updateDisplayName(name, avatarUrl);
            }

            // Update Firestore Profile
            await setDoc(doc(db, 'users', currentUser.uid), {
                hospital,
                department,
                alertFrequency,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            // Update Password if filled
            if (password || confirmPassword) {
                if (password !== confirmPassword) {
                    toast.error(t('profile.passwordMismatch'));
                    setLoading(false);
                    return;
                }

                if (password.length < 6) {
                    toast.error(t('login.errorWeakPassword'));
                    setLoading(false);
                    return;
                }

                await updateUserPassword(password);
                setPassword('');
                setConfirmPassword('');
            }

            // Update Theme
            localStorage.setItem('nksss_theme', theme);
            window.dispatchEvent(new CustomEvent('themeChange', { detail: theme }));

            toast.success(t('profile.saveSuccess'));
            setTimeout(() => {
                navigate('/');
            }, 1000);
        } catch (error) {
            console.error(error);
            if (error.code === 'auth/requires-recent-login') {
                toast.error(t('profile.recentLoginRequired'));
            } else {
                toast.error(t('login.errorGeneral'));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error(t('profile.invalidImage'));
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            toast.error(t('profile.imageTooLarge'));
            return;
        }

        try {
            setUploadingImage(true);

            const fileRef = ref(storage, `avatars/${currentUser.uid}_${Date.now()}`);
            await uploadBytes(fileRef, file);
            const downloadUrl = await getDownloadURL(fileRef);

            setAvatarUrl(downloadUrl);
            toast.success(t('profile.imageUploaded'));
        } catch (error) {
            console.error("Error uploading image:", error);
            toast.error(t('profile.imageUploadError'));
        } finally {
            setUploadingImage(false);
            e.target.value = null;
        }
    };

    const handleTogglePush = async () => {
        const result = await togglePush();
        if (pushEnabled) {
            toast.success(t('pushToggle.disabled'));
        } else {
            if (result?.success !== false) {
                toast.success(t('pushToggle.enabled'));
            } else {
                toast.error(t('pushToggle.error'));
            }
        }
    };

    return (
        <div className="card animate-slide-up" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <User size={22} color="var(--color-primary)" />
                {t('profile.title')}
            </h2>

            <form onSubmit={handleSaveProfile}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div
                        style={{
                            width: '80px', height: '80px', borderRadius: '50%',
                            backgroundColor: 'var(--color-surface-raised)',
                            border: '2px dashed var(--color-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden', flexShrink: 0, position: 'relative',
                            cursor: 'pointer',
                        }}
                        onClick={() => !uploadingImage && fileInputRef.current?.click()}
                        title="Bấm để tải ảnh lên"
                    >
                        {uploadingImage ? (
                            <Loader2 size={28} className="pulse-danger" style={{ color: 'var(--color-primary)', animation: 'pulse 1.5s infinite' }} />
                        ) : avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <User size={36} color="var(--color-text-muted)" />
                        )}

                        {!uploadingImage && (
                            <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                background: 'rgba(0,0,0,0.5)', padding: '2px 0',
                                display: 'flex', justifyContent: 'center',
                                fontSize: '0.65rem', color: 'white', fontWeight: 600
                            }}>
                                <Upload size={12} style={{ marginRight: '2px' }} /> {t('profile.changeAvatar')}
                            </div>
                        )}
                    </div>
                    <div style={{ flex: 1 }}>
                        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                            <LinkIcon size={14} /> {t('profile.avatarUrl')}
                        </label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="https://..."
                            value={avatarUrl}
                            onChange={(e) => setAvatarUrl(e.target.value)}
                        />
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleImageUpload}
                        />
                    </div>
                </div>

                <div className="divider" style={{ margin: '1.5rem 0' }} />

                <div className="input-group">
                    <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <User size={14} /> {t('profile.doctorName')}
                    </label>
                    <input
                        type="text"
                        className="input-field"
                        placeholder="VD: Nguyễn Văn A"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="input-group">
                        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Building2 size={14} /> {t('profile.hospital')}
                        </label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="VD: BV Nhi Đồng"
                            value={hospital}
                            onChange={(e) => setHospital(e.target.value)}
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Stethoscope size={14} /> {t('profile.department')}
                        </label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="VD: Hồi sức Sơ sinh"
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                        />
                    </div>
                </div>

                <div className="divider" style={{ margin: '1.5rem 0' }} />

                <h3 style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Monitor size={16} /> {t('profile.systemSettings')}
                </h3>

                <div className="input-group">
                    <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {t('profile.theme')}
                    </label>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            type="button"
                            className="btn"
                            onClick={() => setTheme('light')}
                            style={{
                                flex: 1,
                                background: theme === 'light' ? 'rgba(14, 165, 233, 0.1)' : 'var(--color-surface)',
                                border: `1.5px solid ${theme === 'light' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                color: theme === 'light' ? 'var(--color-primary)' : 'var(--color-text)',
                            }}
                        >
                            <Sun size={18} /> {t('profile.themeLight')}
                        </button>
                        <button
                            type="button"
                            className="btn"
                            onClick={() => setTheme('dark')}
                            style={{
                                flex: 1,
                                background: theme === 'dark' ? 'rgba(14, 165, 233, 0.1)' : 'var(--color-surface)',
                                border: `1.5px solid ${theme === 'dark' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                color: theme === 'dark' ? 'var(--color-primary)' : 'var(--color-text)',
                            }}
                        >
                            <Moon size={18} /> {t('profile.themeDark')}
                        </button>
                    </div>
                </div>

                <div className="input-group" style={{ marginTop: '1rem' }}>
                    <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {t('profile.autoAlert')}
                    </label>
                    <button
                        type="button"
                        onClick={handleTogglePush}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.75rem 1rem', width: '100%',
                            background: pushEnabled ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-surface)',
                            color: pushEnabled ? 'var(--color-success)' : 'var(--color-text)',
                            border: `1px solid ${pushEnabled ? 'var(--color-success)' : 'var(--color-border)'}`,
                            borderRadius: 'var(--radius-md)', cursor: 'pointer',
                            justifyContent: 'center', fontWeight: 600,
                            fontFamily: 'var(--font-sans)',
                        }}
                    >
                        {pushEnabled ? (
                            <><Bell size={18} /> {t('profile.alertOn')}</>
                        ) : (
                            <><BellOff size={18} color="var(--color-text-muted)" /> {t('profile.alertOff')}</>
                        )}
                    </button>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
                        {t('profile.alertDesc')}
                    </p>

                    {/* Alert Frequency Selector */}
                    {pushEnabled && (
                        <div style={{ marginTop: '1rem' }}>
                            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                                <Clock size={14} /> {t('profile.alertFrequencyLabel')}
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {[6, 12, 24].map(h => (
                                    <button
                                        key={h}
                                        type="button"
                                        className="btn"
                                        onClick={() => setAlertFrequency(h)}
                                        style={{
                                            flex: 1,
                                            background: alertFrequency === h ? 'rgba(14, 165, 233, 0.1)' : 'var(--color-surface)',
                                            border: `1.5px solid ${alertFrequency === h ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                            color: alertFrequency === h ? 'var(--color-primary)' : 'var(--color-text)',
                                            fontWeight: alertFrequency === h ? 700 : 400,
                                        }}
                                    >
                                        {h}h
                                    </button>
                                ))}
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.4rem' }}>
                                {t('profile.alertFrequencyDesc', { hours: alertFrequency })}
                            </p>
                        </div>
                    )}
                </div>

                <div className="divider" style={{ margin: '1.5rem 0' }} />

                <h3 style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('profile.changePasswordSection')}
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="input-group">
                        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <KeyRound size={14} /> {t('profile.newPassword')}
                        </label>
                        <input
                            type="password"
                            className="input-field"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <KeyRound size={14} /> {t('profile.confirmPassword')}
                        </label>
                        <input
                            type="password"
                            className="input-field"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        <Save size={18} />
                        {loading ? t('common.saving') : t('profile.saveProfile')}
                    </button>
                </div>
            </form>
        </div>
    );
}
