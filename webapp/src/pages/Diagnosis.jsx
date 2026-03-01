import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatient } from '../context/PatientContext';
import { useTranslation } from '../i18n/LanguageContext';
import { useToast } from '../components/Toast';
import { savePatient } from '../lib/storage';
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
    const { patient, updatePatient, resetPatient } = usePatient();
    const [warnings, setWarnings] = useState(patient.warningSigns || []);
    const [risks, setRisks] = useState(patient.riskFactors || []);
    const { t } = useTranslation();
    const toast = useToast();

    const handleToggle = (item, list, setList) => {
        if (list.includes(item)) {
            setList(list.filter(i => i !== item));
        } else {
            setList([...list, item]);
        }
    };

    // Memoized diagnosis calculation (was called 4x per render before)
    const diagnosis = useMemo(() => {
        if (warnings.length >= 1 || risks.length >= 2) {
            return 'A';
        } else if (risks.length === 1) {
            return 'B';
        }
        return null;
    }, [warnings, risks]);

    const handleNext = async () => {
        const updatedData = {
            warningSigns: warnings,
            riskFactors: risks,
            diagnosis
        };
        updatePatient(updatedData);

        if (diagnosis === 'A') {
            navigate('/treatment');
        } else if (diagnosis === 'B') {
            // Hướng B: lưu hồ sơ bệnh nhân vào Firestore trước khi chuyển trang
            try {
                const patientToSave = {
                    ...patient,
                    ...updatedData,
                    tags: [...new Set([...(patient.tags || []), 'Hướng B', 'Theo dõi'])],
                };
                await savePatient(patientToSave);
                resetPatient();
                navigate('/followup');
            } catch (error) {
                console.error("Lỗi khi lưu hồ sơ:", error);
                toast.error(t('diagnosis.saveError'));
            }
        } else {
            toast.warning(t('diagnosis.noSigns'));
        }
    };

    return (
        <div className="card">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={24} color="var(--color-primary)" />
                II. {t('diagnosis.title')}
            </h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>{t('diagnosis.instruction')}</p>

            <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--color-danger)' }}>{t('diagnosis.table1Title')}</h3>
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
                <h3 style={{ marginBottom: '1rem', color: 'var(--color-warning)' }}>{t('diagnosis.table2Title')}</h3>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {RISK_FACTORS_AND_CLINICAL_SIGNS.map((sign, idx) => (
                        <label key={idx} className={`checkbox-item ${risks.includes(sign) ? 'checked' : ''}`}>
                            <input type="checkbox" checked={risks.includes(sign)} onChange={() => handleToggle(sign, risks, setRisks)} />
                            <span className="checkbox-label">{sign}</span>
                        </label>
                    ))}
                </div>
            </div>

            {diagnosis === 'A' && (
                <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', color: 'var(--color-danger)' }}>
                    <strong>{t('diagnosis.catAAlert')}:</strong> {t('diagnosis.catADesc')}
                </div>
            )}

            {diagnosis === 'B' && (
                <div style={{ padding: '1rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--color-warning)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', color: 'var(--color-warning)' }}>
                    <strong>{t('diagnosis.catBAlert')}:</strong> {t('diagnosis.catBMonitor')}
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                <button className="btn btn-secondary" onClick={() => navigate(-1)}>
                    ← {t('common.back')}
                </button>
                <button className="btn btn-primary" onClick={handleNext} disabled={!diagnosis}>
                    {diagnosis === 'A' ? t('diagnosis.nextAbx') : diagnosis === 'B' ? t('diagnosis.nextMonitor') : t('diagnosis.complete')}
                </button>
            </div>
        </div>
    );
}
