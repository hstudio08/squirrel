'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { auth, db, googleProvider } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

interface CalculatorProps {
  onUnlock?: () => void;
}

export default function Calculator({ onUnlock }: CalculatorProps = {}) {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const backListener = CapacitorApp.addListener('backButton', () => {
        CapacitorApp.exitApp();
      });
      return () => { backListener.then(l => l.remove()); };
    }
  }, []);

  useEffect(() => {
    // Prefetch for instant loading
    router.prefetch('/chat');

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        const savedPin = localStorage.getItem('squirrel_pin');
        if (!savedPin) {
          if (onUnlock) onUnlock();
          else router.push('/chat');
        }
      }
    });
    return () => unsubscribe();
  }, [router]);

  const triggerMasterLogin = () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setExpression('');
    setResult('');
    
    if (auth.currentUser) {
      setIsLoggingIn(false);
      if (onUnlock) onUnlock();
      else router.push('/chat');
      return;
    }

    if (Capacitor.isNativePlatform()) {
      FirebaseAuthentication.signInWithGoogle().then(async (result) => {
        if (result.credential?.idToken) {
          const credential = GoogleAuthProvider.credential(result.credential.idToken);
          const userCred = await signInWithCredential(auth, credential);
          if (userCred.user) {
            try {
              await setDoc(doc(db, 'users', userCred.user.uid), {
                uid: userCred.user.uid,
                email: userCred.user.email,
                displayName: userCred.user.displayName,
                photoURL: userCred.user.photoURL,
                lastLogin: serverTimestamp()
              }, { merge: true });
            } catch (e) {
              console.error('Firestore error:', e);
            }
            router.push('/chat');
          }
        }
      }).catch((error) => {
        console.error('Native login failed:', error);
        alert('Native login failed. Ensure google-services.json is added.');
        setIsLoggingIn(false);
      });
    } else {
      signInWithPopup(auth, googleProvider)
        .then(async (result) => {
          if (result.user) {
            try {
              await setDoc(doc(db, 'users', result.user.uid), {
                uid: result.user.uid,
                email: result.user.email,
                displayName: result.user.displayName,
                photoURL: result.user.photoURL,
                lastLogin: serverTimestamp()
              }, { merge: true });
            } catch (e) {
              console.error('Firestore error:', e);
            }
          }
        })
        .catch((error) => {
          console.error('Login failed:', error);
          setIsLoggingIn(false);
        });
    }
  };

  const triggerPinLogin = () => {
    setExpression('');
    setResult('');
    if (auth.currentUser) {
      if (onUnlock) onUnlock();
      else router.push('/chat');
    }
  };

  const handleInput = (val: string) => {
    setExpression(prev => prev + val);
    setResult('');
  };

  const clearAll = () => {
    setExpression('');
    setResult('');
  };

  const backspace = () => {
    setExpression(prev => prev.slice(0, -1));
    setResult('');
  };

  const calculate = () => {
    if (expression === '19149251') {
      triggerMasterLogin();
      return;
    }

    const savedPin = localStorage.getItem('squirrel_pin');
    if (savedPin && expression === savedPin) {
      triggerPinLogin();
      return;
    }

    if (!expression) return;

    try {
      // Basic safe eval for calculator
      let safeExpr = expression
        .replace(/x/g, '*')
        .replace(/Ã·/g, '/')
        .replace(/%/g, '/100')
        .replace(/\^/g, '**')
        .replace(/âˆš/g, 'Math.sqrt');
      
      // Clean trailing operators if any
      safeExpr = safeExpr.replace(/[+\-*/]$/, '');

      // eslint-disable-next-line no-eval
      const evalResult = eval(safeExpr);
      if (evalResult !== undefined && !isNaN(evalResult) && isFinite(evalResult)) {
        // Format to avoid super long decimals, up to 8 decimal places
        const formattedResult = Number.isInteger(evalResult) 
          ? String(evalResult) 
          : parseFloat(evalResult.toFixed(8)).toString();
          
        setResult(formattedResult);
      } else {
        setResult('Error');
      }
    } catch (e) {
      setResult('Error');
    }
  };

  // Modern Android/Web aesthetic buttons
  const buttons = [
    { label: 'C', onClick: clearAll, type: 'action' },
    { label: 'âŒ«', onClick: backspace, type: 'action' },
    { label: '(', onClick: () => handleInput('('), type: 'action' },
    { label: ')', onClick: () => handleInput(')'), type: 'action' },

    { label: 'âˆš', onClick: () => handleInput('âˆš('), type: 'operator' },
    { label: '^', onClick: () => handleInput('^'), type: 'operator' },
    { label: '%', onClick: () => handleInput('%'), type: 'operator' },
    { label: 'Ã·', onClick: () => handleInput('Ã·'), type: 'operator' },
    
    { label: '7', onClick: () => handleInput('7'), type: 'number' },
    { label: '8', onClick: () => handleInput('8'), type: 'number' },
    { label: '9', onClick: () => handleInput('9'), type: 'number' },
    { label: 'x', onClick: () => handleInput('x'), type: 'operator' },
    
    { label: '4', onClick: () => handleInput('4'), type: 'number' },
    { label: '5', onClick: () => handleInput('5'), type: 'number' },
    { label: '6', onClick: () => handleInput('6'), type: 'number' },
    { label: '-', onClick: () => handleInput('-'), type: 'operator' },
    
    { label: '1', onClick: () => handleInput('1'), type: 'number' },
    { label: '2', onClick: () => handleInput('2'), type: 'number' },
    { label: '3', onClick: () => handleInput('3'), type: 'number' },
    { label: '+', onClick: () => handleInput('+'), type: 'operator' },
    
    { label: '00', onClick: () => handleInput('00'), type: 'number' },
    { label: '0', onClick: () => handleInput('0'), type: 'number' },
    { label: '.', onClick: () => handleInput('.'), type: 'number' },
    { label: '=', onClick: calculate, type: 'equals' },
  ];

  const getButtonClass = (type: string) => {
    switch(type) {
      case 'action':
        return 'text-rose-400 bg-white/5 border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]';
      case 'operator':
        return 'text-emerald-400 bg-white/5 border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]';
      case 'equals':
        return 'text-white bg-gradient-to-br from-emerald-500 to-teal-600 shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] border border-white/20';
      default:
        return 'text-gray-100 bg-black/20 border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]';
    }
  };

  return (
    <div className="relative flex flex-col h-[100dvh] bg-black font-sans overflow-hidden select-none">
      
      {/* Liquid background blobs */}
      <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[40%] bg-emerald-900/30 rounded-[100%]   pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-20%] w-[80%] h-[60%] bg-teal-900/20 rounded-[100%]   pointer-events-none animate-pulse-slow delay-1000"></div>

      {/* Display Area */}
      <div className="relative z-10 flex-1 flex flex-col justify-end items-end p-8 pb-8 space-y-2">
        <div className="text-gray-400 text-3xl font-light tracking-widest break-all text-right w-full min-h-[40px] opacity-80 font-mono">
          {expression}
        </div>
        <AnimatePresence mode="wait">
          <motion.div 
            key={result || expression}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="text-white text-[5rem] leading-none font-medium tracking-tighter truncate w-full text-right bg-gradient-to-b from-white to-gray-400 text-transparent bg-clip-text pb-2"
          >
            {result || (expression ? '' : '0')}
          </motion.div>
        </AnimatePresence>
      </div>
      
      {/* Keypad */}
      <div className="relative z-20  bg-white/[0.02] border-t border-white/10 rounded-t-[3rem] p-6 pb-12 shadow-[0_-20px_60px_rgba(0,0,0,0.5)]">
        <div className="grid grid-cols-4 gap-4 max-w-sm mx-auto">
          {buttons.map((btn, i) => (
            <motion.button
              key={i}
              onClick={btn.onClick}
              whileTap={{ scale: 0.85, filter: 'brightness(1.5)' }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className={`h-[4.5rem] sm:h-16 rounded-[1.75rem] text-3xl font-medium flex items-center justify-center relative overflow-hidden  ${getButtonClass(btn.type)}`}
            >
              {btn.label}
              {/* Optional glossy reflection */}
              <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent rounded-t-[2rem] pointer-events-none"></div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
