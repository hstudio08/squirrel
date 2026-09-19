'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Bot, Sparkles, Zap, Shield, ArrowRight } from 'lucide-react';

export default function DecoyPage() {
  const [clickCount, setClickCount] = useState(0);
  const router = useRouter();
  const lastClickRef = useRef<number>(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

  const allowedEmails = ['officialhaadi81@gmail.com', 'sadiyaayoub22019@gmail.com'];

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && user.email && allowedEmails.includes(user.email)) {
        router.push('/chat');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleSecretClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const now = Date.now();
    let currentCount = clickCount;
    
    // Reset if more than 1 second between clicks
    if (now - lastClickRef.current > 2000) {
      currentCount = 0;
    }
    
    currentCount++;
    setClickCount(currentCount);
    lastClickRef.current = now;

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }
    
    clickTimerRef.current = setTimeout(() => {
      setClickCount(0);
    }, 2000);

    if (currentCount >= 5) {
      setClickCount(0);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      signInWithPopup(auth, provider)
        .then(async (result) => {
          const email = result.user?.email;
          if (email && allowedEmails.includes(email)) {
            await setDoc(doc(db, 'users', result.user.uid), {
              uid: result.user.uid,
              email: result.user.email,
              displayName: result.user.displayName,
              photoURL: result.user.photoURL,
              lastLogin: serverTimestamp()
            }, { merge: true });
            router.push('/chat');
          } else {
            auth.signOut();
            alert('Service unavailable in your region. Please try again later.');
          }
        })
        .catch((error) => {
          console.error('Login failed', error);
        });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-blue-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-blue-600 p-2 rounded-xl">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <h1 
              className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent select-none"
            >
              AI Plus
            </h1>
          </div>
          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-600">
            <a href="#" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Enterprise</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Pricing</a>
            <a href="#" className="px-4 py-2 bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-colors">Try for free</a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 py-20 md:py-32 flex flex-col items-center text-center">
        <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-8">
          <Sparkles className="w-4 h-4" />
          <span>Introducing AI Plus Version 4.0</span>
        </div>
        
        <h2 
          onClick={handleSecretClick}
          className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 max-w-4xl leading-tight select-none cursor-default"
        >
          The future of <span className="text-blue-600">intelligence</span> is here.
        </h2>
        
        <p className="text-lg md:text-xl text-slate-600 max-w-2xl mb-10 leading-relaxed">
          AI Plus brings cutting-edge natural language processing, predictive modeling, and automation to your daily workflow. Supercharge your productivity.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <button className="px-8 py-4 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2 w-full sm:w-auto justify-center">
            <span>Get Started</span>
            <ArrowRight className="w-5 h-5" />
          </button>
          <button className="px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-full font-medium hover:bg-slate-50 transition-colors w-full sm:w-auto justify-center">
            Read Documentation
          </button>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-32 w-full text-left">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold mb-3">Lightning Fast</h3>
            <p className="text-slate-600 leading-relaxed">Get responses in milliseconds. Our optimized neural networks process complex queries faster than ever before.</p>
          </div>
          
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
              <Sparkles className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-xl font-bold mb-3">Context Aware</h3>
            <p className="text-slate-600 leading-relaxed">AI Plus remembers your past interactions, providing highly personalized and contextually relevant suggestions.</p>
          </div>
          
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6">
              <Shield className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold mb-3">Enterprise Security</h3>
            <p className="text-slate-600 leading-relaxed">Your data remains yours. With end-to-end encryption and strict privacy protocols, we never train on your private data.</p>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 text-sm text-center">
        <p>&copy; 2026 AI Plus Technologies Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
