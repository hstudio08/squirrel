// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence, initializeAuth, Auth, browserPopupRedirectResolver } from "firebase/auth";
import { getFirestore, initializeFirestore, Firestore, persistentLocalCache } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let auth: Auth;
if (typeof window !== "undefined") {
  try {
    // Correctly force LocalStorage persistence without race conditions
    auth = initializeAuth(app, {
      persistence: browserLocalPersistence,
      popupRedirectResolver: browserPopupRedirectResolver
    });
  } catch (e) {
    // Fallback if already initialized (e.g., Next.js Fast Refresh)
    auth = getAuth(app);
  }
} else {
  auth = getAuth(app); // Server-side fallback
}

let db: Firestore;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache()
  });
} catch (e) {
  // Fallback to getFirestore if already initialized or error
  db = getFirestore(app);
}
const rtdb = getDatabase(app);
let storage;
try {
  storage = getStorage(app);
} catch (e) {
  console.error("Storage init failed:", e);
}
const googleProvider = new GoogleAuthProvider();

// Force account selection to prevent auto sign-in with the wrong account
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

import { getMessaging, isSupported } from "firebase/messaging";

export const getFirebaseMessaging = async () => {
  if (typeof window !== "undefined") {
    try {
      const supported = await isSupported();
      if (supported) {
        return getMessaging(app);
      }
    } catch (e) {
      console.error("Messaging not supported", e);
    }
  }
  return null;
};

export { app, auth, db, rtdb, storage, googleProvider };
