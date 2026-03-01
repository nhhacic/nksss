import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, TrendingUp, Calendar, AlertTriangle, CheckCircle2, Clock, ArrowLeft, FileText, Activity, Pill, X, Filter, User, Search, SlidersHorizontal, Bookmark, BookmarkPlus } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import { getPatients } from '../lib/storage';
import { differenceInHours, format, startOfMonth, startOfWeek, subDays, startOfDay, differenceInMinutes } from 'date-fns';
import { matchesPatientFilter, getFilterLabel, computePatientStats, computeGAStats, computeWeightStats, computeAntibioticStats, computeTagStats } from '../lib/patientUtils';

export default function Dashboard() {
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('all');
    const [activeFilter, setActiveFilter] = useState(null);
    const [showAdvSearch, setShowAdvSearch] = useState(false);
    const [searchDateFrom, setSearchDateFrom] = useState('');
    const [searchDateTo, setSearchDateTo] = useState('');
    const [searchAntibiotic, setSearchAntibiotic] = useState('');
    const [searchEvalResult, setSearchEvalResult] = useState('');
    const [savedFilters, setSavedFilters] = useState(() => {
        try { return JSON.parse(localStorage.getItem('nksss_saved_filters') || '[]'); } catch { return []; }
    });
    const listRef = useRef(null);
    const { t } = useTranslation();

    useEffect(() => {
        const load = async () => {
            try {
                const data = await getPatients();
                setPatients(data);
            } catch (error) {
                console.error('Error loading patients:', error);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleFilter = (type, value) => {
        if (activeFilter?.type === type && activeFilter?.value === value) {
            setActiveFilter(null);
        } else {
            setActiveFilter({ type, value });
            setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }
    };

    const isActive = (type, value) => activeFilter?.type === type && activeFilter?.value === value;

    const filteredByTime = useMemo(() => {
        const now = new Date();
        let result = patients;
        if (timeRange === 'week') {
            const start = startOfWeek(now, { weekStartsOn: 1 });
            result = patients.filter(p => new Date(p.createdAt || p.admissionTime) >= start);
        } else if (timeRange === 'month') {
            const start = startOfMonth(now);
            result = patients.filter(p => new Date(p.createdAt || p.admissionTime) >= start);
        }

        // Advanced search filters
        if (searchDateFrom) {
            const from = new Date(searchDateFrom);
            result = result.filter(p => new Date(p.createdAt || p.admissionTime) >= from);
        }
        if (searchDateTo) {
            const to = new Date(searchDateTo);
            to.setHours(23, 59, 59);
            result = result.filter(p => new Date(p.createdAt || p.admissionTime) <= to);
        }
        if (searchAntibiotic) {
            result = result.filter(p => p.antibioticGroup?.label?.includes(searchAntibiotic));
        }
        if (searchEvalResult) {
            result = result.filter(p => p.evaluationResult === searchEvalResult);
        }

        return result;
    }, [patients, timeRange, searchDateFrom, searchDateTo, searchAntibiotic, searchEvalResult]);

    const displayedPatients = useMemo(() => {
        return filteredByTime.filter(p => matchesPatientFilter(p, activeFilter));
    }, [filteredByTime, activeFilter]);

    // Stats using shared functions
    const fp = filteredByTime;
    const stats = useMemo(() => computePatientStats(fp), [fp]);
    const gaStats = useMemo(() => computeGAStats(fp), [fp]);
    const weightStats = useMemo(() => computeWeightStats(fp), [fp]);
    const antibioticStats = useMemo(() => computeAntibioticStats(fp), [fp]);
    const tagStats = useMemo(() => computeTagStats(fp), [fp]);

    // ── Trend Chart Data (last 7 days) ────────────────────────
    const trendData = useMemo(() => {
        const days = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const day = startOfDay(subDays(now, i));
            const nextDay = startOfDay(subDays(now, i - 1));
            const dayPatients = patients.filter(p => {
                const d = new Date(p.createdAt || p.admissionTime);
                return d >= day && d < nextDay;
            });
            days.push({
                label: format(day, 'dd/MM'),
                total: dayPatients.length,
                catA: dayPatients.filter(p => p.diagnosis === 'A').length,
                catB: dayPatients.filter(p => p.diagnosis === 'B').length,
            });
        }
        return days;
    }, [patients]);

    const trendMax = useMemo(() => Math.max(...trendData.map(d => d.total), 1), [trendData]);

    // Avg evaluation time
    const avgEvalTime = useMemo(() => {
        const evaluated = fp.filter(p => p.evaluatedAt && p.admissionTime);
        if (evaluated.length === 0) return null;
        const total = evaluated.reduce((sum, p) => {
            return sum + differenceInMinutes(new Date(p.evaluatedAt), new Date(p.admissionTime));
        }, 0);
        const avgMinutes = Math.round(total / evaluated.length);
        const hours = Math.floor(avgMinutes / 60);
        const minutes = avgMinutes % 60;
        return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
    }, [fp]);

    // ── Save/load advanced filters ──────────────────────────
    const handleSaveFilter = () => {
        const current = { searchDateFrom, searchDateTo, searchAntibiotic, searchEvalResult, name: `Filter ${savedFilters.length + 1}` };
        const updated = [...savedFilters, current];
        setSavedFilters(updated);
        localStorage.setItem('nksss_saved_filters', JSON.stringify(updated));
    };

    const handleApplyFilter = (filter) => {
        setSearchDateFrom(filter.searchDateFrom || '');
        setSearchDateTo(filter.searchDateTo || '');
        setSearchAntibiotic(filter.searchAntibiotic || '');
        setSearchEvalResult(filter.searchEvalResult || '');
    };

    const handleDeleteFilter = (index) => {
        const updated = savedFilters.filter((_, i) => i !== index);
        setSavedFilters(updated);
        localStorage.setItem('nksss_saved_filters', JSON.stringify(updated));
    };

    // ── Clickable bar chart ────────────────────────────────────
    const BarChart = ({ data, colorFn, filterType }) => {
        const max = Math.max(...data.map(d => d[1]), 1);
        return (
            <div className="flex-col gap-05" style={{ display: 'flex' }}>
                {data.map(([label, value], i) => {
                    const active = isActive(filterType, label);
                    return (
                        <div key={i} onClick={() => value > 0 && handleFilter(filterType, label)}
                            className={`bar-row ${value > 0 ? 'bar-row--clickable' : ''} ${active ? 'bar-row--active' : ''}`}>
                            <span className={`bar-label ${active ? 'bar-label--active' : ''}`} style={{ minWidth: '80px', fontSize: '0.78rem' }}>{label}</span>
                            <div className="bar-track bar-track-lg">
                                <div className="bar-fill" style={{
                                    width: `${Math.max((value / max) * 100, value > 0 ? 8 : 0)}%`,
                                    background: colorFn ? colorFn(i) : 'var(--gradient-primary)',
                                    opacity: active ? 1 : 0.85,
                                }}>
                                    <span className="bar-fill-value" style={{ fontSize: '0.72rem' }}>{value}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const StatCard = ({ icon, count, label, color, filterType, filterValue }) => {
        const active = isActive(filterType, filterValue);
        return (
            <div className="card stat-card-lg"
                onClick={() => count > 0 && handleFilter(filterType, filterValue)}
                style={{
                    cursor: count > 0 ? 'pointer' : 'default',
                    outline: active ? `2px solid ${color}` : 'none',
                    background: active ? `color-mix(in srgb, ${color} 8%, var(--color-surface))` : undefined,
                }}>
                {icon}
                <div className="stat-card-lg-value" style={{ color }}>{count}</div>
                <div className="stat-card-lg-label">{label}</div>
            </div>
        );
    };

    if (loading) return <div className="empty-state" style={{ padding: '3rem' }}>{t('common.loading')}</div>;

    return (
        <div className="flex-col gap-125 pb-3" style={{ display: 'flex' }}>
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-05">
                <h1 className="text-3xl fw-800 text-primary flex items-center gap-05" style={{ margin: 0 }}>
                    <BarChart3 size={24} /> {t('dashboard.title')}
                </h1>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-sm" onClick={() => setShowAdvSearch(!showAdvSearch)}
                        style={{ background: showAdvSearch ? 'rgba(14,165,233,0.1)' : 'var(--color-surface)', border: `1px solid ${showAdvSearch ? 'var(--color-primary)' : 'var(--color-border)'}`, color: showAdvSearch ? 'var(--color-primary)' : 'var(--color-text)' }}>
                        <SlidersHorizontal size={14} /> {t('advSearch.title')}
                    </button>
                    <Link to="/" className="btn btn-secondary btn-sm"><ArrowLeft size={14} /> {t('nav.home')}</Link>
                </div>
            </div>

            {/* Advanced Search Panel */}
            {showAdvSearch && (
                <div className="card animate-slide-down" style={{ borderColor: 'var(--color-primary)' }}>
                    <h4 style={{ margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-primary)' }}>
                        <Search size={16} /> {t('advSearch.title')}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                        <div className="input-group">
                            <label className="input-label">{t('advSearch.from')}</label>
                            <input type="date" className="input-field" value={searchDateFrom} onChange={e => setSearchDateFrom(e.target.value)} />
                        </div>
                        <div className="input-group">
                            <label className="input-label">{t('advSearch.to')}</label>
                            <input type="date" className="input-field" value={searchDateTo} onChange={e => setSearchDateTo(e.target.value)} />
                        </div>
                        <div className="input-group">
                            <label className="input-label">{t('advSearch.antibioticLabel')}</label>
                            <input className="input-field" placeholder="e.g. Ampicillin" value={searchAntibiotic} onChange={e => setSearchAntibiotic(e.target.value)} />
                        </div>
                        <div className="input-group">
                            <label className="input-label">{t('advSearch.evalResultLabel')}</label>
                            <select className="input-field" value={searchEvalResult} onChange={e => setSearchEvalResult(e.target.value)}>
                                <option value="">{t('common.all')}</option>
                                <option value="ĐỎ">{t('evalOptions.red')}</option>
                                <option value="VÀNG">{t('evalOptions.yellow')}</option>
                                <option value="XANH">{t('evalOptions.green')}</option>
                                <option value="XUẤT VIỆN">{t('evalOptions.discharge')}</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                        <button className="btn btn-sm" onClick={() => { setSearchDateFrom(''); setSearchDateTo(''); setSearchAntibiotic(''); setSearchEvalResult(''); }}>
                            {t('home.clearFilter')}
                        </button>
                        <button className="btn btn-sm" onClick={handleSaveFilter} style={{ background: 'rgba(14,165,233,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(14,165,233,0.2)' }}>
                            <BookmarkPlus size={14} /> {t('advSearch.saveFilter')}
                        </button>
                    </div>

                    {/* Saved Filters */}
                    {savedFilters.length > 0 && (
                        <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
                            <h5 style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '0 0 0.5rem' }}>
                                <Bookmark size={12} /> {t('advSearch.savedFilters')}
                            </h5>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {savedFilters.map((f, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', padding: '0.2rem 0.5rem', background: 'var(--color-surface-raised)', borderRadius: '999px', fontSize: '0.78rem' }}>
                                        <button onClick={() => handleApplyFilter(f)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 600 }}>{f.name}</button>
                                        <button onClick={() => handleDeleteFilter(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: 0 }}><X size={12} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Time Range Filter */}
            <div className="flex gap-05">
                {[
                    { key: 'all', label: t('common.all') },
                    { key: 'month', label: t('dashboard.monthFilter') },
                    { key: 'week', label: t('dashboard.weekFilter') },
                ].map(tr => (
                    <button key={tr.key} className="btn btn-sm" onClick={() => { setTimeRange(tr.key); setActiveFilter(null); }}
                        style={{
                            background: timeRange === tr.key ? 'rgba(14,165,233,0.1)' : 'var(--color-surface)',
                            border: `1.5px solid ${timeRange === tr.key ? 'var(--color-primary)' : 'var(--color-border)'}`,
                            color: timeRange === tr.key ? 'var(--color-primary)' : 'var(--color-text)',
                        }}>
                        {tr.label}
                    </button>
                ))}
            </div>

            {/* Summary Cards */}
            <div className="action-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                <StatCard icon={<FileText size={24} color="var(--color-primary)" style={{ margin: '0 auto 0.5rem' }} />} count={stats.totalPatients} label={t('dashboard.totalCases')} color="var(--color-primary)" filterType="status" filterValue="all" />
                <StatCard icon={<AlertTriangle size={24} color="var(--color-danger)" style={{ margin: '0 auto 0.5rem' }} />} count={stats.urgentCount} label={t('dashboard.overdue')} color="var(--color-danger)" filterType="status" filterValue="urgent" />
                <StatCard icon={<Clock size={24} color="var(--color-warning)" style={{ margin: '0 auto 0.5rem' }} />} count={stats.pendingCount} label={t('dashboard.pending')} color="var(--color-warning)" filterType="status" filterValue="pending" />
                <StatCard icon={<CheckCircle2 size={24} color="var(--color-success)" style={{ margin: '0 auto 0.5rem' }} />} count={stats.doneCount} label={t('dashboard.completed')} color="var(--color-success)" filterType="status" filterValue="done" />
            </div>

            {/* Trend Chart — Admissions per day (last 7 days) */}
            <div className="card">
                <h3 className="section-title">
                    <TrendingUp size={18} color="var(--color-primary)" /> {t('trend.title')} — {t('trend.last7days')}
                </h3>
                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'flex-end', height: '120px', marginTop: '0.5rem' }}>
                    {trendData.map((d, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text)' }}>{d.total}</span>
                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                <div style={{ height: `${Math.max((d.catA / trendMax) * 80, d.catA > 0 ? 4 : 0)}px`, background: 'var(--color-danger)', borderRadius: '3px 3px 0 0', transition: 'height 0.3s ease' }} title={`A: ${d.catA}`} />
                                <div style={{ height: `${Math.max((d.catB / trendMax) * 80, d.catB > 0 ? 4 : 0)}px`, background: 'var(--color-warning)', borderRadius: '0 0 3px 3px', transition: 'height 0.3s ease' }} title={`B: ${d.catB}`} />
                            </div>
                            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>{d.label}</span>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.5rem', fontSize: '0.75rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--color-danger)' }} /> {t('dashboard.categoryA')}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--color-warning)' }} /> {t('dashboard.categoryB')}</span>
                </div>
                {avgEvalTime && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
                        ⏱ {t('trend.avgTime')}: <strong style={{ color: 'var(--color-primary)' }}>{avgEvalTime}</strong>
                    </div>
                )}
            </div>

            {/* Completion Rate */}
            <div className="card">
                <h3 className="section-title">
                    <TrendingUp size={18} color="var(--color-primary)" /> {t('dashboard.completionRate')}
                </h3>
                <div className="progress-track progress-track-md">
                    <div className={`progress-fill ${stats.completionRate >= 80 ? 'progress-fill--success' : stats.completionRate >= 50 ? 'progress-fill--warning' : 'progress-fill--danger'}`}
                        style={{ width: `${stats.completionRate}%` }}>
                        <span className="progress-label progress-label-md">{stats.completionRate}%</span>
                    </div>
                </div>
                <p className="text-sm2 text-muted" style={{ marginTop: '0.4rem' }}>{t('dashboard.patientsEvaluated', { done: stats.doneCount, total: stats.totalPatients })}</p>
            </div>

            {/* Diagnosis Distribution */}
            {stats.totalPatients > 0 && (
                <div className="card">
                    <h3 className="section-title"><Activity size={18} color="var(--color-warning)" /> {t('dashboard.diagnosisDistribution')}</h3>
                    <div className="flex gap-1">
                        <div onClick={() => stats.diagA > 0 && handleFilter('diagnosis', 'A')}
                            className={`diag-box diag-box-lg diag-box--a ${isActive('diagnosis', 'A') ? 'diag-box--a-active' : ''}`}
                            style={{ cursor: stats.diagA > 0 ? 'pointer' : 'default' }}>
                            <div className="diag-value diag-value-lg text-danger">{stats.diagA}</div>
                            <div className="text-base fw-700 text-danger">{t('dashboard.categoryA')}</div>
                            <div className="text-sm text-muted">{t('dashboard.needAbx')}</div>
                        </div>
                        <div onClick={() => stats.diagB > 0 && handleFilter('diagnosis', 'B')}
                            className={`diag-box diag-box-lg diag-box--b ${isActive('diagnosis', 'B') ? 'diag-box--b-active' : ''}`}
                            style={{ cursor: stats.diagB > 0 ? 'pointer' : 'default' }}>
                            <div className="diag-value diag-value-lg text-warning">{stats.diagB}</div>
                            <div className="text-base fw-700 text-warning">{t('dashboard.categoryB')}</div>
                            <div className="text-sm text-muted">{t('dashboard.monitor')}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* GA Distribution */}
            {stats.totalPatients > 0 && (
                <div className="card">
                    <h3 className="section-title"><Calendar size={18} color="var(--color-primary)" /> {t('dashboard.gaDistribution')}</h3>
                    <BarChart data={gaStats} filterType="ga"
                        colorFn={(i) => ['var(--gradient-danger)', 'linear-gradient(135deg, #f97316, #f59e0b)', 'linear-gradient(135deg, #0ea5e9, #38bdf8)', 'var(--gradient-success)'][i]} />
                </div>
            )}

            {/* Weight Distribution */}
            {stats.totalPatients > 0 && (
                <div className="card">
                    <h3 className="section-title"><TrendingUp size={18} color="var(--color-success)" /> {t('dashboard.weightDistribution')}</h3>
                    <BarChart data={weightStats} filterType="weight" />
                </div>
            )}

            {/* Antibiotic Stats */}
            {antibioticStats.length > 0 && (
                <div className="card">
                    <h3 className="section-title"><Pill size={18} color="var(--color-primary)" /> {t('dashboard.antibioticProtocol')}</h3>
                    <BarChart data={antibioticStats} filterType="antibiotic" />
                </div>
            )}

            {/* Tags */}
            {tagStats.length > 0 && (
                <div className="card">
                    <h3 className="section-title">{t('dashboard.popularTags')}</h3>
                    <div className="flex flex-wrap gap-05">
                        {tagStats.map(([tag, count]) => (
                            <span key={tag} onClick={() => handleFilter('tag', tag)}
                                className={`tag-pill tag-pill--clickable ${isActive('tag', tag) ? 'tag-pill--active' : ''}`}
                                style={{ padding: '0.3rem 0.75rem', fontSize: '0.82rem' }}>
                                #{tag} <span className="text-sm text-muted fw-700">×{count}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Filtered Patient List */}
            <div ref={listRef} style={{ scrollMarginTop: '1rem' }}>
                {activeFilter && (
                    <div className="filter-badge animate-slide-up" style={{ padding: '0.6rem 1rem' }}>
                        <Filter size={14} color="var(--color-primary)" />
                        <span className="filter-badge-label" style={{ fontSize: '0.85rem' }}>{t('dashboard.filterActive')}: {getFilterLabel(activeFilter, t)}</span>
                        <span className="filter-badge-count" style={{ fontSize: '0.82rem' }}>— {displayedPatients.length} {t('common.cases')}</span>
                        <button onClick={() => setActiveFilter(null)} className="filter-clear-btn" style={{ padding: '0.2rem' }} title={t('home.clearFilter')}><X size={16} /></button>
                    </div>
                )}

                <div className="flex items-center gap-05 mb-075">
                    <h3 className="text-lg fw-700 flex items-center gap-04" style={{ margin: 0 }}>
                        <User size={16} color="var(--color-text-muted)" /> {t('dashboard.patientList')}
                    </h3>
                    <span className="count-pill">{displayedPatients.length}</span>
                </div>

                {displayedPatients.length > 0 ? (
                    <div className="flex-col gap-05" style={{ display: 'flex' }}>
                        {displayedPatients.map(p => {
                            const hours = differenceInHours(new Date(), new Date(p.admissionTime || p.createdAt));
                            const isUrgent = !p.evaluationResult && hours >= 24;
                            const isDone = !!p.evaluationResult;

                            return (
                                <Link to={`/reevaluation/${p.id}`} key={p.id} className="card patient-link"
                                    style={{ borderLeft: `4px solid ${isUrgent ? 'var(--color-danger)' : isDone ? 'var(--color-success)' : 'var(--color-warning)'}` }}>
                                    <div className={`icon-circle ${isUrgent ? 'icon-circle--danger' : isDone ? 'icon-circle--success' : 'icon-circle--warning'}`}>
                                        {isUrgent ? <AlertTriangle size={16} color="var(--color-danger)" /> : isDone ? <CheckCircle2 size={16} color="var(--color-success)" /> : <Clock size={16} color="var(--color-warning)" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-04 flex-wrap">
                                            <span className="fw-700 text-lg">{p.id}</span>
                                            <span className="patient-diag-badge" style={{ background: p.diagnosis === 'A' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: p.diagnosis === 'A' ? 'var(--color-danger)' : 'var(--color-warning)' }}>{p.diagnosis}</span>
                                        </div>
                                        <div className="patient-meta">
                                            <span>{p.weight}g</span>
                                            <span>{p.gestationalAge}w</span>
                                            <span>{hours}h</span>
                                            {p.antibioticGroup?.rec && <span className="truncate" style={{ maxWidth: '120px' }}>{p.antibioticGroup.rec}</span>}
                                        </div>
                                        {(p.tags || []).length > 0 && (
                                            <div className="flex gap-025 flex-wrap mt-025">
                                                {p.tags.slice(0, 3).map((tag, i) => (<span key={i} className="tag-pill" style={{ fontSize: '0.65rem', padding: '0.05rem 0.35rem' }}>#{tag}</span>))}
                                                {p.tags.length > 3 && <span className="text-xs text-muted">+{p.tags.length - 3}</span>}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        {isDone ? (<span className="text-sm fw-700 text-success">{t('dashboard.evaluated')}</span>) :
                                            isUrgent ? (<span className="text-sm fw-700 text-danger">{t('dashboard.overdueLabel')}</span>) :
                                                (<span className="text-sm fw-600 text-muted">{t('dashboard.waitingEval')}</span>)}
                                        <div className="text-2xs text-muted mt-025">{p.createdAt && format(new Date(p.createdAt), 'dd/MM')}</div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                ) : (
                    <div className="empty-state">
                        {activeFilter ? (
                            <>
                                <Filter size={32} className="empty-state-icon" />
                                <p className="fw-600 text-md">{t('dashboard.noFilterMatch', { filter: getFilterLabel(activeFilter, t) })}</p>
                                <button onClick={() => setActiveFilter(null)} className="btn btn-secondary btn-sm mt-05">{t('home.clearFilter')}</button>
                            </>
                        ) : (
                            <>
                                <BarChart3 size={48} className="empty-state-icon" />
                                <p className="fw-600">{t('dashboard.noData')}</p>
                                <p className="text-base">{t('dashboard.noDataDesc')}</p>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
