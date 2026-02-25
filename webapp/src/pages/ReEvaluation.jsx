import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPatientById, savePatient } from '../lib/storage';
import { RefreshCcw, Save } from 'lucide-react';

export default function ReEvaluation() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [patient, setPatient] = useState(null);

    const [form, setForm] = useState({
        culture: '', // 'negative', 'positive_gram_neg', 'positive_gram_pos'
        evidence: '', // 'clear', 'unclear'
        crp: '', // 'lt10', 'gte10'
        clinical: '', // 'stable', 'unstable_or_signs'
        meningitis: '', // 'yes', 'no'
    });

    useEffect(() => {
        const fetchPatient = async () => {
            const p = await getPatientById(id);
            if (!p) {
                alert("Không tìm thấy bệnh nhân!");
                navigate('/');
            } else {
                setPatient(p);
            }
        };
        fetchPatient();
    }, [id, navigate]);

    const calculateDuration = () => {
        const { culture, evidence, crp, clinical, meningitis } = form;

        if (!culture || !evidence || !crp || !clinical || !meningitis) return null;

        // Ưu tiên 1: Viêm màng não hoặc cấy máu ra Gram âm
        if (meningitis === 'yes' || culture === 'positive_gram_neg') {
            return '14 - 21 ngày';
        }

        // Ưu tiên 2: Lâm sàng chưa ổn hoặc cấy máu ra Gram dương
        if (clinical === 'unstable_or_signs' || culture === 'positive_gram_pos') {
            return '14 ngày';
        }

        // Ưu tiên 3: Cấy máu âm tính và lâm sàng ổn định
        if (culture === 'negative') {
            if (evidence === 'unclear' && crp === 'lt10') {
                return '3 - 5 ngày (Có thể dừng sớm nếu biểu hiện tốt). Theo dõi sau khi cắt kháng sinh.';
            } else if (evidence === 'clear' || crp === 'gte10') {
                return '7 - 10 ngày';
            }
        }

        // Default fallback
        return 'Cần đánh giá kỹ thêm lâm sàng và hội chẩn.';
    };

    const handleSave = async () => {
        const duration = calculateDuration();
        if (!duration) {
            alert("Vui lòng trả lời đầy đủ 5 tiêu chí đánh giá bên trên để hệ thống đưa ra khuyến nghị!");
            return;
        }

        if (patient) {
            try {
                await savePatient({
                    ...patient,
                    evaluationForm: form,
                    evaluationResult: duration
                });
                alert(`Đã cập nhật Đánh giá lại: Khuyến nghị ${duration}`);
                navigate('/');
            } catch (error) {
                alert('Lỗi lưu dữ liệu: ' + error.message);
            }
        }
    };

    if (!patient) return <div>Đang tải...</div>;

    const result = calculateDuration();

    return (
        <div className="card">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RefreshCcw size={24} color="var(--color-primary)" />
                Đánh giá lại phác đồ sau cấy máu (BN: {id})
            </h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>Lựa chọn các kết quả để hệ thống khuyến nghị thời gian sử dụng kháng sinh.</p>

            <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '2rem' }}>

                <div className="input-group">
                    <label className="input-label" style={{ fontWeight: 'bold' }}>1. Kết quả nuôi cấy</label>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {['negative', 'positive_gram_pos', 'positive_gram_neg'].map(opt => (
                            <label key={opt} className={`checkbox-item ${form.culture === opt ? 'checked' : ''}`} style={{ flex: '1', border: '1px solid var(--color-border)', margin: 0 }}>
                                <input type="radio" style={{ display: 'none' }} checked={form.culture === opt} onChange={() => setForm({ ...form, culture: opt })} />
                                <span className="checkbox-label" style={{ textAlign: 'center' }}>
                                    {opt === 'negative' ? 'Âm tính' : opt === 'positive_gram_pos' ? 'Dương tính (Gram +)' : 'Dương tính (Gram -)'}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="input-group">
                    <label className="input-label" style={{ fontWeight: 'bold' }}>2. Bằng chứng nhiễm trùng ban đầu</label>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {['clear', 'unclear'].map(opt => (
                            <label key={opt} className={`checkbox-item ${form.evidence === opt ? 'checked' : ''}`} style={{ flex: '1', border: '1px solid var(--color-border)', margin: 0 }}>
                                <input type="radio" style={{ display: 'none' }} checked={form.evidence === opt} onChange={() => setForm({ ...form, evidence: opt })} />
                                <span className="checkbox-label" style={{ textAlign: 'center' }}>{opt === 'clear' ? 'Rõ ràng' : 'Không rõ / yếu'}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="input-group">
                    <label className="input-label" style={{ fontWeight: 'bold' }}>3. Chỉ số CRP (Trong 48h)</label>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {['lt10', 'gte10'].map(opt => (
                            <label key={opt} className={`checkbox-item ${form.crp === opt ? 'checked' : ''}`} style={{ flex: '1', border: '1px solid var(--color-border)', margin: 0 }}>
                                <input type="radio" style={{ display: 'none' }} checked={form.crp === opt} onChange={() => setForm({ ...form, crp: opt })} />
                                <span className="checkbox-label" style={{ textAlign: 'center' }}>{opt === 'lt10' ? '< 10 mg/L' : '≥ 10 mg/L'}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="input-group">
                    <label className="input-label" style={{ fontWeight: 'bold' }}>4. Biểu hiện lâm sàng</label>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {['stable', 'unstable_or_signs'].map(opt => (
                            <label key={opt} className={`checkbox-item ${form.clinical === opt ? 'checked' : ''}`} style={{ flex: '1', border: '1px solid var(--color-border)', margin: 0 }}>
                                <input type="radio" style={{ display: 'none' }} checked={form.clinical === opt} onChange={() => setForm({ ...form, clinical: opt })} />
                                <span className="checkbox-label" style={{ textAlign: 'center' }}>{opt === 'stable' ? 'Tốt / Ổn định' : 'Chưa ổn / Còn dấu hiệu NK'}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="input-group">
                    <label className="input-label" style={{ fontWeight: 'bold' }}>5. Viêm màng não nhiễm khuẩn</label>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {['yes', 'no'].map(opt => (
                            <label key={opt} className={`checkbox-item ${form.meningitis === opt ? 'checked' : ''}`} style={{ flex: '1', border: '1px solid var(--color-border)', margin: 0 }}>
                                <input type="radio" style={{ display: 'none' }} checked={form.meningitis === opt} onChange={() => setForm({ ...form, meningitis: opt })} />
                                <span className="checkbox-label" style={{ textAlign: 'center' }}>{opt === 'yes' ? 'Có' : 'Không'}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            {result && (
                <div style={{ padding: '1.5rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '2px dashed var(--color-success)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', color: 'var(--color-success)', textAlign: 'center' }}>
                    <h3 style={{ marginBottom: '0.5rem' }}>Khuyến nghị thời gian dùng kháng sinh:</h3>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{result}</div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => navigate('/')}>
                    Hủy bỏ
                </button>
                <button className="btn btn-primary" onClick={handleSave}>
                    <Save size={18} /> Cập nhật Hồ sơ Đánh giá
                </button>
            </div>

        </div>
    );
}
