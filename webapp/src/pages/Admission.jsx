import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatient } from '../context/PatientContext';
import { differenceInDays, differenceInWeeks } from 'date-fns';

export default function Admission() {
    const navigate = useNavigate();
    const { patient, updatePatient } = usePatient();
    const [formData, setFormData] = useState({
        id: patient.id || '',
        dob: patient.dob || '',
        weight: patient.weight || '',
        gestationalAge: patient.gestationalAge || '',
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleDateChange = (e) => {
        let value = e.target.value.replace(/\D/g, ''); // Loại bỏ các ký tự không phải số
        if (value.length >= 2) {
            value = value.slice(0, 2) + '/' + value.slice(2);
        }
        if (value.length >= 5) {
            value = value.slice(0, 5) + '/' + value.slice(5, 9);
        }
        setFormData({ ...formData, dob: value });
    };

    const handleNext = (e) => {
        e.preventDefault();
        if (!formData.id || !formData.dob || !formData.weight || !formData.gestationalAge) {
            alert("Vui lòng nhập đầy đủ thông tin.");
            return;
        }

        // Validate ngày tháng dd/mm/yyyy
        const dateParts = formData.dob.split('/');
        if (dateParts.length !== 3 || dateParts[0].length !== 2 || dateParts[1].length !== 2 || dateParts[2].length !== 4) {
            alert("Vui lòng nhập Ngày sinh đúng định dạng dd/mm/yyyy (Ví dụ: 23/02/2026)");
            return;
        }

        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10);
        const year = parseInt(dateParts[2], 10);

        // Calculate post-natal age in days and weeks for the context
        const birthDate = new Date(`${year}-${dateParts[1]}-${dateParts[0]}`);

        // Kiểm tra xem ngày có hợp lệ hay không
        if (birthDate.getDate() !== day || birthDate.getMonth() + 1 !== month || birthDate.getFullYear() !== year) {
            alert("Ngày sinh không hợp lệ. Vui lòng kiểm tra lại.");
            return;
        }

        const today = new Date();
        const ageDays = differenceInDays(today, birthDate);
        const ageWeeks = differenceInWeeks(today, birthDate);

        if (ageDays < 0) {
            alert("Ngày sinh không thể lớn hơn ngày hiện tại.");
            return;
        }

        updatePatient({
            ...formData,
            ageDays,
            ageWeeks,
        });
        navigate('/diagnosis');
    };

    return (
        <div className="card">
            <h2 className="card-title">I. Hành chính Bệnh nhân</h2>
            <form onSubmit={handleNext}>
                <div className="input-group">
                    <label className="input-label">Mã số bệnh nhân</label>
                    <input type="text" className="input-field" name="id" value={formData.id} onChange={handleChange} placeholder="VD: BN12345" required />
                </div>
                <div className="input-group">
                    <label className="input-label">Ngày sinh (dd/mm/yyyy)</label>
                    <input
                        type="text"
                        className="input-field"
                        name="dob"
                        value={formData.dob}
                        onChange={handleDateChange}
                        placeholder="dd/mm/yyyy"
                        maxLength="10"
                        required
                    />
                </div>
                <div className="input-group">
                    <label className="input-label">Cân nặng (gram)</label>
                    <input type="number" className="input-field" name="weight" value={formData.weight} onChange={handleChange} placeholder="VD: 3200" required />
                </div>
                <div className="input-group">
                    <label className="input-label">Tuần tuổi thai lúc sinh</label>
                    <input type="number" className="input-field" name="gestationalAge" value={formData.gestationalAge} onChange={handleChange} placeholder="VD: 38" required />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                    <button type="submit" className="btn btn-primary">
                        Tiếp tục (Chẩn đoán) &rarr;
                    </button>
                </div>
            </form>
        </div>
    );
}
