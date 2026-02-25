import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDvHNE3Hp2qekHuX4-pDJ_PbTu1NcADDp8",
  authDomain: "nksss-35732.firebaseapp.com",
  projectId: "nksss-35732",
  storageBucket: "nksss-35732.firebasestorage.app",
  messagingSenderId: "611329113429",
  appId: "1:611329113429:web:b6fe60d808484c33eb83dc"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);