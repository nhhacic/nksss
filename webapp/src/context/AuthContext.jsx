import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../lib/firebase';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    updateProfile,
    updatePassword,
    GoogleAuthProvider,
    signInWithPopup,
} from 'firebase/auth';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user ? { ...user } : null);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const login = async (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
    };

    const register = async (email, password) => {
        return createUserWithEmailAndPassword(auth, email, password);
    };

    const logout = () => signOut(auth);

    const resetPassword = (email) => sendPasswordResetEmail(auth, email);

    const loginWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        setCurrentUser({ ...result.user });
        return result;
    };

    const updateDisplayName = async (name, photoURL) => {
        const payload = {};
        if (name !== undefined) payload.displayName = name;
        if (photoURL !== undefined) payload.photoURL = photoURL;
        await updateProfile(auth.currentUser, payload);
        setCurrentUser({ ...auth.currentUser });
    };

    const updateUserPassword = async (newPassword) => {
        await updatePassword(auth.currentUser, newPassword);
    };

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '1rem',
                backgroundColor: '#070f1e',
            }}>
                <img src="/logo.png" alt="NKSSS" style={{ width: '64px', height: '64px', borderRadius: '50%', opacity: 0.8 }} />
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Đang kết nối...</p>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ currentUser, login, loginWithGoogle, register, logout, resetPassword, updateDisplayName, updateUserPassword }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
