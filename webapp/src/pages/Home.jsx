import { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePatient } from '../context/PatientContext';
import { useTranslation } from '../i18n/LanguageContext';
import { Activity, Search, PlusCircle, AlertTriangle, FileText, Trash2, Bell, BellOff, ChevronDown, ChevronUp, Clock, CheckCircle2, UserPen, BarChart3, Download, Calendar, TrendingUp, Pill, X, Filter } from 'lucide-react';
import { getPatients, deletePatient } from '../lib/storage';
import { format, differenceInHours } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import usePushNotification from '../hooks/usePushNotification';
import { matchesPatientFilter, getFilterLabel, computePatientStats, computeGAStats, computeWeightStats, computeAntibioticStats, getPatientPriority } from '../lib/patientUtils';

/* ── tiny donut (SVG) ── */
function DonutChart({ value, max, color, size = 56 }) {
    const pct = max > 0 ? value / max : 0;
    const r = (size - 8) / 2;
    const circ = 2 * Math.PI * r;
    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-raised)" strokeWidth="5" />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5"
                strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
        </svg>
    );
}

/* ── inline bar chart ── */
function MiniBarChart({ data, colorFn, filterType, activeFilter, onFilter }) {
    const max = Math.max(...data.map(d => d[1]), 1);
    const isActive = (label) => activeFilter?.type === filterType && activeFilter?.value === label;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {data.map(([label, value], i) => (
                <div key={i}
                    onClick={() => value > 0 && onFilter && onFilter(filterType, label)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        cursor: value > 0 && onFilter ? 'pointer' : 'default',
                        padding: '0.2rem 0.3rem',
                        borderRadius: 'var(--radius-sm)',
                        background: isActive(label) ? 'rgba(14,165,233,0.08)' : 'transparent',
                        outline: isActive(label) ? '2px solid var(--color-primary)' : 'none',
                        transition: 'all 0.15s ease',
                    }}
                >
                    <span style={{ fontSize: '0.72rem', color: isActive(label) ? 'var(--color-primary)' : 'var(--color-text-muted)', minWidth: '68px', textAlign: 'right', fontWeight: isActive(label) ? 800 : 600 }}>{label}</span>
                    <div style={{ flex: 1, height: '20px', background: 'var(--color-surface-raised)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', position: 'relative' }}>
                        <div style={{
                            width: `${Math.max((value / max) * 100, value > 0 ? 10 : 0)}%`,
                            height: '100%',
                            background: colorFn ? colorFn(i) : 'var(--gradient-primary)',
                            borderRadius: 'var(--radius-sm)',
                            transition: 'width 0.6s ease',
                            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '0.4rem',
                            opacity: isActive(label) ? 1 : 0.85,
                        }}>
                            {value > 0 && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'white' }}>{value}</span>}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function Home() {
    const { resetPatient } = usePatient();
    const navigate = useNavigate();
    const [patients, setPatients] = useState([]);
    const [showPatients, setShowPatients] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const { currentUser, updateDisplayName } = useAuth();
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const [savingName, setSavingName] = useState(false);
    const [showCharts, setShowCharts] = useState(true);
    const [chartFilter, setChartFilter] = useState(null); // { type, value }
    const patientListRef = useRef(null);
    const toast = useToast();
    const { t } = useTranslation();
    const { pushEnabled, subscribe: subscribePush } = usePushNotification();

    // ── Chart filter logic ──
    const handleChartFilter = (type, value) => {
        if (chartFilter?.type === type && chartFilter?.value === value) {
            setChartFilter(null);
        } else {
            setChartFilter({ type, value });
            setShowPatients(true);
            setTimeout(() => patientListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }
    };

    const matchesChartFilter = (p) => matchesPatientFilter(p, chartFilter);
    const getChartFilterLabel = () => getFilterLabel(chartFilter, t);

    // Tên hợp lệ: có ký tự khoảng trắng hoặc không giống đuôi email
    const hasRealName = currentUser?.displayName && /\s/.test(currentUser.displayName);

    useEffect(() => {
        loadPatients();
    }, []);

    const handleSubscribePush = async () => {
        const result = await subscribePush();
        if (result.success) {
            toast.success(t('home.enableAlerts') + " ✅");
        } else if (result.reason === 'denied') {
            toast.warning(t('login.errorGeneral'));
        } else {
            toast.error(t('login.errorGeneral'));
        }
    };

    const loadPatients = async () => {
        try {
            const data = await getPatients();
            setPatients(data);
        } catch (error) {
            console.error('Error loading patients:', error);
            toast.error(t('login.errorGeneral'));
        }
    };

    const handleSaveName = async () => {
        if (!nameInput.trim()) return;
        setSavingName(true);
        try {
            await updateDisplayName(nameInput.trim());
            setEditingName(false);
            toast.success(t('homeExtra.nameUpdated'));
        } catch (e) {
            console.error("Error updating name:", e);
            toast.error(t('login.errorGeneral'));
        } finally {
            setSavingName(false);
        }
    };

    const handleDelete = async (id) => {
        if (confirm(t('homeExtra.confirmDeleteTitle').replace('{id}', id))) {
            await deletePatient(id);
            loadPatients();
            toast.success(t('homeExtra.deleteSuccess'));
        }
    };

    // Export CSV
    const handleExportCSV = () => {
        if (patients.length === 0) {
            toast.warning(t('common.noData'));
            return;
        }
        const headers = ['Mã BN', 'Ngày sinh', 'Cân nặng (g)', 'Tuần thai', 'Ngày tuổi', 'Ngày nhập viện', 'Chẩn đoán', 'Phác đồ', 'Kết quả đánh giá', 'Tags'];
        const rows = patients.map(p => [
            p.id,
            p.dob || '',
            p.weight || '',
            p.gestationalAge || '',
            p.ageDays || '',
            p.admissionTime ? format(new Date(p.admissionTime), 'dd/MM/yyyy HH:mm') : '',
            p.diagnosis || '',
            p.antibioticGroup?.rec || '',
            p.evaluationResult || '',
            (p.tags || []).join('; '),
        ]);
        const csvContent = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `NKSSS_Export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success(t('homeExtra.csvExported'));
    };

    const getPriority = getPatientPriority;

    const filteredPatients = patients.filter(p => {
        // Chart filter
        if (!matchesChartFilter(p)) return false;
        // Search filter
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const dateStr = format(new Date(p.admissionTime || p.createdAt), 'dd/MM/yyyy');
        const tagStr = (p.tags || []).join(' ').toLowerCase();
        return p.id.toLowerCase().includes(q) || dateStr.includes(q) || tagStr.includes(q);
    }).sort((a, b) => {
        const pa = getPriority(a), pb = getPriority(b);
        if (pa !== pb) return pa - pb;
        return new Date(b.admissionTime || b.createdAt) - new Date(a.admissionTime || a.createdAt);
    });

    // Stats (shared with Dashboard)
    const stats = useMemo(() => computePatientStats(patients), [patients]);
    const { urgentCount, pendingCount, doneCount, totalPatients, completionRate, diagA, diagB } = stats;

    const gaStats = useMemo(() => computeGAStats(patients), [patients]);
    const weightStats = useMemo(() => computeWeightStats(patients), [patients]);
    const antibioticStats = useMemo(() => computeAntibioticStats(patients).slice(0, 5), [patients]);

    return (
        <div className="forum-page" style={{ gap: '1rem' }}>

            {/* ═══ COMPACT HERO ═══ */}
            <div className="hero-banner">
                <img src="/logo.png" alt="NKSSS" className="hero-logo" />
                <div className="flex-1">
                    <h1 className="hero-title">{t('common.appName')}</h1>
                    {currentUser && (
                        <div className="text-sm2 text-muted fw-500">
                            {t('home.hello')}, <span className="text-primary fw-700">{t('common.doctor')} {currentUser.displayName}</span> 👋
                        </div>
                    )}
                </div>
                {!pushEnabled ? (
                    <button onClick={handleSubscribePush} className="push-btn">
                        <Bell size={12} /> {t('home.enableAlerts')}
                    </button>
                ) : (
                    <div className="push-status">
                        <BellOff size={11} /> {t('home.alertEnabled')}
                    </div>
                )}
            </div>

            {/* ═══ SET NAME BANNER ═══ */}
            {!hasRealName && (
                <div className="name-banner">
                    <UserPen size={16} className="text-primary flex-shrink-0" />
                    {!editingName ? (
                        <>
                            <div className="flex-1">
                                <span className="text-base fw-600">{t('home.setDisplayName')}</span>
                                <p className="text-sm text-muted mt-025">{t('home.systemUsingEmail')}</p>
                            </div>
                            <button onClick={() => { setEditingName(true); setNameInput(''); }}
                                className="btn-xs" style={{ background: 'var(--gradient-primary)', color: 'white' }}>
                                {t('home.setName')}
                            </button>
                        </>
                    ) : (
                        <>
                            <input type="text" placeholder={t('home.namePlaceholder')} value={nameInput}
                                onChange={e => setNameInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !savingName && nameInput.trim() && handleSaveName()}
                                className="input-field flex-1" style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem', minWidth: '120px', borderColor: 'var(--color-primary)' }}
                                autoFocus
                            />
                            <button onClick={handleSaveName} disabled={savingName || !nameInput.trim()}
                                className="btn-xs" style={{
                                    background: nameInput.trim() ? 'var(--gradient-primary)' : 'var(--color-border)',
                                    color: nameInput.trim() ? 'white' : 'var(--color-text-muted)',
                                    cursor: nameInput.trim() ? 'pointer' : 'not-allowed',
                                }}>
                                {savingName ? t('common.saving') : t('common.save')}
                            </button>
                            <button onClick={() => setEditingName(false)} className="btn-xs btn-secondary">
                                {t('common.cancel')}
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* ═══ URGENT ALERT ═══ */}
            {urgentCount > 0 && (
                <div className="urgent-alert animate-slide-up">
                    <div className="urgent-pulse-icon">
                        <AlertTriangle size={14} color="white" />
                    </div>
                    <div className="flex-1">
                        <div className="fw-700 text-danger text-md">{t('home.urgentAlert', { count: urgentCount })}</div>
                        <div className="text-sm text-muted">{t('home.urgentSubtext')}</div>
                    </div>
                    <button onClick={() => {
                        setShowPatients(true);
                        setTimeout(() => document.getElementById('patient-list-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
                    }} className="btn-xs" style={{ background: 'var(--color-danger)', color: 'white' }}>
                        {t('home.viewNow')}
                    </button>
                </div>
            )}

            {/* ═══ STATS + DONUT ═══ */}
            <div className="stats-row">
                {/* Stats grid — CLICKABLE */}
                <div className="stats-cards">
                    {/* Quá hạn */}
                    <div onClick={() => urgentCount > 0 && handleChartFilter('status', 'urgent')}
                        className={`stat-card ${urgentCount > 0 ? 'stat-card--clickable' : ''}`}
                        style={{
                            background: urgentCount > 0 ? 'rgba(239,68,68,0.08)' : 'var(--color-surface)',
                            border: chartFilter?.type === 'status' && chartFilter?.value === 'urgent' ? '2px solid var(--color-danger)' : `1px solid ${urgentCount > 0 ? 'rgba(239,68,68,0.25)' : 'var(--color-border)'}`,
                        }}>
                        <AlertTriangle size={16} color={urgentCount > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)'} />
                        <div className="stat-value" style={{ color: urgentCount > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>{urgentCount}</div>
                        <div className="stat-label">{t('dashboard.overdueLabel')}</div>
                    </div>
                    {/* Đang theo dõi */}
                    <div onClick={() => pendingCount > 0 && handleChartFilter('status', 'pending')}
                        className={`stat-card ${pendingCount > 0 ? 'stat-card--clickable' : ''}`}
                        style={{
                            background: chartFilter?.type === 'status' && chartFilter?.value === 'pending' ? 'rgba(245,158,11,0.08)' : 'var(--color-surface)',
                            border: chartFilter?.type === 'status' && chartFilter?.value === 'pending' ? '2px solid var(--color-warning)' : '1px solid var(--color-border)',
                        }}>
                        <Clock size={16} color="var(--color-warning)" />
                        <div className="stat-value" style={{ color: 'var(--color-warning)' }}>{pendingCount}</div>
                        <div className="stat-label">{t('dashboard.monitor')}</div>
                    </div>
                    {/* Đã đánh giá */}
                    <div onClick={() => doneCount > 0 && handleChartFilter('status', 'done')}
                        className={`stat-card ${doneCount > 0 ? 'stat-card--clickable' : ''}`}
                        style={{
                            background: chartFilter?.type === 'status' && chartFilter?.value === 'done' ? 'rgba(16,185,129,0.08)' : 'var(--color-surface)',
                            border: chartFilter?.type === 'status' && chartFilter?.value === 'done' ? '2px solid var(--color-success)' : '1px solid var(--color-border)',
                        }}>
                        <CheckCircle2 size={16} color="var(--color-success)" />
                        <div className="stat-value" style={{ color: 'var(--color-success)' }}>{doneCount}</div>
                        <div className="stat-label">{t('dashboard.completed')}</div>
                    </div>
                </div>

                {/* Completion donut */}
                <div className="donut-wrapper">
                    <div className="donut-inner">
                        <DonutChart value={doneCount} max={totalPatients} color="var(--color-success)" size={50} />
                        <span className="donut-label">{completionRate}%</span>
                    </div>
                    <div className="donut-caption">{t('dashboard.evaluated')}</div>
                </div>
            </div>

            {/* ═══ QUICK ACTIONS ═══ */}
            <div className="action-grid">
                <Link to="/admission" className="action-card" onClick={resetPatient} style={{ padding: '1.1rem' }}>
                    <div className="icon-box icon-box--primary">
                        <PlusCircle size={20} color="white" />
                    </div>
                    <div>
                        <h3 className="text-lg fw-700 mb-025">{t('home.admitPatient')}</h3>
                        <p className="text-sm2 text-muted" style={{ lineHeight: 1.4 }}>{t('home.admitDesc')}</p>
                    </div>
                    <div className="btn btn-primary text-base" style={{ padding: '0.5rem 0.875rem' }}>
                        {t('home.startExam')}
                    </div>
                </Link>

                <div className="action-card" style={{ padding: '1.1rem' }} onClick={() => {
                    setShowPatients(prev => {
                        const next = !prev;
                        if (next) setTimeout(() => document.getElementById('patient-list-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
                        return next;
                    });
                }}>
                    <div className="icon-box icon-box--success">
                        <FileText size={20} color="white" />
                    </div>
                    <div>
                        <h3 className="text-lg fw-700 mb-025">{t('home.searchRecords')}</h3>
                        <p className="text-sm2 text-muted" style={{ lineHeight: 1.4 }}>{t('home.searchDesc')}</p>
                    </div>
                    <div className="flex items-center justify-center gap-04 fw-700 text-base" style={{
                        background: patients.length > 0 ? 'linear-gradient(135deg, var(--color-success), #06b6d4)' : 'var(--color-surface-raised)',
                        color: patients.length > 0 ? 'white' : 'var(--color-text-muted)',
                        borderRadius: 'var(--radius-md)', padding: '0.5rem 0.875rem',
                        border: patients.length === 0 ? '1px solid var(--color-border)' : 'none',
                        boxShadow: patients.length > 0 ? '0 4px 12px rgba(16,185,129,0.3)' : 'none',
                    }}>
                        {patients.length === 0 ? t('home.noPatients') : showPatients ? <><ChevronUp size={14} /> {t('home.hideList')}</> : <><Search size={13} /> {t('home.viewPatients', { count: patients.length })}</>}
                    </div>
                </div>
            </div>

            {/* ═══ INLINE CHARTS ═══ */}
            {totalPatients > 0 && (
                <div className="chart-wrapper">
                    {/* Chart header */}
                    <div onClick={() => setShowCharts(prev => !prev)} className={`chart-header ${showCharts ? 'chart-header--open' : ''}`}>
                        <div className="flex items-center gap-05">
                            <BarChart3 size={17} color="var(--color-primary)" />
                            <span className="text-md fw-700">{t('home.visualStats')}</span>
                            <span className="count-pill text-2xs">{totalPatients} {t('common.cases')}</span>
                        </div>
                        <div className="flex items-center gap-05">
                            <button onClick={(e) => { e.stopPropagation(); handleExportCSV(); }}
                                className="btn-icon btn-csv">
                                <Download size={12} /> CSV
                            </button>
                            {showCharts ? <ChevronUp size={16} color="var(--color-text-muted)" /> : <ChevronDown size={16} color="var(--color-text-muted)" />}
                        </div>
                    </div>

                    {showCharts && (
                        <div className="chart-body animate-slide-up">

                            {/* Completion progress bar */}
                            <div>
                                <div className="flex items-center justify-between mb-04">
                                    <span className="section-title-sm">
                                        <TrendingUp size={14} color="var(--color-primary)" /> {t('home.completionRate')}
                                    </span>
                                    <span className="text-sm text-muted fw-600">{doneCount}/{totalPatients}</span>
                                </div>
                                <div className="progress-track progress-track-sm">
                                    <div className={`progress-fill ${completionRate >= 80 ? 'progress-fill--success' : completionRate >= 50 ? 'progress-fill--warning' : 'progress-fill--danger'}`}
                                        style={{ width: `${completionRate}%` }}>
                                        <span className="progress-label progress-label-sm">{completionRate}%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Diagnosis A vs B */}
                            {(diagA > 0 || diagB > 0) && (
                                <div>
                                    <div className="section-title-sm">
                                        <Activity size={14} color="var(--color-warning)" /> {t('home.diagnosisDistribution')}
                                    </div>
                                    <div className="flex gap-06">
                                        <div onClick={() => diagA > 0 && handleChartFilter('diagnosis', 'A')}
                                            className={`diag-box diag-box--a ${chartFilter?.type === 'diagnosis' && chartFilter?.value === 'A' ? 'diag-box--a-active' : ''}`}
                                            style={{ cursor: diagA > 0 ? 'pointer' : 'default' }}>
                                            <div className="diag-value text-danger">{diagA}</div>
                                            <div className="diag-label text-danger">{t('dashboard.categoryA')}</div>
                                            <div className="diag-sublabel">{t('dashboard.needAbx')}</div>
                                        </div>
                                        <div onClick={() => diagB > 0 && handleChartFilter('diagnosis', 'B')}
                                            className={`diag-box diag-box--b ${chartFilter?.type === 'diagnosis' && chartFilter?.value === 'B' ? 'diag-box--b-active' : ''}`}
                                            style={{ cursor: diagB > 0 ? 'pointer' : 'default' }}>
                                            <div className="diag-value text-warning">{diagB}</div>
                                            <div className="diag-label text-warning">{t('dashboard.categoryB')}</div>
                                            <div className="diag-sublabel">{t('dashboard.monitor')}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Two-column charts */}
                            <div className="chart-columns">
                                {/* Gestational Age — CLICKABLE */}
                                <div>
                                    <div className="section-title-sm">
                                        <Calendar size={14} color="var(--color-primary)" /> {t('home.gestationalAge')}
                                    </div>
                                    <MiniBarChart data={gaStats} filterType="ga" activeFilter={chartFilter} onFilter={handleChartFilter}
                                        colorFn={(i) => ['var(--gradient-danger)', 'linear-gradient(135deg, #f97316, #f59e0b)', 'linear-gradient(135deg, #0ea5e9, #38bdf8)', 'var(--gradient-success)'][i]}
                                    />
                                </div>
                                {/* Weight — CLICKABLE */}
                                <div>
                                    <div className="section-title-sm">
                                        <TrendingUp size={14} color="var(--color-success)" /> {t('home.weight')}
                                    </div>
                                    <MiniBarChart data={weightStats} filterType="weight" activeFilter={chartFilter} onFilter={handleChartFilter} />
                                </div>
                            </div>

                            {/* Antibiotic usage — CLICKABLE */}
                            {antibioticStats.length > 0 && (
                                <div>
                                    <div className="section-title-sm">
                                        <Pill size={14} color="var(--color-primary)" /> {t('home.antibioticProtocol')}
                                    </div>
                                    <MiniBarChart data={antibioticStats} filterType="antibiotic" activeFilter={chartFilter} onFilter={handleChartFilter} />
                                </div>
                            )}

                            {/* Link to full Dashboard */}
                            <Link to="/dashboard" className="link-btn">
                                <BarChart3 size={14} /> {t('home.viewDetailedStats')}
                            </Link>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ PATIENT LIST ═══ */}
            {showPatients && (
                <div id="patient-list-section" ref={patientListRef} className="card animate-slide-up" style={{ scrollMarginTop: '1rem' }}>

                    {/* Active chart filter badge */}
                    {chartFilter && (
                        <div className="filter-badge animate-slide-up">
                            <Filter size={13} color="var(--color-primary)" />
                            <span className="filter-badge-label">{t('home.filterActive')}: {getChartFilterLabel()}</span>
                            <span className="filter-badge-count">— {filteredPatients.length} {t('common.cases')}</span>
                            <button onClick={() => setChartFilter(null)} className="filter-clear-btn" title={t('home.clearFilter')}>
                                <X size={15} />
                            </button>
                        </div>
                    )}

                    <h2 className="card-title flex items-center gap-05">
                        <FileText size={20} color="var(--color-primary)" />
                        {t('home.patientList')}
                        <span className="count-pill ml-auto">
                            {filteredPatients.length} {t('common.cases')}
                        </span>
                    </h2>

                    {patients.length > 0 && (
                        <div className="search-input-wrapper">
                            <div className="search-input-icon">
                                <Search size={16} />
                            </div>
                            <input type="text" className="input-field"
                                placeholder={t('common.search') + '...'}
                                style={{ paddingLeft: '2.25rem', fontSize: '0.9rem' }}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    )}

                    {filteredPatients.length === 0 ? (
                        <div className="empty-state">
                            <FileText size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                            <p style={{ fontWeight: 600 }}>{patients.length === 0 ? t('home.noPatients') : t('common.noData')}</p>
                            <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>{patients.length === 0 ? 'Hãy tiếp nhận ca bệnh đầu tiên' : 'Thử tìm kiếm với từ khóa khác'}</p>
                        </div>
                    ) : (
                        <div className="patient-list">
                            {filteredPatients.map(p => {
                                const hours = differenceInHours(new Date(), new Date(p.admissionTime || p.createdAt));
                                const isUrgent = !p.evaluationResult && hours >= 24;
                                const isPending = !p.evaluationResult && hours < 24;
                                return (
                                    <div key={p.id} className={`patient-item ${isUrgent ? 'urgent' : isPending ? 'pending' : 'done'}`}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div className="patient-row">
                                                <span className="patient-id">{p.id}</span>
                                                {isUrgent && (
                                                    <span className="badge badge-danger pulse-danger">
                                                        <AlertTriangle size={10} /> TỚI HẠN
                                                    </span>
                                                )}
                                                {isPending && (
                                                    <span className="badge badge-warning">
                                                        <Clock size={10} /> {hours}h / 24h
                                                    </span>
                                                )}
                                                {p.evaluationResult && (
                                                    <span className="badge badge-success">
                                                        <CheckCircle2 size={10} /> Đã đánh giá
                                                    </span>
                                                )}
                                            </div>
                                            <div className="patient-sub">
                                                {p.ageDays} ngày tuổi · {p.weight}g · Nhập viện: {format(new Date(p.admissionTime || p.createdAt), 'HH:mm dd/MM/yyyy')}
                                            </div>
                                            {p.tags && p.tags.length > 0 && (
                                                <div className="patient-tags">
                                                    {p.tags.map((tag, i) => (
                                                        <span key={i} className="tag-badge">#{tag}</span>
                                                    ))}
                                                </div>
                                            )}
                                            {p.evaluationResult && (
                                                <div className="patient-result">
                                                    {t('reeval.evalResult')}: {p.evaluationResult}
                                                </div>
                                            )}
                                        </div>

                                        <div className="patient-actions">
                                            {!p.evaluationResult ? (
                                                <button className="btn"
                                                    style={{
                                                        padding: '0.45rem 0.875rem', fontSize: '0.82rem', fontWeight: 700,
                                                        background: isUrgent ? 'var(--gradient-danger)' : 'var(--color-warning-bg)',
                                                        color: isUrgent ? 'white' : 'var(--color-warning)',
                                                        boxShadow: isUrgent ? '0 3px 10px rgba(239,68,68,0.35)' : 'none',
                                                        border: isUrgent ? 'none' : '1px solid rgba(245,158,11,0.3)',
                                                    }}
                                                    onClick={() => navigate(`/reevaluation/${p.id}`)}
                                                >
                                                    {isUrgent ? <><AlertTriangle size={13} /> {t('homeExtra.overdue')}</> : <><Clock size={13} /> {24 - hours}h</>}
                                                </button>
                                            ) : (
                                                <button className="btn btn-secondary"
                                                    style={{ padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
                                                    onClick={() => navigate(`/reevaluation/${p.id}`)}
                                                >
                                                    {t('common.edit')}
                                                </button>
                                            )}
                                            <button className="btn-icon" onClick={() => handleDelete(p.id)}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
