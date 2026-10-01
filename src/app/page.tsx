'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithRedirect, getRedirectResult, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth, db, googleProvider } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import Calculator from '@/components/Calculator';
import { Sparkles, BrainCircuit, Cpu, Network, ShieldCheck, Zap, Layers, Code, Bot, Menu, X } from 'lucide-react';

function AIHubLandingPage() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const lastClickRef = useRef<number>(0);
  const clickCountRef = useRef<number>(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [scrolled, setScrolled] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    getRedirectResult(auth).then(async (result) => {
      if (result?.user) {
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
      if (user) {
        router.push('/chat');
      }
    });
    return () => unsubscribe();
  }, [router]);

  // SECRET LOGIN TRIGGER: Click logo 5 times quickly
  const handleSecretClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const now = Date.now();
    let currentCount = clickCountRef.current;
    
    if (now - lastClickRef.current > 1500) currentCount = 0;
    
    currentCount++;
    clickCountRef.current = currentCount;
    lastClickRef.current = now;

    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => { clickCountRef.current = 0; }, 1500);

    if (currentCount >= 5) {
      if (isLoggingIn) return;
      setIsLoggingIn(true);
      clickCountRef.current = 0;
      
      if (auth.currentUser) {
        setIsLoggingIn(false);
        router.push('/chat');
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
        signInWithRedirect(auth, googleProvider)
          .catch((error) => {
            console.error('Login failed:', error);
            setIsLoggingIn(false);
          });
      }
    }
  };

  const models = [
    {
      name: "Gemini 1.5 Pro",
      company: "Google DeepMind",
      desc: "Features a massive 2 million token context window, making it unparalleled for analyzing large codebases, hours of video, and extensive document libraries.",
      icon: <Sparkles className="text-blue-500 w-6 h-6" />,
      color: "border-blue-100 bg-blue-50/30"
    },
    {
      name: "Claude 3.5 Sonnet",
      company: "Anthropic",
      desc: "The industry leader in coding and reasoning speed. Operates with exceptional nuance, fewer refusals, and masterful grasp of complex instructions.",
      icon: <BrainCircuit className="text-amber-600 w-6 h-6" />,
      color: "border-amber-100 bg-amber-50/30"
    },
    {
      name: "Antigravity",
      company: "Google Advanced Agentic",
      desc: "A highly experimental, autonomous coding agent system capable of planning, self-healing, and executing multi-step software engineering tasks in isolated environments.",
      icon: <Cpu className="text-purple-500 w-6 h-6" />,
      color: "border-purple-100 bg-purple-50/30"
    },
    {
      name: "GitHub Copilot Enterprise",
      company: "Microsoft / OpenAI",
      desc: "Deeply integrated contextual AI that understands your entire organization's repositories, pull requests, and documentation for real-time pair programming.",
      icon: <Code className="text-slate-700 w-6 h-6" />,
      color: "border-slate-200 bg-slate-50/50"
    },
    {
      name: "GPT-4o",
      company: "OpenAI",
      desc: "Omni-modal architecture processing text, audio, and images in real-time. Unmatched conversational speed and versatile general-purpose intelligence.",
      icon: <Network className="text-emerald-500 w-6 h-6" />,
      color: "border-emerald-100 bg-emerald-50/30"
    },
    {
      name: "Llama 3 400B",
      company: "Meta",
      desc: "The bleeding edge of open-weight models. Delivers proprietary-level performance in a locally deployable, highly fine-tunable architecture.",
      icon: <Layers className="text-blue-600 w-6 h-6" />,
      color: "border-blue-100 bg-blue-50/30"
    }
  ];

  const handleDemoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    alert("API limits reached for this hour. Please join the developer waitlist.");
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800">
      
      {/* Header */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md border-b border-slate-200 py-3 shadow-sm' : 'bg-transparent py-4 md:py-6'}`}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-900 rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <span className="text-xl md:text-2xl font-black tracking-tight text-slate-900">
              AI <span className="text-blue-600">Plus</span>
            </span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8 font-medium text-sm text-slate-600">
            <a href="#" className="hover:text-blue-600 transition-colors">Models</a>
            <a href="#" className="hover:text-blue-600 transition-colors">API Docs</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Pricing</a>
            <a href="#" onClick={handleDemoClick} className="px-5 py-2.5 bg-slate-900 text-white rounded-full hover:bg-blue-600 transition-colors shadow-sm">
              Get API Key
            </a>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden p-2 text-slate-600"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Nav */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white border-b border-slate-200 px-4 py-4 flex flex-col space-y-4 shadow-lg">
            <a href="#" className="font-medium text-slate-700 py-2">Models</a>
            <a href="#" className="font-medium text-slate-700 py-2">API Docs</a>
            <a href="#" className="font-medium text-slate-700 py-2">Pricing</a>
            <button onClick={handleDemoClick} className="w-full py-3 bg-slate-900 text-white rounded-lg font-medium mt-2">
              Get API Key
            </button>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-16 md:pt-48 md:pb-24 px-4 md:px-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[800px] h-[400px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center space-x-2 bg-blue-50 border border-blue-100 px-3 md:px-4 py-1.5 md:py-2 rounded-full text-blue-700 text-xs md:text-sm font-semibold mb-6 md:mb-8">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>Now supporting 25+ foundational models</span>
          </div>
          <h1 
            onClick={handleSecretClick} 
            className="text-4xl md:text-6xl lg:text-7xl font-black text-slate-900 tracking-tight leading-[1.1] mb-6 md:mb-8 cursor-pointer select-none"
          >
            One Unified API.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              Infinite Intelligence.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed mb-8 md:mb-10 px-2">
            Seamlessly route your prompts to Gemini, Claude, Antigravity, Copilot, and 20+ other leading AI models with a single line of code. Built for scale, optimized for speed.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 px-4">
            <button onClick={handleDemoClick} className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-lg transition-all shadow-lg hover:shadow-blue-500/25">
              Start Building Free
            </button>
            <button onClick={handleDemoClick} className="w-full sm:w-auto px-8 py-4 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-full font-bold text-lg transition-all">
              Read Documentation
            </button>
          </div>
        </div>
      </section>

      {/* Model Grid Section */}
      <section className="py-16 md:py-24 px-4 md:px-6 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 md:mb-16 text-center md:text-left">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">Supported Architectures</h2>
            <p className="text-slate-600 text-base md:text-lg max-w-2xl">Access the world's most powerful reasoning engines, multimodal models, and autonomous agents through our zero-latency gateway.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {models.map((model, idx) => (
              <div key={idx} className={`p-6 md:p-8 rounded-3xl bg-white border ${model.color} shadow-sm hover:shadow-md transition-all`}>
                <div className="w-12 h-12 md:w-14 md:h-14 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-slate-100">
                  {model.icon}
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">{model.name}</h3>
                <p className="text-xs md:text-sm font-semibold text-slate-400 mb-4 tracking-wide uppercase">{model.company}</p>
                <p className="text-slate-600 leading-relaxed text-sm md:text-base">
                  {model.desc}
                </p>
              </div>
            ))}
          </div>
          
          <div className="mt-12 text-center">
            <p className="text-slate-500 font-medium">...and 20+ other open-source and proprietary models.</p>
          </div>
        </div>
      </section>

      {/* Trust & Stats */}
      <section className="py-20 md:py-32 px-4 md:px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-20 items-center">
            <div>
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-6 md:mb-8 leading-tight">
                Enterprise-grade routing. <br/>Military-grade security.
              </h2>
              <ul className="space-y-6">
                {[
                  { title: "Intelligent Fallbacks", desc: "If Claude rate-limits, we automatically route to GPT-4o with zero downtime." },
                  { title: "SOC2 Type II Compliant", desc: "Zero data retention. Your prompts are never used to train foundational models." },
                  { title: "Lowest Latency Guarantee", desc: "Edge-optimized infrastructure ensures you hit the fastest geographical node." }
                ].map((feature, idx) => (
                  <li key={idx} className="flex gap-4">
                    <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-base md:text-lg">{feature.title}</h4>
                      <p className="text-slate-600 text-sm md:text-base">{feature.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-6 md:p-8 rounded-3xl border border-slate-100">
                <p className="text-4xl md:text-5xl font-black text-blue-600 mb-2">99.9%</p>
                <p className="text-slate-600 font-medium text-sm md:text-base">Uptime SLA</p>
              </div>
              <div className="bg-slate-50 p-6 md:p-8 rounded-3xl border border-slate-100">
                <p className="text-4xl md:text-5xl font-black text-indigo-600 mb-2">15ms</p>
                <p className="text-slate-600 font-medium text-sm md:text-base">Avg Gateway Latency</p>
              </div>
              <div className="bg-slate-50 p-6 md:p-8 rounded-3xl border border-slate-100 col-span-2">
                <p className="text-4xl md:text-5xl font-black text-slate-900 mb-2">1.2B+</p>
                <p className="text-slate-600 font-medium text-sm md:text-base">Tokens routed daily</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 md:py-16 px-4 md:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 mb-12">
          <div className="col-span-1 sm:col-span-2">
            <div className="flex items-center space-x-2 mb-6">
              <Bot className="w-6 h-6 text-white" />
              <span className="text-xl font-black tracking-tight text-white">AI <span className="text-blue-500">Plus</span></span>
            </div>
            <p className="max-w-sm leading-relaxed text-sm md:text-base">
              The universal router for modern AI applications. Gemini, Claude, Antigravity, and OpenAI accessible under one unified protocol.
            </p>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-4">Developers</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-white transition-colors">API Reference</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Supported Models</a></li>
              <li><a href="#" className="hover:text-white transition-colors">System Status</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-4">Company</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">About</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Enterprise</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto pt-8 border-t border-slate-800 text-xs md:text-sm text-slate-500 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <p>&copy; 2026 AI Plus Gateway API. All Rights Reserved.</p>
          <div className="flex space-x-6">
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" /> All Systems Operational</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  const [isNative, setIsNative] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (isNative) {
    return <Calculator />;
  }
  
  return <AIHubLandingPage />;
}
