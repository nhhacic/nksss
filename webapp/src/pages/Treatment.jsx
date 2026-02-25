import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatient } from '../context/PatientContext';
import { Stethoscope } from 'lucide-react';

const ANTIBIOTIC_GROUPS = [
    { id: 1, label: "Nhiễm khuẩn sơ sinh", rec: "Ampicillin + Aminoglycosid" },
    { id: 2, label: "Nghi ngờ viêm màng não", rec: "Ampicillin + Aminoglycosid + Cefotaxim/Cefepim" },
    { id: 3, label: "NK đe doạ tính mạng (sốc, thở máy, toàn trạng suy sụp...)", rec: "Meropenem +/- Aminoglycosid +/- Vancomycin" },
    { id: 4, label: "NKSS sớm + Bệnh não thiếu oxy / Suy thận", rec: "Cefotaxim đơn độc" },
    { id: 5, label: "Đã có kết quả vi sinh tuyến trước", rec: "Điều trị theo kháng sinh đồ" },
];

export default function Treatment() {
    const navigate = useNavigate();
    const { patient, updatePatient } = usePatient();
    const [selectedGroup, setSelectedGroup] = useState(patient.antibioticGroup || null);

    const handleNext = () => {
        if (!selectedGroup) return;
        updatePatient({ antibioticGroup: selectedGroup });
        // Navigate to Calculator explicitly
        navigate('/calculator');
    };

    return (
        <div className="card">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Stethoscope size={24} color="var(--color-primary)" />
                III. Hướng dẫn điều trị
            </h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>Chọn 1 trong 5 biểu hiện lâm sàng để có phác đồ kháng sinh tương ứng</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                {ANTIBIOTIC_GROUPS.map((group) => (
                    <label key={group.id} className={`card ${selectedGroup?.id === group.id ? 'active' : ''}`} style={{
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        border: selectedGroup?.id === group.id ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                        background: selectedGroup?.id === group.id ? 'rgba(14, 165, 233, 0.05)' : 'var(--color-surface)'
                    }}>
                        <input type="radio" style={{ display: 'none' }} name="antibiotic_group" checked={selectedGroup?.id === group.id} onChange={() => setSelectedGroup(group)} />
                        <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>{group.label}</div>
                        <div style={{ color: 'var(--color-primary)', fontWeight: '500', fontSize: '0.9rem', padding: '0.5rem', background: 'var(--color-surface)', borderTop: '1px dashed var(--color-border)' }}>
                            Phác đồ: {group.rec}
                        </div>
                    </label>
                ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                <button className="btn btn-secondary" onClick={() => navigate(-1)}>
                    &larr; Quay lại
                </button>
                <button className="btn btn-primary" onClick={handleNext} disabled={!selectedGroup}>
                    Tiếp tục (Chọn thuốc, Tính liều) &rarr;
                </button>
            </div>
        </div>
    );
}
