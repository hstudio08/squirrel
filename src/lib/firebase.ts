// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBdKD1WqxBrVRh89NmwAfBIU3TpfxcBraM",
  authDomain: "squirrel-4f5a6.firebaseapp.com",
  projectId: "squirrel-4f5a6",
  storageBucket: "squirrel-4f5a6.firebasestorage.app",
  messagingSenderId: "794362383109",
  appId: "1:794362383109:web:9caa2cf76ecffea1b0c56c"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const googleProvider = new GoogleAuthProvider();

// Force account selection to prevent auto sign-in with the wrong account
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export { app, auth, db, rtdb, googleProvider };
