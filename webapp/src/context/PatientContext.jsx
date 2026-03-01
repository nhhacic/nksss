import { createContext, useContext, useState, useEffect } from 'react';

const PatientContext = createContext();

const SESSION_KEY = 'nksss_patient_draft';

const defaultPatient = {
    id: '', dob: '', admissionTime: '', weight: '', gestationalAge: '',
    warningSigns: [], riskFactors: [], clinicalSigns: [],
    diagnosis: null, antibioticGroup: null, antibiotic: null,
    tags: [], // NEW: tag system
};

const loadFromSession = () => {
    try {
        const saved = sessionStorage.getItem(SESSION_KEY);
        if (saved) return JSON.parse(saved);
    } catch (e) {
        console.warn('Failed to load patient draft from session:', e);
    }
    return { ...defaultPatient };
};

export const PatientProvider = ({ children }) => {
    const [patient, setPatient] = useState(loadFromSession);

    // Persist to sessionStorage whenever patient changes
    useEffect(() => {
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(patient));
        } catch (e) {
            console.warn('Failed to save patient draft to session:', e);
        }
    }, [patient]);

    const updatePatient = (data) => {
        setPatient(prev => ({ ...prev, ...data }));
    };

    const resetPatient = () => {
        setPatient({ ...defaultPatient });
        try {
            sessionStorage.removeItem(SESSION_KEY);
        } catch (e) { /* ignore */ }
    };

    return (
        <PatientContext.Provider value={{ patient, updatePatient, resetPatient }}>
            {children}
        </PatientContext.Provider>
    );
};

export const usePatient = () => useContext(PatientContext);
