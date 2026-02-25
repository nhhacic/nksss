import { useNavigate } from 'react-router-dom';
import { usePatient } from '../context/PatientContext';
import { ClipboardCheck } from 'lucide-react';
import { savePatient } from '../lib/storage';

export default function Review() {
    const navigate = useNavigate();
    const { patient, resetPatient } = usePatient();

    const handleSave = async () => {
        try {
            await savePatient(patient);
            alert(`Đã lưu thành công hồ sơ bệnh nhân ${patient.id}! Việc nhắc lịch tái khám sẽ tự động kích hoạt sau 24h.`);
            resetPatient();
            navigate('/');
        } catch (error) {
            alert('Lỗi lưu dữ liệu: ' + error.message);
        }
    };

    return (
        <div className="card">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)' }}>
                <ClipboardCheck size={24} />
                Duyệt Hồ Sơ Lần Cuối
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--color-background)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Mã số BN:</span>
                    <strong>{patient.id}</strong>

                    <span style={{ color: 'var(--color-text-muted)' }}>Thông tin trẻ:</span>
                    <strong>{patient.weight}g, {patient.gestationalAge} tuần ({patient.ageDays} ngày tuổi)</strong>
                </div>

                <div>
                    <strong style={{ color: 'var(--color-warning)' }}>Dấu hiệu Cảnh Báo Lâm Sàng:</strong>
                    <ul style={{ paddingLeft: '1.5rem', margin: '0.5rem 0', color: 'var(--color-text)' }}>
                        {patient.warningSigns?.map((w, i) => <li key={i}>{w}</li>)}
                        {patient.riskFactors?.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                </div>

                <div>
                    <strong style={{ color: 'var(--color-primary)' }}>Phác Đồ Lựa Chọn:</strong>
                    <div style={{ padding: '0.5rem', background: 'rgba(14, 165, 233, 0.1)', borderRadius: 'var(--radius-sm)', marginTop: '0.5rem' }}>
                        {patient.antibioticGroup?.label}<br />
                        <small>({patient.antibioticGroup?.rec})</small>
                    </div>
                </div>

                {patient.doses?.length > 0 && (
                    <div>
                        <strong style={{ color: 'var(--color-success)' }}>Y Lệnh Thuốc:</strong>
                        {patient.doses.map((d, i) => (
                            <div key={i} style={{ background: 'var(--color-surface)', padding: '0.5rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 'bold' }}>{d.med}</span>
                                <span><span style={{ fontSize: '1.2rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>{d.totalDose} mg</span> / {d.interval}h</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                <button className="btn btn-secondary" onClick={() => navigate(-1)}>
                    &larr; Quay lại sửa
                </button>
                <button className="btn btn-primary" onClick={handleSave} style={{ alignSelf: 'flex-end', background: 'var(--color-success)' }}>
                    Lưu Bệnh Án Điển Tử
                </button>
            </div>
        </div>
    );
}
