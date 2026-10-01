'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup, getRedirectResult } from 'firebase/auth';
import { auth, db, googleProvider } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function Calculator() {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let isRedirecting = false;
    getRedirectResult(auth).then(async (result) => {
      if (result?.user) {
        isRedirecting = true;
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
        router.push('/chat');
      }
    }).catch(console.error);

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && !isRedirecting) {
        const savedPin = localStorage.getItem('squirrel_pin');
        if (!savedPin) {
          router.push('/chat');
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
      router.push('/chat');
      return;
    }

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
          router.push('/chat');
        }
      })
      .catch((error) => {
        console.error('Login failed:', error);
        setIsLoggingIn(false);
      });
  };

  const triggerPinLogin = () => {
    setExpression('');
    setResult('');
    if (auth.currentUser) {
      router.push('/chat');
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
      let safeExpr = expression.replace(/x/g, '*').replace(/÷/g, '/').replace(/%/g, '/100');
      
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
    { label: 'C', onClick: clearAll, className: 'text-red-400 bg-gray-800/80 hover:bg-gray-700' },
    { label: '⌫', onClick: backspace, className: 'text-green-400 bg-gray-800/80 hover:bg-gray-700' },
    { label: '%', onClick: () => handleInput('%'), className: 'text-green-400 bg-gray-800/80 hover:bg-gray-700' },
    { label: '÷', onClick: () => handleInput('÷'), className: 'text-green-400 bg-gray-800/80 hover:bg-gray-700' },
    
    { label: '7', onClick: () => handleInput('7'), className: 'text-gray-100 bg-gray-900/80 hover:bg-gray-800' },
    { label: '8', onClick: () => handleInput('8'), className: 'text-gray-100 bg-gray-900/80 hover:bg-gray-800' },
    { label: '9', onClick: () => handleInput('9'), className: 'text-gray-100 bg-gray-900/80 hover:bg-gray-800' },
    { label: 'x', onClick: () => handleInput('x'), className: 'text-green-400 bg-gray-800/80 hover:bg-gray-700' },
    
    { label: '4', onClick: () => handleInput('4'), className: 'text-gray-100 bg-gray-900/80 hover:bg-gray-800' },
    { label: '5', onClick: () => handleInput('5'), className: 'text-gray-100 bg-gray-900/80 hover:bg-gray-800' },
    { label: '6', onClick: () => handleInput('6'), className: 'text-gray-100 bg-gray-900/80 hover:bg-gray-800' },
    { label: '-', onClick: () => handleInput('-'), className: 'text-green-400 bg-gray-800/80 hover:bg-gray-700 text-4xl pb-1' },
    
    { label: '1', onClick: () => handleInput('1'), className: 'text-gray-100 bg-gray-900/80 hover:bg-gray-800' },
    { label: '2', onClick: () => handleInput('2'), className: 'text-gray-100 bg-gray-900/80 hover:bg-gray-800' },
    { label: '3', onClick: () => handleInput('3'), className: 'text-gray-100 bg-gray-900/80 hover:bg-gray-800' },
    { label: '+', onClick: () => handleInput('+'), className: 'text-green-400 bg-gray-800/80 hover:bg-gray-700 text-3xl' },
    
    { label: '00', onClick: () => handleInput('00'), className: 'text-gray-100 bg-gray-900/80 hover:bg-gray-800' },
    { label: '0', onClick: () => handleInput('0'), className: 'text-gray-100 bg-gray-900/80 hover:bg-gray-800' },
    { label: '.', onClick: () => handleInput('.'), className: 'text-gray-100 bg-gray-900/80 hover:bg-gray-800' },
    { label: '=', onClick: calculate, className: 'text-white bg-green-500 hover:bg-green-400 text-4xl pb-1' },
  ];

  return (
    <div className="flex flex-col h-[100dvh] bg-[#000000] font-sans overflow-hidden">
      {/* Display Area */}
      <div className="flex-1 flex flex-col justify-end items-end p-8 pb-6 space-y-3">
        <div className="text-gray-400 text-3xl font-light tracking-widest break-all text-right w-full min-h-[40px] opacity-80">
          {expression}
        </div>
        <div className="text-white text-6xl font-medium tracking-tight truncate w-full text-right transition-all">
          {result || (expression ? '' : '0')}
        </div>
      </div>
      
      {/* Keypad */}
      <div className="bg-[#111111] rounded-t-[2.5rem] p-6 pb-10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="grid grid-cols-4 gap-4">
          {buttons.map((btn, i) => (
            <button
              key={i}
              onClick={btn.onClick}
              className={`h-[4.5rem] rounded-2xl text-2xl font-semibold flex items-center justify-center transition-transform active:scale-90 ${btn.className}`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
