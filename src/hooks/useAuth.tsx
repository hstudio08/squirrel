'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, User } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('squirrel_cachedUser');
      if (cached) return JSON.parse(cached) as User;
    }
    return null;
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('squirrel_cachedUser');
    }
    return true;
  });
  const [accessDenied, setAccessDenied] = useState(false);

  const ALLOWED_EMAILS = [
    "officialhaadi81@gmail.com",
    "sadiyaayoub22019@gmail.com"
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // Client-side UX check. Authoritative check is in Firestore Rules.
        if (currentUser.email && ALLOWED_EMAILS.includes(currentUser.email.toLowerCase())) {
          setUser(currentUser);
          if (typeof window !== 'undefined') {
            localStorage.setItem('squirrel_cachedUser', JSON.stringify({
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL
            }));
          }
          setAccessDenied(false);
        } else {
          // Immediately sign out unauthorized users
          firebaseSignOut(auth).then(() => {
            setUser(null);
            if (typeof window !== 'undefined') localStorage.removeItem('squirrel_cachedUser');
            setAccessDenied(true);
          });
        }
      } else {
        setUser(null);
        if (typeof window !== 'undefined') localStorage.removeItem('squirrel_cachedUser');
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
      if (typeof window !== 'undefined') localStorage.removeItem('squirrel_cachedUser');
      // Immediate redirect to root disguise page
      window.location.replace('/');
    } catch (error) {
      console.error("Sign out failed", error);
    }
  };

  return { user, loading, signIn, signOut, accessDenied };
}
