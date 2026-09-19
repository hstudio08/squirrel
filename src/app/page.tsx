'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Bot, Sparkles, Shield, ArrowRight, BrainCircuit, Cpu, Network, Lock, ChevronDown, Globe, Command, Terminal, Server, Database, Code, Activity, ShieldCheck, Box } from 'lucide-react';

export default function SquirrelLandingPage() {
  const [clickCount, setClickCount] = useState(0);
  const router = useRouter();
  const lastClickRef = useRef<number>(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [scrolled, setScrolled] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const allowedEmails = ['officialhaadi81@gmail.com', 'sadiyaayoub22019@gmail.com'];

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    
    if (now - lastClickRef.current > 2000) currentCount = 0;
    
    currentCount++;
    setClickCount(currentCount);
    lastClickRef.current = now;

    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => setClickCount(0), 2000);

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
            alert('Access Denied. This is a private environment.');
          }
        })
        .catch((error) => console.error('Login failed', error));
    }
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDemoClick = () => {
    alert("Agentic Demo is currently compiling neural weights. Please wait for the next rollout or contact the administrator.");
  };

  const features = Array.from({length: 24}).map((_, i) => ({
    title: `Agentic Protocol ${i+1}.0`,
    desc: `Deploy autonomous AI agents that reason, plan, and execute multi-step workflows. Protocol ${i+1}.0 introduces dynamic memory allocation and recursive self-improvement algorithms for maximum operational efficiency without human intervention.`,
  }));

  const faqs = Array.from({length: 15}).map((_, i) => ({
    q: `How does Agentic Swarm Architecture (Question ${i+1}) ensure alignment?`,
    a: `Through continuous cryptographic verification and Constitutional AI parameters. Our agentic swarms communicate across an encrypted neural plane, peer-reviewing proposed actions before interacting with external APIs or executing codebase alterations. Privacy and strict operational boundaries are hardcoded at the protocol level.`
  }));

  const privacyParagraphs = Array.from({length: 30}).map((_, i) => 
    `Section ${i+1}: This application is fundamentally a private tool. The information, AI responses, and synthetic data provided on this platform are not guaranteed to be accurate, correct, or suitable for any specific purpose. The operators of this platform assume no liability for the actions taken by autonomous agents or human users. All interactions are securely stored but we explicitly state that outputs from our Agentic AI models may contain hallucinations, bias, or logical errors. Users must exercise independent verification. By continuing to use this private environment, you acknowledge the experimental nature of autonomous agentic systems.`
  );

  return (
    <div className="min-h-screen bg-[#050505] font-sans text-slate-300 selection:bg-blue-500/30 overflow-x-hidden">
      
      {/* Privacy Policy Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#1a1a1a] rounded-t-2xl">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <ShieldCheck className="text-blue-500" /> Privacy & Legal Terms
              </h2>
              <button onClick={() => setShowPrivacy(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-gray-400">
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl font-medium">
                IMPORTANT NOTICE: This is a strictly PRIVATE website. Access is restricted to authorized personnel only.
              </div>
              <p className="text-lg text-white font-semibold">Disclaimer of Accuracy</p>
              <p>The information, synthetic intelligence responses, and agentic workflows presented on this website are experimental. The data generated by our AI models is NOT necessarily correct, reliable, or safe for critical operations. By using this platform, you acknowledge that Agentic AI can hallucinate, fabricate logic, and execute unintended programmatic commands.</p>
              
              <div className="h-px bg-white/10 my-4" />
              
              {privacyParagraphs.map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>
            <div className="p-6 border-t border-white/10 bg-[#1a1a1a] rounded-b-2xl flex justify-end">
              <button onClick={() => setShowPrivacy(false)} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors">
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-black/80 backdrop-blur-xl border-b border-white/10 py-3' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={handleSecretClick} title="Click 5 times to authenticate">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2.5 rounded-xl group-hover:shadow-[0_0_20px_rgba(37,99,235,0.5)] transition-all duration-500">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent tracking-tight select-none">
              SQUIRREL<span className="text-blue-500">.AI</span>
            </h1>
          </div>
          
          <nav className="hidden lg:flex items-center space-x-8 text-sm font-medium text-gray-400">
            <button onClick={() => scrollToSection('agentic')} className="hover:text-white transition-colors">Agentic Core</button>
            <button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors">Capabilities</button>
            <button onClick={() => scrollToSection('architecture')} className="hover:text-white transition-colors">Architecture</button>
            <button onClick={() => scrollToSection('faq')} className="hover:text-white transition-colors">FAQ</button>
            <button onClick={() => setShowPrivacy(true)} className="hover:text-white transition-colors flex items-center gap-1"><Shield size={14}/> Privacy</button>
          </nav>

          <div className="flex items-center space-x-4">
            <button onClick={handleDemoClick} className="hidden md:flex px-4 py-2 text-sm font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all">
              Initialize Node
            </button>
            <button onClick={handleDemoClick} className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] rounded-full transition-all flex items-center gap-2">
              Launch Protocol <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 lg:pt-56 lg:pb-32 px-6 overflow-hidden flex flex-col items-center text-center">
        {/* Background Gradients */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-[120px] -z-10 opacity-50" />
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[100px] -z-10 opacity-50" />

        <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 px-5 py-2 rounded-full text-sm font-semibold mb-8 animate-fade-in-up shadow-[0_0_15px_rgba(59,130,246,0.15)] cursor-default">
          <Sparkles className="w-4 h-4" />
          <span>Agentic Swarm Protocol v4.0 is now live</span>
        </div>
        
        <h2 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-8 max-w-5xl leading-[1.1] text-white">
          Autonomous AI.<br/>
          <span className="bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
            No Human Required.
          </span>
        </h2>
        
        <p className="text-lg md:text-xl text-gray-400 max-w-3xl mb-12 leading-relaxed">
          Welcome to the private nexus of Agentic AI. Squirrel isn't just a chatbot; it's a swarm of autonomous intelligent agents that plan, code, execute, and iterate. We provide the infrastructure for true AGI emulation.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <button onClick={handleDemoClick} className="px-8 py-4 bg-white text-black rounded-full font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto text-lg">
            <Command size={20} /> Deploy Agent
          </button>
          <button onClick={() => scrollToSection('architecture')} className="px-8 py-4 bg-transparent border border-white/20 text-white rounded-full font-bold hover:bg-white/5 transition-colors w-full sm:w-auto text-lg">
            View Architecture
          </button>
        </div>

        {/* Dashboard Preview / Code Window */}
        <div className="mt-24 w-full max-w-5xl relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur opacity-30" />
          <div className="relative bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 shadow-2xl">
            <div className="flex items-center gap-2 mb-4 px-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <div className="ml-4 text-xs text-gray-500 font-mono flex items-center gap-2">
                <Lock size={12}/> secure_terminal_session_8891.sh
              </div>
            </div>
            <div className="bg-black rounded-xl p-6 text-left font-mono text-sm overflow-x-auto border border-white/5 h-[300px] overflow-y-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black pointer-events-none" />
              <p className="text-green-400">root@squirrel-core:~# <span className="text-white">init_swarm --agents 5000</span></p>
              <p className="text-gray-400 mt-2">[✓] Authenticated private node.</p>
              <p className="text-gray-400">[✓] Allocating 5000 neural worker threads...</p>
              <p className="text-blue-400 mt-2">Agent 001: Analyzing repository architecture...</p>
              <p className="text-blue-400">Agent 002: Drafting self-optimizing database schema...</p>
              <p className="text-purple-400">Agent 003: Penetration testing endpoints...</p>
              <p className="text-blue-400 mt-2">Swarm consensus reached. Compiling operational plan.</p>
              <p className="text-yellow-400 mt-2">WARNING: Unsupervised execution enabled. Results may be non-deterministic.</p>
              <p className="text-gray-400 mt-2">Executing multi-step reasoning protocol...</p>
              <br/>
              <p className="text-green-400 animate-pulse">_</p>
            </div>
          </div>
        </div>
      </section>

      {/* Logo Cloud */}
      <section className="py-10 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm font-semibold text-gray-500 tracking-widest uppercase mb-8">Powering Next-Gen Systems</p>
          <div className="flex flex-wrap justify-center gap-12 md:gap-24 opacity-40 grayscale">
            <div className="flex items-center gap-2 font-black text-xl"><Box /> NEURALCORP</div>
            <div className="flex items-center gap-2 font-black text-xl"><Network /> SWARM.IO</div>
            <div className="flex items-center gap-2 font-black text-xl"><Activity /> SYNAPSE</div>
            <div className="flex items-center gap-2 font-black text-xl"><Globe /> NEXUS</div>
          </div>
        </div>
      </section>

      {/* Agentic Core Explanation */}
      <section id="agentic" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6">Beyond Large Language Models</h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              LLMs just talk. Agentic AI acts. Squirrel connects reasoning engines to read/write tools, allowing AI to independently navigate the internet, write code, and solve complex multi-stage problems.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-12 items-center">
            <div className="lg:w-1/2 space-y-6">
              {[
                { icon: BrainCircuit, title: 'Multi-Step Reasoning', desc: 'Agents break down complex goals into logical sub-tasks, continually evaluating their own progress and correcting course when logic fails.' },
                { icon: Terminal, title: 'Tool Execution', desc: 'Direct CLI access, web scraping, API calls, and database mutations. The AI is not sandboxed to text generation; it operates a full headless environment.' },
                { icon: Network, title: 'Swarm Collaboration', desc: 'Sub-agents are dynamically spun up to handle parallel tasks. A Planner agent dictates the architecture while Coder and Reviewer agents execute the build.' },
              ].map((item, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 p-6 rounded-2xl hover:bg-white/10 transition-colors flex gap-6 group cursor-pointer" onClick={handleDemoClick}>
                  <div className="bg-blue-500/10 p-4 rounded-xl h-fit text-blue-400 group-hover:text-blue-300 group-hover:bg-blue-500/20 transition-colors">
                    <item.icon size={28} />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-white mb-2">{item.title}</h4>
                    <p className="text-gray-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="lg:w-1/2 w-full">
              <div className="relative aspect-square max-w-md mx-auto">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 to-purple-600/20 rounded-full animate-pulse blur-3xl" />
                <div className="relative h-full w-full border border-white/10 bg-black/50 backdrop-blur-xl rounded-full flex items-center justify-center">
                  <div className="absolute w-[80%] h-[80%] border border-dashed border-white/20 rounded-full animate-[spin_20s_linear_infinite]" />
                  <div className="absolute w-[60%] h-[60%] border border-dashed border-blue-500/30 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
                  <div className="w-32 h-32 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(37,99,235,0.6)]">
                    <Cpu className="text-white w-12 h-12" />
                  </div>
                  <div className="absolute top-[10%] left-[20%] w-12 h-12 bg-[#111] border border-white/20 rounded-full flex items-center justify-center shadow-lg">
                    <Database className="text-gray-400 w-5 h-5" />
                  </div>
                  <div className="absolute bottom-[10%] right-[20%] w-12 h-12 bg-[#111] border border-white/20 rounded-full flex items-center justify-center shadow-lg">
                    <Globe className="text-gray-400 w-5 h-5" />
                  </div>
                  <div className="absolute top-[40%] right-[5%] w-12 h-12 bg-[#111] border border-white/20 rounded-full flex items-center justify-center shadow-lg">
                    <Code className="text-gray-400 w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Massive Features Grid */}
      <section id="features" className="py-32 px-6 bg-black relative">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="mb-20">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6">Massively Parallel Capabilities</h2>
            <p className="text-gray-400 max-w-2xl text-lg">
              Explore the vast array of autonomous features built into the Squirrel core protocol.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="bg-white/5 border border-white/10 p-8 rounded-2xl hover:bg-white/10 transition-all duration-300 group cursor-pointer" onClick={handleDemoClick}>
                <div className="w-14 h-14 bg-gradient-to-br from-gray-800 to-black border border-white/10 rounded-xl flex items-center justify-center mb-6 shadow-lg group-hover:border-blue-500/50 transition-all">
                  <Server className="text-blue-400 w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-4">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture / How it Works */}
      <section id="architecture" className="py-32 px-6 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black text-white text-center mb-20">System Architecture</h2>
          
          <div className="flex flex-col space-y-12">
            {[
              { step: '01', title: 'Intent Parsing & Verification', desc: 'User input is cryptographically signed and parsed by the Master Node to ensure authorization before being broken down into an AST (Abstract Syntax Tree) of actionable sub-goals.' },
              { step: '02', title: 'Agent Spawning', desc: 'For each sub-goal, a specialized Micro-Agent is spawned. Agents are equipped with specific tools (File I/O, Web Search, REPL environment) based on strict least-privilege principles.' },
              { step: '03', title: 'Autonomous Execution Loop', desc: 'Agents enter a Thought-Action-Observation loop. They write code, execute it, read the terminal output, and fix their own bugs until the sub-goal tests pass.' },
              { step: '04', title: 'Swarm Consensus', desc: 'Once all agents complete their tasks, a Reviewer Agent merges the code, checks for security regressions, and presents the final artifact to the user for approval.' }
            ].map((arch, idx) => (
              <div key={idx} className="flex flex-col md:flex-row gap-8 items-start relative">
                {idx !== 3 && <div className="hidden md:block absolute left-12 top-24 bottom-[-3rem] w-px bg-white/10" />}
                <div className="w-24 h-24 shrink-0 bg-blue-900/20 border border-blue-500/30 rounded-2xl flex items-center justify-center text-3xl font-black text-blue-500 z-10">
                  {arch.step}
                </div>
                <div className="bg-white/5 border border-white/10 p-8 rounded-2xl flex-1 hover:border-white/20 transition-colors">
                  <h3 className="text-2xl font-bold text-white mb-4">{arch.title}</h3>
                  <p className="text-gray-400 leading-relaxed text-lg">{arch.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-32 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6">Frequently Asked Questions</h2>
            <p className="text-gray-400">Everything you need to know about the private agentic platform.</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <button 
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
                >
                  <span className="font-semibold text-white pr-8">{faq.q}</span>
                  <ChevronDown className={`shrink-0 text-gray-500 transition-transform duration-300 ${activeFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                <div className={`px-6 overflow-hidden transition-all duration-300 ${activeFaq === idx ? 'max-h-96 pb-5 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <p className="text-gray-400 leading-relaxed">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-64 bg-blue-500/20 blur-[100px] rounded-full" />
        
        <div className="max-w-4xl mx-auto relative z-10 text-center bg-[#111]/80 backdrop-blur-2xl border border-white/10 p-12 md:p-20 rounded-3xl shadow-2xl">
          <Bot className="w-16 h-16 text-blue-500 mx-auto mb-8" />
          <h2 className="text-4xl md:text-6xl font-black text-white mb-6">Ready to initiate the swarm?</h2>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            Authorized personnel only. Access to the neural core requires strict biometric authentication and cryptographic clearance.
          </p>
          <button onClick={handleSecretClick} className="px-10 py-5 bg-white text-black rounded-full font-bold text-lg hover:bg-gray-200 hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)]">
            Authenticate Session
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-16 px-6 border-t border-white/10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-6 cursor-pointer" onClick={handleSecretClick} title="Click 5 times to authenticate">
              <Bot className="w-6 h-6 text-white" />
              <span className="text-xl font-black tracking-tight text-white">SQUIRREL<span className="text-blue-500">.AI</span></span>
            </div>
            <p className="text-gray-500 max-w-sm leading-relaxed mb-6">
              A highly classified, private agentic AI environment. Not intended for public use. Data generated may be hallucinatory or experimental.
            </p>
            <div className="flex space-x-4">
              <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 cursor-pointer transition-colors"><Globe size={18}/></div>
              <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 cursor-pointer transition-colors"><Terminal size={18}/></div>
              <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 cursor-pointer transition-colors"><Code size={18}/></div>
            </div>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-6">Infrastructure</h4>
            <ul className="space-y-4 text-gray-500">
              <li><button onClick={handleDemoClick} className="hover:text-blue-400 transition-colors">Neural Core</button></li>
              <li><button onClick={handleDemoClick} className="hover:text-blue-400 transition-colors">Swarm API</button></li>
              <li><button onClick={handleDemoClick} className="hover:text-blue-400 transition-colors">Database Schema</button></li>
              <li><button onClick={handleDemoClick} className="hover:text-blue-400 transition-colors">Security Audit</button></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-6">Legal</h4>
            <ul className="space-y-4 text-gray-500">
              <li><button onClick={() => setShowPrivacy(true)} className="hover:text-blue-400 transition-colors">Privacy Policy</button></li>
              <li><button onClick={() => setShowPrivacy(true)} className="hover:text-blue-400 transition-colors">Terms of Service</button></li>
              <li><button onClick={() => setShowPrivacy(true)} className="hover:text-blue-400 transition-colors">Data Disclaimer</button></li>
              <li><span className="text-red-500/80 font-medium text-xs border border-red-500/20 px-2 py-1 rounded mt-2 inline-block">PRIVATE ACCESS ONLY</span></li>
            </ul>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-600">
          <p>&copy; 2026 SQUIRREL.AI SYNTHETIC INTELLIGENCE. ALL RIGHTS RESERVED.</p>
          <div className="flex space-x-6">
            <span>System Status: <span className="text-green-500">Online</span></span>
            <span>Active Agents: <span className="text-blue-500">5,032</span></span>
          </div>
        </div>
      </footer>
    </div>
  );
}
