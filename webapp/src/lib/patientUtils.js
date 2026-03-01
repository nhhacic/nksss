import { differenceInHours } from 'date-fns';

/**
 * Shared patient filter logic used by Home.jsx and Dashboard.jsx
 */
export function matchesPatientFilter(patient, filter) {
    if (!filter) return true;
    const { type, value } = filter;

    if (type === 'status') {
        const h = differenceInHours(new Date(), new Date(patient.admissionTime || patient.createdAt));
        if (value === 'urgent') return !patient.evaluationResult && h >= 24;
        if (value === 'pending') return !patient.evaluationResult && h < 24;
        if (value === 'done') return !!patient.evaluationResult;
        return true; // 'all'
    }
    if (type === 'diagnosis') return patient.diagnosis === value;
    if (type === 'ga') {
        const ga = parseInt(patient.gestationalAge);
        if (isNaN(ga)) return false;
        if (value === '<28') return ga < 28;
        if (value === '28-32') return ga >= 28 && ga <= 32;
        if (value === '33-36') return ga >= 33 && ga <= 36;
        if (value === '37+') return ga >= 37;
    }
    if (type === 'weight') {
        const w = parseInt(patient.weight);
        if (isNaN(w)) return false;
        if (value === '<1000g') return w < 1000;
        if (value === '1-1.5kg' || value === '1000-1500g') return w >= 1000 && w <= 1500;
        if (value === '1.5-2.5kg' || value === '1500-2500g') return w > 1500 && w <= 2500;
        if (value === '>2.5kg' || value === '>2500g') return w > 2500;
    }
    if (type === 'antibiotic') return patient.antibioticGroup?.label === value;
    if (type === 'tag') return (patient.tags || []).includes(value);
    return true;
}

/**
 * Get a human-readable label for a filter
 */
export function getFilterLabel(filter, t) {
    if (!filter) return '';
    const { type, value } = filter;
    if (type === 'status') {
        if (value === 'urgent') return t('dashboard.overdueLabel');
        if (value === 'pending') return t('dashboard.pending');
        if (value === 'done') return t('dashboard.completed');
        return t('common.all');
    }
    if (type === 'diagnosis') return `${t('diagnosis.title').split(' ')[0]} ${value}`;
    if (type === 'ga') return `${t('home.gestationalAge')} ${value}`;
    if (type === 'weight') return `${t('home.weight')} ${value}`;
    if (type === 'antibiotic') return value;
    if (type === 'tag') return `#${value}`;
    return value;
}

/**
 * Compute patient stats from an array of patients
 */
export function computePatientStats(patients) {
    const now = new Date();
    const urgentCount = patients.filter(p => !p.evaluationResult && differenceInHours(now, new Date(p.admissionTime || p.createdAt)) >= 24).length;
    const pendingCount = patients.filter(p => !p.evaluationResult && differenceInHours(now, new Date(p.admissionTime || p.createdAt)) < 24).length;
    const doneCount = patients.filter(p => !!p.evaluationResult).length;
    const totalPatients = patients.length;
    const completionRate = totalPatients > 0 ? Math.round((doneCount / totalPatients) * 100) : 0;
    const diagA = patients.filter(p => p.diagnosis === 'A').length;
    const diagB = patients.filter(p => p.diagnosis === 'B').length;

    return { urgentCount, pendingCount, doneCount, totalPatients, completionRate, diagA, diagB };
}

/**
 * Compute gestational age distribution
 */
export function computeGAStats(patients) {
    const ranges = { '<28': 0, '28-32': 0, '33-36': 0, '37+': 0 };
    patients.forEach(p => {
        const ga = parseInt(p.gestationalAge);
        if (isNaN(ga)) return;
        if (ga < 28) ranges['<28']++;
        else if (ga <= 32) ranges['28-32']++;
        else if (ga <= 36) ranges['33-36']++;
        else ranges['37+']++;
    });
    return Object.entries(ranges);
}

/**
 * Compute weight distribution
 */
export function computeWeightStats(patients) {
    const ranges = { '<1000g': 0, '1000-1500g': 0, '1500-2500g': 0, '>2500g': 0 };
    patients.forEach(p => {
        const w = parseInt(p.weight);
        if (isNaN(w)) return;
        if (w < 1000) ranges['<1000g']++;
        else if (w <= 1500) ranges['1000-1500g']++;
        else if (w <= 2500) ranges['1500-2500g']++;
        else ranges['>2500g']++;
    });
    return Object.entries(ranges);
}

/**
 * Compute antibiotic usage stats
 */
export function computeAntibioticStats(patients) {
    const map = {};
    patients.forEach(p => {
        if (p.antibioticGroup?.label) {
            const key = p.antibioticGroup.label;
            map[key] = (map[key] || 0) + 1;
        }
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

/**
 * Compute tag frequency stats
 */
export function computeTagStats(patients) {
    const map = {};
    patients.forEach(p => {
        (p.tags || []).forEach(tag => {
            map[tag] = (map[tag] || 0) + 1;
        });
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

/**
 * Get priority for sorting patients (1 = urgent, 2 = pending, 3 = done)
 */
export function getPatientPriority(patient) {
    if (patient.evaluationResult) return 3;
    const hours = differenceInHours(new Date(), new Date(patient.admissionTime || patient.createdAt));
    if (hours >= 24) return 1;
    return 2;
}

/**
 * Check if a patient's dose needs adjustment based on age thresholds
 * Returns array of drugs that need dose recalculation
 */
export function checkDoseAdjustmentNeeded(patient) {
    if (!patient.doses || !patient.ageDays || !patient.gestationalAge) return [];
    const ga = parseInt(patient.gestationalAge);
    const days = patient.ageDays;
    const alerts = [];

    // Age thresholds where doses change
    const thresholds = {
        'Ampicillin': ga <= 29 ? [28] : ga <= 36 ? [14] : [7],
        'Gentamycin': ga < 30 ? [14] : ga <= 34 ? [10] : [],
        'Tobramycin': [7, 28],
        'Amikacin': ga < 30 ? [7, 28] : ga <= 34 ? [7] : [],
        'Cefotaxim': ga < 32 ? [14] : [7],
        'Cefepim': [],
        'Meropenem': [14],
        'Vancomycin': ga <= 29 ? [14] : ga <= 36 ? [14] : [7],
    };

    (patient.doses || []).forEach(d => {
        const drugThresholds = thresholds[d.med] || [];
        drugThresholds.forEach(threshold => {
            // Alert if patient age is within 1 day of threshold
            if (Math.abs(days - threshold) <= 1) {
                alerts.push({
                    drug: d.med,
                    threshold,
                    message: `${d.med}: kiểm tra liều tại ngày tuổi ${threshold}`,
                });
            }
        });
    });

    return alerts;
}

/**
 * Calculate recommended antibiotic duration based on clinical criteria
 */
export function getRecommendedDuration(patient) {
    if (!patient) return null;

    const { cultureResult, cultureGram, infectionEvidence, crpLevel, clinicalStatus, hasMeningitis } = patient.labData || {};

    // Based on the clinical protocol table
    if (cultureResult === 'negative') {
        if (infectionEvidence === 'weak' && clinicalStatus === 'stable' && crpLevel === 'low') {
            return { days: '3-5', reason: 'Cấy âm tính, bằng chứng NK yếu, lâm sàng ổn, CRP < 10' };
        }
        if (infectionEvidence === 'clear' || crpLevel === 'high') {
            return { days: '7-10', reason: 'Cấy âm tính nhưng bằng chứng NK rõ hoặc CRP ≥ 10' };
        }
    }
    if (cultureResult === 'positive') {
        if (cultureGram === 'positive' || clinicalStatus === 'unstable') {
            return { days: '14', reason: 'Cấy dương tính, gram dương hoặc lâm sàng không ổn' };
        }
        if (cultureGram === 'negative' || hasMeningitis) {
            return { days: '14-21', reason: 'Cấy dương tính gram âm hoặc viêm màng não' };
        }
    }
    return null;
}
