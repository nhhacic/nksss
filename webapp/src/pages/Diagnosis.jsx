import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatient } from '../context/PatientContext';
import { Activity } from 'lucide-react';

const WARNING_SIGNS = [
    "Nghi ngờ hoặc xác định nhiễm trùng ở một trong các trẻ sinh đa thai",
    "Ngừng thở ở trẻ đủ tháng",
    "Cần thở máy ở trẻ đủ tháng",
    "Co giật",
    "Cần hồi sức tim phổi",
    "Dấu hiệu của sốc"
];

const RISK_FACTORS_AND_CLINICAL_SIGNS = [
    // Yếu tố nguy cơ
    "Nhiễm GBS ở trẻ trước hoặc mẹ nhiễm GBS, nhiễm trùng tiết niệu...",
    "Chuyển dạ tự nhiên trước 37 tuần thai",
    "Xác định vỡ ối kéo dài > 18 giờ ở trẻ sinh non",
    "Xác định vỡ ối kéo dài > 24 giờ ở trẻ đủ tháng",
    "Mẹ sốt > 38 ℃ lúc sinh, nghi ngờ hoặc xác định nhiễm khuẩn",
    "Mẹ chẩn đoán lâm sàng viêm màng ối",
    // Dấu hiệu lâm sàng
    "Thay đổi tri giác",
    "Thay đổi trương lực cơ",
    "Khó khăn khi ăn (ví dụ: từ chối ăn)",
    "Không dung nạp thức ăn nôn trớ hoặc bụng chướng",
    "Nhịp tim bất thường (nhịp chậm hoặc nhịp nhanh)",
    "Dấu hiệu suy hô hấp (bao gồm khò khè, rút lõm cơ hô hấp, thở nhanh)",
    "Thiếu oxy (như tím tái trung tâm, giảm độ bão hòa oxy)",
    "Tăng áp phổi dai dẳng ở trẻ sơ sinh",
    "Dấu hiệu bệnh não trẻ sơ sinh",
    "Vàng da trong 24 giờ sau sinh",
    "Rối loạn nhiệt độ (< 36℃ hoặc > 38℃) không do môi trường",
    "Chảy máu, giảm tiểu cầu hoặc rối loạn đông máu",
    "Tăng hoặc hạ đường máu",
    "Nhiễm toan chuyển hóa (BE >-10 mmol/l)"
];

export default function Diagnosis() {
    const navigate = useNavigate();
    const { patient, updatePatient } = usePatient();
    const [warnings, setWarnings] = useState(patient.warningSigns || []);
    const [risks, setRisks] = useState(patient.riskFactors || []);

    const handleToggle = (item, list, setList) => {
        if (list.includes(item)) {
            setList(list.filter(i => i !== item));
        } else {
            setList([...list, item]);
        }
    };

    const calculateDiagnosis = () => {
        // Logic from Guidelines
        if (warnings.length >= 1 || risks.length >= 2) {
            return 'A';
        } else if (risks.length === 1) {
            return 'B';
        }
        return null;
    };

    const handleNext = () => {
        const diag = calculateDiagnosis();
        updatePatient({
            warningSigns: warnings,
            riskFactors: risks,
            diagnosis: diag
        });

        if (diag === 'A') {
            navigate('/treatment');
        } else if (diag === 'B') {
            navigate('/followup');
        } else {
            alert("Không có dấu hiệu nhiễm khuẩn cần xử lý sơ sinh sớm hoặc cần theo dõi thêm.");
        }
    };

    return (
        <div className="card">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={24} color="var(--color-primary)" />
                II. Chẩn đoán lâm sàng
            </h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>Tick vào các dấu hiệu/yếu tố nguy cơ trẻ có</p>

            <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--color-danger)' }}>BẢNG 1: 6 dấu hiệu cảnh báo</h3>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {WARNING_SIGNS.map((sign, idx) => (
                        <label key={idx} className={`checkbox-item ${warnings.includes(sign) ? 'checked' : ''}`}>
                            <input type="checkbox" checked={warnings.includes(sign)} onChange={() => handleToggle(sign, warnings, setWarnings)} />
                            <span className="checkbox-label">{sign}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--color-warning)' }}>BẢNG 2: Yếu tố nguy cơ & 14 dấu hiệu lâm sàng</h3>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {RISK_FACTORS_AND_CLINICAL_SIGNS.map((sign, idx) => (
                        <label key={idx} className={`checkbox-item ${risks.includes(sign) ? 'checked' : ''}`}>
                            <input type="checkbox" checked={risks.includes(sign)} onChange={() => handleToggle(sign, risks, setRisks)} />
                            <span className="checkbox-label">{sign}</span>
                        </label>
                    ))}
                </div>
            </div>

            {calculateDiagnosis() === 'A' && (
                <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', color: 'var(--color-danger)' }}>
                    <strong>CẢNH BÁO ĐỎ (Hướng A):</strong> Có chỉ định dùng kháng sinh trong 1 giờ đầu. Cần lấy mẫu cấy máu ngay.
                </div>
            )}

            {calculateDiagnosis() === 'B' && (
                <div style={{ padding: '1rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--color-warning)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', color: 'var(--color-warning)' }}>
                    <strong>THEO DÕI (Hướng B):</strong> Tạm hoãn sử dụng kháng sinh. Theo dõi sát trên lâm sàng trong ít nhất 12 giờ tới.
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                <button className="btn btn-secondary" onClick={() => navigate(-1)}>
                    &larr; Quay lại
                </button>
                <button className="btn btn-primary" onClick={handleNext} disabled={!calculateDiagnosis()}>
                    {calculateDiagnosis() === 'A' ? 'Phác đồ kháng sinh &rarr;' : calculateDiagnosis() === 'B' ? 'Lập hồ sơ theo dõi &rarr;' : 'Hoàn thành'}
                </button>
            </div>
        </div>
    );
}
