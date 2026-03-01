import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatient } from '../context/PatientContext';
import { useTranslation } from '../i18n/LanguageContext';
import { differenceInDays, differenceInWeeks } from 'date-fns';
import { Calendar } from 'lucide-react';
import { getPatientById } from '../lib/storage';
import { useToast } from '../components/Toast';

export default function Admission() {
    const navigate = useNavigate();
    const { patient, updatePatient } = usePatient();
    const toast = useToast();
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        id: patient.id || '',
        dob: patient.dob || '',
        admissionTime: patient.admissionTime || '',
        weight: patient.weight || '',
        gestationalAge: patient.gestationalAge || '',
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleDateChange = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length >= 2) value = value.slice(0, 2) + ':' + value.slice(2);
        if (value.length >= 5) value = value.slice(0, 5) + ' ' + value.slice(5);
        if (value.length >= 8) value = value.slice(0, 8) + '/' + value.slice(8);
        if (value.length >= 11) value = value.slice(0, 11) + '/' + value.slice(11, 15);
        setFormData({ ...formData, dob: value });
    };

    const handleAdmissionTimeChange = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length >= 2) value = value.slice(0, 2) + ':' + value.slice(2);
        if (value.length >= 5) value = value.slice(0, 5) + ' ' + value.slice(5);
        if (value.length >= 8) value = value.slice(0, 8) + '/' + value.slice(8);
        if (value.length >= 11) value = value.slice(0, 11) + '/' + value.slice(11, 15);
        setFormData({ ...formData, admissionTime: value });
    };

    const handleNativeDateChange = (e) => {
        if (!e.target.value) return;
        const dateObj = new Date(e.target.value);
        if (isNaN(dateObj)) return;
        const hh = String(dateObj.getHours()).padStart(2, '0');
        const min = String(dateObj.getMinutes()).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const yyyy = dateObj.getFullYear();
        setFormData({ ...formData, dob: `${hh}:${min} ${dd}/${mm}/${yyyy}` });
    };

    const handleNativeAdmissionChange = (e) => {
        if (!e.target.value) return;
        const dateObj = new Date(e.target.value);
        if (isNaN(dateObj)) return;
        const hh = String(dateObj.getHours()).padStart(2, '0');
        const min = String(dateObj.getMinutes()).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const yyyy = dateObj.getFullYear();
        setFormData({ ...formData, admissionTime: `${hh}:${min} ${dd}/${mm}/${yyyy}` });
    };

    const handleNext = async (e) => {
        e.preventDefault();
        if (!formData.id || !formData.dob || !formData.admissionTime || !formData.weight || !formData.gestationalAge) {
            toast.warning(t('admission.requiredFields'));
            return;
        }

        // Validate mã bệnh nhân đã tồn tại
        const existingPatient = await getPatientById(formData.id);
        if (existingPatient) {
            toast.error(t('admission.idExists', { id: formData.id }));
            return;
        }

        // Validate ngày giờ sinh hh:mm dd/mm/yyyy
        if (formData.dob.length !== 16) {
            toast.warning(t('admission.invalidDob'));
            return;
        }

        const dobTimeParts = formData.dob.split(' ');
        if (dobTimeParts.length !== 2) {
            toast.warning(t('admission.invalidDob'));
            return;
        }
        const dobTimeStr = dobTimeParts[0];
        const dobDateStr = dobTimeParts[1];
        const dobTimeSplit = dobTimeStr.split(':');
        const dobDateSplit = dobDateStr.split('/');

        if (dobTimeSplit.length !== 2 || dobDateSplit.length !== 3) {
            toast.warning(t('admission.invalidDob'));
            return;
        }

        const dobYear = parseInt(dobDateSplit[2], 10);
        const dobMonth = parseInt(dobDateSplit[1], 10) - 1;
        const dobDay = parseInt(dobDateSplit[0], 10);
        const dobHour = parseInt(dobTimeSplit[0], 10);
        const dobMin = parseInt(dobTimeSplit[1], 10);

        const birthDate = new Date(dobYear, dobMonth, dobDay, dobHour, dobMin);

        if (isNaN(birthDate) || birthDate.getDate() !== dobDay || birthDate.getMonth() !== dobMonth) {
            toast.error(t('admission.invalidDobDate'));
            return;
        }

        // Validate ngày giờ nhập viện hh:mm dd/mm/yyyy
        if (formData.admissionTime.length !== 16) {
            toast.warning(t('admission.invalidAdmTime'));
            return;
        }

        const adTimeParts = formData.admissionTime.split(' ');
        if (adTimeParts.length !== 2) {
            toast.warning(t('admission.invalidAdmTime'));
            return;
        }
        const timeStr = adTimeParts[0];
        const dateStr = adTimeParts[1];

        const timeParts = timeStr.split(':');
        const admDateParts = dateStr.split('/');

        if (timeParts.length !== 2 || admDateParts.length !== 3) {
            toast.warning(t('admission.invalidAdmTime'));
            return;
        }

        const admYear = parseInt(admDateParts[2], 10);
        const admMonth = parseInt(admDateParts[1], 10) - 1;
        const admDay = parseInt(admDateParts[0], 10);
        const admHour = parseInt(timeParts[0], 10);
        const admMin = parseInt(timeParts[1], 10);

        const admissionDateObj = new Date(admYear, admMonth, admDay, admHour, admMin);

        if (isNaN(admissionDateObj) || admissionDateObj.getDate() !== admDay || admissionDateObj.getMonth() !== admMonth) {
            toast.error(t('admission.invalidAdmDate'));
            return;
        }

        const today = new Date();
        const ageDays = differenceInDays(today, birthDate);
        const ageWeeks = differenceInWeeks(today, birthDate);

        if (ageDays < 0) {
            toast.error(t('admission.futureDob'));
            return;
        }

        updatePatient({
            ...formData,
            admissionTime: admissionDateObj.toISOString(),
            ageDays,
            ageWeeks,
        });
        navigate('/diagnosis');
    };

    return (
        <div className="card">
            <h2 className="card-title">{t('admission.pageTitle')}</h2>
            <form onSubmit={handleNext}>
                <div className="input-group">
                    <label className="input-label">{t('admission.patientId')}</label>
                    <input type="text" className="input-field" name="id" value={formData.id} onChange={handleChange} placeholder="VD: BN12345" required />
                </div>
                <div className="input-group">
                    <label className="input-label">{t('admission.dob')}</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                            type="text"
                            className="input-field"
                            name="dob"
                            value={formData.dob}
                            onChange={handleDateChange}
                            placeholder="hh:mm dd/mm/yyyy"
                            maxLength="16"
                            required
                        />
                        <div style={{ position: 'absolute', right: '0.75rem', width: '24px', height: '24px' }}>
                            <input
                                type="datetime-local"
                                style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 10, right: 0, top: 0 }}
                                onChange={handleNativeDateChange}
                            />
                            <Calendar size={20} color="var(--color-primary)" style={{ position: 'absolute', left: '2px', top: '2px', pointerEvents: 'none' }} />
                        </div>
                    </div>
                </div>
                <div className="input-group">
                    <label className="input-label">{t('admission.admissionTime')}</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                            type="text"
                            className="input-field"
                            name="admissionTime"
                            value={formData.admissionTime}
                            onChange={handleAdmissionTimeChange}
                            placeholder="hh:mm dd/mm/yyyy"
                            maxLength="16"
                            required
                        />
                        <div style={{ position: 'absolute', right: '0.75rem', width: '24px', height: '24px' }}>
                            <input
                                type="datetime-local"
                                style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 10, right: 0, top: 0 }}
                                onChange={handleNativeAdmissionChange}
                            />
                            <Calendar size={20} color="var(--color-primary)" style={{ position: 'absolute', left: '2px', top: '2px', pointerEvents: 'none' }} />
                        </div>
                    </div>
                </div>
                <div className="input-group">
                    <label className="input-label">{t('admission.weight')}</label>
                    <input type="number" className="input-field" name="weight" value={formData.weight} onChange={handleChange} placeholder="VD: 3200" required />
                </div>
                <div className="input-group">
                    <label className="input-label">{t('admission.gaLabel')}</label>
                    <input type="number" className="input-field" name="gestationalAge" value={formData.gestationalAge} onChange={handleChange} placeholder="VD: 38" required />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                    <button type="submit" className="btn btn-primary">
                        {t('admission.continueBtn')}
                    </button>
                </div>
            </form>
        </div>
    );
}
