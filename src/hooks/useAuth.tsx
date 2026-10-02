'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, User } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const ALLOWED_EMAILS = [
    "officialhaadi81@gmail.com",
    // "sadiyaayoub22019@gmail.com",
    "lonehaadi81@gmail.com"
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // Client-side UX check. Authoritative check is in Firestore Rules.
        if (currentUser.email && ALLOWED_EMAILS.includes(currentUser.email.toLowerCase())) {
          setUser(currentUser);
          setAccessDenied(false);
        } else {
          // Immediately sign out unauthorized users
          firebaseSignOut(auth).then(() => {
            setUser(null);
            setAccessDenied(true);
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    setAccessDenied(false);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Authentication failed", error);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      // Immediate redirect to root disguise page
      window.location.replace('/');
    } catch (error) {
      console.error("Sign out failed", error);
    }
  };

  return { user, loading, signIn, signOut, accessDenied };
}
