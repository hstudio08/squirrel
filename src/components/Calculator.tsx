'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { auth, db, googleProvider } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

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
  }, [router, onUnlock]);

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
            if (onUnlock) onUnlock();
            else router.push('/chat');
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
            if (onUnlock) onUnlock();
            else router.push('/chat');
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

  const toggleSign = () => {
    if (result) {
      const val = String(-Number(result));
      setResult(val);
      setExpression(val);
      return;
    }
    if (expression.startsWith('-')) {
      setExpression(expression.substring(1));
    } else if (expression) {
      setExpression('-' + expression);
    }
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
      let safeExpr = expression
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/%/g, '/100');
      
      safeExpr = safeExpr.replace(/[+\-*/]$/, '');

      // eslint-disable-next-line no-eval
      const evalResult = eval(safeExpr);
      if (evalResult !== undefined && !isNaN(evalResult) && isFinite(evalResult)) {
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

  const buttons = [
    { label: expression ? 'C' : 'AC', onClick: clearAll, type: 'action' },
    { label: '±', onClick: toggleSign, type: 'action' },
    { label: '%', onClick: () => handleInput('%'), type: 'action' },
    { label: '÷', onClick: () => handleInput('÷'), type: 'operator' },
    
    { label: '7', onClick: () => handleInput('7'), type: 'number' },
    { label: '8', onClick: () => handleInput('8'), type: 'number' },
    { label: '9', onClick: () => handleInput('9'), type: 'number' },
    { label: '×', onClick: () => handleInput('×'), type: 'operator' },
    
    { label: '4', onClick: () => handleInput('4'), type: 'number' },
    { label: '5', onClick: () => handleInput('5'), type: 'number' },
    { label: '6', onClick: () => handleInput('6'), type: 'number' },
    { label: '-', onClick: () => handleInput('-'), type: 'operator' },
    
    { label: '1', onClick: () => handleInput('1'), type: 'number' },
    { label: '2', onClick: () => handleInput('2'), type: 'number' },
    { label: '3', onClick: () => handleInput('3'), type: 'number' },
    { label: '+', onClick: () => handleInput('+'), type: 'operator' },
    
    { label: '0', onClick: () => handleInput('0'), type: 'number' },
    { label: '.', onClick: () => handleInput('.'), type: 'number' },
    { label: '=', onClick: calculate, type: 'operator' },
  ];

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-black font-sans select-none overflow-hidden pb-10">
      {/* Display Area */}
      <div className="flex-1 flex flex-col justify-end items-end p-6 mb-2 overflow-hidden">
        <div 
          className="text-white text-right w-full break-all font-light tracking-tight"
          style={{
            fontSize: (result || expression).length > 8 ? '2.5rem' : ((result || expression).length > 5 ? '4rem' : '5.5rem'),
            lineHeight: 1.1,
            transition: 'font-size 0.1s ease-in-out'
          }}
        >
          {result || expression || '0'}
        </div>
      </div>
      
      {/* Keypad */}
      <div className="grid grid-cols-4 gap-[min(4vw,14px)] max-w-[450px] w-full mx-auto px-[min(6vw,20px)]">
        {buttons.map((btn, i) => {
          const isZero = btn.label === '0';
          return (
            <button
              key={i}
              onClick={btn.onClick}
              className={`
                aspect-square rounded-full text-3xl sm:text-4xl font-normal flex items-center transition-colors active:opacity-70
                ${isZero ? 'col-span-2 !aspect-auto justify-start pl-[min(8vw,1.75rem)]' : 'justify-center'}
                ${btn.type === 'action' ? 'bg-[#a5a5a5] text-black active:bg-[#d4d4d2]' : ''}
                ${btn.type === 'operator' ? 'bg-[#ffcc00] text-black active:bg-[#ffe6a7]' : ''}
                ${btn.type === 'number' ? 'bg-[#333333] text-white active:bg-[#737373]' : ''}
              `}
            >
              {btn.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
