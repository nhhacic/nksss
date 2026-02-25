import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db, auth } from './firebase';

const getCurrentUserId = () => {
    return auth.currentUser ? auth.currentUser.uid : null;
};

export const getPatients = async () => {
    const userId = getCurrentUserId();
    if (!userId) return [];

    try {
        const q = query(collection(db, 'patients'), where('doctorId', '==', userId));
        const querySnapshot = await getDocs(q);
        const patients = [];
        querySnapshot.forEach((doc) => {
            patients.push({ id: doc.id, ...doc.data() });
        });
        return patients.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
        console.error("Lỗi khi tải danh sách bệnh nhân:", error);
        return [];
    }
};

export const getPatientById = async (id) => {
    try {
        const docRef = doc(db, 'patients', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }
    } catch (error) {
        console.error("Lỗi khi tải bệnh nhân:", error);
    }
    return null;
};

export const savePatient = async (patient) => {
    const userId = getCurrentUserId();
    if (!userId) throw new Error("Chưa đăng nhập");

    const now = new Date().toISOString();
    let pToSave = { ...patient, doctorId: userId, updatedAt: now };
    if (!pToSave.createdAt) pToSave.createdAt = now;

    const docRef = doc(db, 'patients', patient.id);
    await setDoc(docRef, pToSave, { merge: true });
};

export const deletePatient = async (id) => {
    await deleteDoc(doc(db, 'patients', id));
};
