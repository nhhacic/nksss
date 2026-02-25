import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatient } from '../context/PatientContext';
import { Calculator } from 'lucide-react';

const ANTIBIOTICS = [
    "Ampicillin", "Gentamycin", "Tobramycin", "Amikacin", "Cefotaxim", "Cefepim", "Meropenem", "Vancomycin"
];

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
        else { dose = 50; interval = 8; } // default
    }
    else if (drug === "Gentamycin") {
        if (ga < 30) { dose = postnatalDays <= 14 ? 5 : 5; interval = postnatalDays <= 14 ? 48 : 36; }
        else if (ga >= 30 && ga <= 34) { dose = 5; interval = postnatalDays <= 10 ? 36 : 24; }
        else { dose = 5; interval = 24; }
    }
    else if (drug === "Tobramycin") {
        if (ga < 32) { dose = postnatalDays < 7 ? 4 : 4; interval = postnatalDays < 7 ? 48 : 24; }
        else if (ga >= 32 && ga <= 36) { dose = 4; interval = postnatalDays < 7 ? 36 : 24; }
        else { dose = postnatalDays <= 28 ? 4 : 5; interval = 24; }
    }
    else if (drug === "Amikacin") {
        if (ga < 30) { dose = postnatalDays <= 7 ? 14 : 12; interval = postnatalDays <= 7 ? 48 : (postnatalDays <= 28 ? 36 : 24); }
        else if (ga >= 30 && ga <= 34) { dose = 12; interval = postnatalDays <= 7 ? 36 : 24; }
        else { dose = 12; interval = 24; }
    }
    else if (drug === "Cefotaxim") {
        if (isSevere) { dose = 50; interval = postnatalDays < 7 ? 12 : 8; } // NOTE: Bảng ghi 8-12 tuỳ, chọn cơ bản
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

    const toggleMed = (med) => {
        setSelectedMeds(prev => prev.includes(med) ? prev.filter(m => m !== med) : [...prev, med]);
    };

    const currentDoses = selectedMeds.map(med => ({
        med,
        ...calculateDosage(med, patient.weight, patient.gestationalAge, patient.ageDays, isSevere)
    }));

    const handleNext = () => {
        updatePatient({ antibiotic: selectedMeds, doses: currentDoses });
        // TODO: Follow-up component
        navigate('/review');
    };

    return (
        <div className="card">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calculator size={24} color="var(--color-primary)" />
                Bảng Tính Liều Tự Động
            </h2>

            <div style={{ padding: '1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                <div><small style={{ color: 'var(--color-text-muted)' }}>Cân nặng</small><br /><strong>{patient.weight} g</strong></div>
                <div><small style={{ color: 'var(--color-text-muted)' }}>Tuổi thai</small><br /><strong>{patient.gestationalAge} tuần</strong></div>
                <div><small style={{ color: 'var(--color-text-muted)' }}>Tuổi sau sinh</small><br /><strong>{patient.ageDays} ngày</strong></div>
                <div><small style={{ color: 'var(--color-text-muted)' }}>Phác đồ chọn</small><br /><strong>{patient.antibioticGroup?.rec || "Chưa chọn"}</strong></div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ marginBottom: '0.5rem' }}>Chọn kháng sinh thực tế áp dụng:</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {ANTIBIOTICS.map(med => (
                        <button key={med} className={`btn ${selectedMeds.includes(med) ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '0.5rem 1rem' }} onClick={() => toggleMed(med)}>
                            {med}
                        </button>
                    ))}
                </div>

                <label className="checkbox-item" style={{ marginTop: '1rem', display: 'inline-flex' }}>
                    <input type="checkbox" checked={isSevere} onChange={e => setIsSevere(e.target.checked)} />
                    <span className="checkbox-label" style={{ color: 'var(--color-danger)' }}>Nhiễm khuẩn nặng / Viêm màng não</span>
                </label>
            </div>

            {currentDoses.length > 0 && (
                <div style={{ background: 'var(--color-surface)', border: '2px dashed var(--color-primary)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
                    <h3 style={{ color: 'var(--color-primary)', marginBottom: '1rem' }}>Tổng Hợp Y Lệnh:</h3>
                    {currentDoses.map((d, i) => (
                        <div key={i} style={{ padding: '1rem', borderBottom: i < currentDoses.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>{d.med}</div>
                            <div style={{ fontSize: '1.5rem', margin: '0.5rem 0' }}>
                                <strong style={{ color: 'var(--color-text)' }}>{d.totalDose} mg</strong> / mỗi {d.interval} giờ
                            </div>
                            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                                (Liều chuẩn: {d.unitDose} mg/kg x {patient.weight / 1000} kg) {d.extraInfo}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                <button className="btn btn-secondary" onClick={() => navigate(-1)}>
                    &larr; Quay lại
                </button>
                <button className="btn btn-primary" onClick={handleNext} disabled={selectedMeds.length === 0}>
                    Xem lại và Lưu hồ sơ &rarr;
                </button>
            </div>
        </div>
    );
}
