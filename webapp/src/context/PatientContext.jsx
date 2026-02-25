import { createContext, useContext, useState } from 'react';

const PatientContext = createContext();

export const PatientProvider = ({ children }) => {
    const [patient, setPatient] = useState({
        id: '',
        dob: '',
        weight: '',
        gestationalAge: '',
        warningSigns: [],
        riskFactors: [],
        clinicalSigns: [],
        diagnosis: null, // 'A' or 'B'
        antibioticGroup: null,
        antibiotic: null,
    });

    const updatePatient = (data) => {
        setPatient(prev => ({ ...prev, ...data }));
    };

    const resetPatient = () => {
        setPatient({
            id: '', dob: '', weight: '', gestationalAge: '',
            warningSigns: [], riskFactors: [], clinicalSigns: [],
            diagnosis: null, antibioticGroup: null, antibiotic: null,
        });
    };

    return (
        <PatientContext.Provider value={{ patient, updatePatient, resetPatient }}>
            {children}
        </PatientContext.Provider>
    );
};

export const usePatient = () => useContext(PatientContext);
