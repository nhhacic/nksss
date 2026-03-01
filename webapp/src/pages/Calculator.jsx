import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatient } from '../context/PatientContext';
import { useTranslation } from '../i18n/LanguageContext';
import { Calculator, Lightbulb } from 'lucide-react';

const ANTIBIOTICS = [
    "Ampicillin", "Gentamycin", "Tobramycin", "Amikacin", "Cefotaxim", "Cefepim", "Meropenem", "Vancomycin"
];

// Smart suggestion: recommends antibiotics based on the chosen phác đồ
function getSuggestedMeds(antibioticGroup) {
    if (!antibioticGroup) return [];
    const groupId = antibioticGroup.id;
    // Phác đồ 1: Ampicillin + Gentamycin (first-line)
    if (groupId === 1) return ['Ampicillin', 'Gentamycin'];
    // Phác đồ 2: Ampicillin + Aminoglycosid + Cefotaxim (viêm màng não)
    if (groupId === 2) return ['Ampicillin', 'Gentamycin', 'Cefotaxim'];
    // Phác đồ 3: Meropenem + Aminoglycosid + Vancomycin (NK đe doạ tính mạng)
    if (groupId === 3) return ['Meropenem', 'Gentamycin', 'Vancomycin'];
    // Phác đồ 4: Cefotaxim đơn độc (NKSS sớm + bệnh não thiếu oxy / suy thận)
    if (groupId === 4) return ['Cefotaxim'];
    // Phác đồ 5: Theo kháng sinh đồ — không gợi ý
    return [];
}

// Logic dựa theo Bảng phụ lục "Kháng sinh" - "Tuổi hiệu chỉnh(tuần)" - "Tuổi sau sinh(ngày)"
function calculateDosage(drug, weightGrams, ga, postnatalDays, isSevere) {
    let dose = 0; // mg/kg
    let interval = 0; // hours (khoảng đưa liều)
    let extraInfo = '';

    const w = weightGrams / 1000; // in kg

    if (drug === "Ampicillin") {
        if (isSevere) { dose = 100; interval = 8; }
        else if (ga <= 29) { dose = 50; interval = postnatalDays <= 28 ? 12 : 8; }
        else if (ga >= 30 && ga <= 36) { dose = 50; interval = postnatalDays <= 14 ? 12 : 8; }
        else if (ga >= 37) { dose = 50; interval = postnatalDays <= 7 ? 12 : 8; }
        else { dose = 50; interval = 8; }
    }
    else if (drug === "Gentamycin") {
        if (ga < 30) { dose = 5; interval = postnatalDays <= 14 ? 48 : 36; }
        else if (ga >= 30 && ga <= 34) { dose = 5; interval = postnatalDays <= 10 ? 36 : 24; }
        else { dose = 5; interval = 24; }
    }
    else if (drug === "Tobramycin") {
        if (ga < 32) { dose = 4; interval = postnatalDays < 7 ? 48 : 24; }
        else if (ga >= 32 && ga <= 36) { dose = 4; interval = postnatalDays < 7 ? 36 : 24; }
        else { dose = postnatalDays <= 28 ? 4 : 5; interval = 24; }
    }
    else if (drug === "Amikacin") {
        if (ga < 30) { dose = postnatalDays <= 7 ? 14 : 12; interval = postnatalDays <= 7 ? 48 : (postnatalDays <= 28 ? 36 : 24); }
        else if (ga >= 30 && ga <= 34) { dose = 12; interval = postnatalDays <= 7 ? 36 : 24; }
        else { dose = 12; interval = 24; }
    }
    else if (drug === "Cefotaxim") {
        if (isSevere) { dose = 50; interval = postnatalDays < 7 ? 12 : 8; }
        else if (ga < 32) { dose = 50; interval = postnatalDays < 14 ? 12 : 8; }
        else { dose = 50; interval = postnatalDays < 7 ? 12 : 8; }
    }
    else if (drug === "Cefepim") {
        dose = ga <= 28 ? 30 : 50; interval = 12;
        if (isSevere) { dose = 50; interval = 12; }
    }
    else if (drug === "Meropenem") {
        if (isSevere) { dose = 40; interval = 8; }
        else if (ga < 32) { dose = 20; interval = postnatalDays <= 14 ? 12 : 8; }
        else { dose = postnatalDays <= 14 ? 20 : 30; interval = 8; }
    }
    else if (drug === "Vancomycin") {
        if (ga <= 29) { dose = 15; interval = postnatalDays <= 14 ? 18 : 12; extraInfo = postnatalDays <= 14 ? "(định lượng trước mũi 2)" : "(định lượng trước mũi 3)"; }
        else if (ga >= 30 && ga <= 36) { dose = 15; interval = postnatalDays <= 14 ? 12 : 8; extraInfo = postnatalDays <= 14 ? "(định lượng trước mũi 3)" : "(định lượng trước mũi 4)"; }
        else { dose = 15; interval = postnatalDays <= 7 ? 12 : 8; extraInfo = postnatalDays <= 7 ? "(định lượng trước mũi 3)" : "(định lượng trước mũi 4)"; }
    }

    const finalDose = dose * w;
    return { unitDose: dose, totalDose: finalDose.toFixed(1), interval, extraInfo };
}

export default function DosageCalculator() {
    const navigate = useNavigate();
    const { patient, updatePatient } = usePatient();
    const [selectedMeds, setSelectedMeds] = useState([]);
    const [isSevere, setIsSevere] = useState(patient.antibioticGroup?.id === 2 || patient.antibioticGroup?.id === 3);
    const { t } = useTranslation();

    const suggestedMeds = useMemo(() => getSuggestedMeds(patient.antibioticGroup), [patient.antibioticGroup]);

    const toggleMed = (med) => {
        setSelectedMeds(prev => prev.includes(med) ? prev.filter(m => m !== med) : [...prev, med]);
    };

    const applySuggestions = () => {
        setSelectedMeds([...suggestedMeds]);
    };

    const currentDoses = selectedMeds.map(med => ({
        med,
        ...calculateDosage(med, patient.weight, patient.gestationalAge, patient.ageDays, isSevere)
    }));

    const handleNext = () => {
        updatePatient({
            antibiotic: selectedMeds,
            doses: currentDoses,
            // Add timeline event for treatment selection
            timeline: [
                ...(patient.timeline || []),
                {
                    type: 'treatment',
                    action: `Chọn KS: ${selectedMeds.join(', ')}${isSevere ? ' (nặng)' : ''}`,
                    timestamp: new Date().toISOString(),
                }
            ]
        });
        navigate('/review');
    };

    return (
        <div className="card">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calculator size={24} color="var(--color-primary)" />
                {t('calculator.title')}
            </h2>

            <div style={{ padding: '1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                <div><small style={{ color: 'var(--color-text-muted)' }}>{t('calculator.weightLabel')}</small><br /><strong>{patient.weight} g</strong></div>
                <div><small style={{ color: 'var(--color-text-muted)' }}>{t('calculator.gaLabel')}</small><br /><strong>{patient.gestationalAge} {t('common.weeks')}</strong></div>
                <div><small style={{ color: 'var(--color-text-muted)' }}>{t('calculator.postnatalAge')}</small><br /><strong>{patient.ageDays} {t('calculator.days')}</strong></div>
                <div><small style={{ color: 'var(--color-text-muted)' }}>{t('calculator.selectedProtocol')}</small><br /><strong>{patient.antibioticGroup?.rec || t('calculator.notSelected')}</strong></div>
            </div>

            {/* Smart Suggestion */}
            {suggestedMeds.length > 0 && selectedMeds.length === 0 && (
                <div className="animate-slide-up" style={{
                    padding: '0.875rem 1rem',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                }}>
                    <Lightbulb size={18} color="var(--color-success)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--color-success)' }}>
                            {t('calculator.suggestion')}: {suggestedMeds.join(' + ')}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
                            {t('calculator.basedOnProtocol')} ({patient.antibioticGroup?.rec})
                        </div>
                    </div>
                    <button
                        className="btn"
                        onClick={applySuggestions}
                        style={{
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            background: 'var(--gradient-success)',
                            color: 'white',
                            border: 'none',
                            boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
                        }}
                    >
                        {t('calculator.applySuggestion')}
                    </button>
                </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ marginBottom: '0.5rem' }}>{t('calculator.selectAntibiotics')}:</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {ANTIBIOTICS.map(med => (
                        <button
                            key={med}
                            className={`btn ${selectedMeds.includes(med) ? 'btn-primary' : 'btn-secondary'}`}
                            style={{
                                padding: '0.5rem 1rem',
                                position: 'relative',
                            }}
                            onClick={() => toggleMed(med)}
                        >
                            {med}
                            {suggestedMeds.includes(med) && !selectedMeds.includes(med) && (
                                <span style={{
                                    position: 'absolute', top: '-6px', right: '-6px',
                                    background: 'var(--color-success)',
                                    color: 'white',
                                    fontSize: '0.6rem',
                                    fontWeight: 800,
                                    padding: '0.1rem 0.35rem',
                                    borderRadius: '999px',
                                    lineHeight: 1.2,
                                }}>
                                    {t('calculator.suggested')}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                <label className="checkbox-item" style={{ marginTop: '1rem', display: 'inline-flex' }}>
                    <input type="checkbox" checked={isSevere} onChange={e => setIsSevere(e.target.checked)} />
                    <span className="checkbox-label" style={{ color: 'var(--color-danger)' }}>{t('calculator.severeInfection')}</span>
                </label>
            </div>

            {currentDoses.length > 0 && (
                <div style={{ background: 'var(--color-surface)', border: '2px dashed var(--color-primary)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
                    <h3 style={{ color: 'var(--color-primary)', marginBottom: '1rem' }}>{t('calculator.orderSummary')}:</h3>
                    {currentDoses.map((d, i) => (
                        <div key={i} style={{ padding: '1rem', borderBottom: i < currentDoses.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>{d.med}</div>
                            <div style={{ fontSize: '1.5rem', margin: '0.5rem 0' }}>
                                <strong style={{ color: 'var(--color-text)' }}>{d.totalDose} mg</strong> / {t('calculator.every')} {d.interval} {t('common.hours')}
                            </div>
                            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                                ({t('calculator.standardDose')}: {d.unitDose} mg/kg x {patient.weight / 1000} kg) {d.extraInfo}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                <button className="btn btn-secondary" onClick={() => navigate(-1)}>
                    &larr; {t('common.back')}
                </button>
                <button className="btn btn-primary" onClick={handleNext} disabled={selectedMeds.length === 0}>
                    {t('calculator.reviewAndSave')}
                </button>
            </div>
        </div>
    );
}
