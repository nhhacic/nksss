import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../lib/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user && !user.displayName && user.email) {
                // Fallback displayName if none exists
                user.displayName = user.email.split('@')[0];
            }
            setCurrentUser(user);
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

    const logout = () => {
        return signOut(auth);
    };

    const resetPassword = (email) => {
        return sendPasswordResetEmail(auth, email);
    };

    const contextValue = {
        currentUser,
        login,
        register,
        logout,
        resetPassword,
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Đang kết nối Server...</div>;

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
