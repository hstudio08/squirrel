'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();
  const [clickCount, setClickCount] = useState(0);

  useEffect(() => {
    if (!loading && user) {
      router.push('/chat');
    }
  }, [user, loading, router]);

  // Handle continuous clicks with a timeout reset
  useEffect(() => {
    if (clickCount > 0 && clickCount < 5) {
      const timer = setTimeout(() => {
        setClickCount(0); // Reset if not clicked fast enough
      }, 600); // 600ms window between clicks
      return () => clearTimeout(timer);
    }
  }, [clickCount]);

  const handleSecretClick = () => {
    setClickCount((prev) => {
      const newCount = prev + 1;
      if (newCount === 5) {
        signIn();
        return 0;
      }
      return newCount;
    });
  };

  if (loading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-black">
      </main>
    );
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-black text-white items-center justify-center relative overflow-hidden font-sans select-none">
      
      {/* Viewfinder UI Elements */}
      <div className="absolute top-8 left-8 border-t-2 border-l-2 border-white/30 w-12 h-12 rounded-tl-lg" />
      <div className="absolute top-8 right-8 border-t-2 border-r-2 border-white/30 w-12 h-12 rounded-tr-lg" />
      <div className="absolute bottom-8 left-8 border-b-2 border-l-2 border-white/30 w-12 h-12 rounded-bl-lg" />
      <div className="absolute bottom-8 right-8 border-b-2 border-r-2 border-white/30 w-12 h-12 rounded-br-lg" />
      
      {/* Top UI */}
      <div className="absolute top-12 flex justify-between w-full px-16 text-xs text-white/50 tracking-[0.2em] font-medium">
        <span>30X</span>
        <span>REC</span>
      </div>

      {/* Main Camera Lens (Secret Auth Trigger) */}
      <div className="relative flex items-center justify-center group" style={{ WebkitTapHighlightColor: 'transparent' }}>
        
        {/* Outer Ring */}
        <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-full border border-white/10 flex items-center justify-center bg-gradient-to-br from-white/5 to-transparent shadow-[inset_0_0_50px_rgba(0,0,0,0.5)]">
          
          {/* Middle Ring */}
          <div className="w-48 h-48 sm:w-60 sm:h-60 rounded-full border border-white/5 flex items-center justify-center bg-[#0a0a0a] shadow-2xl relative overflow-hidden">
            
            {/* Inner Lens / Glass */}
            <button 
              onClick={handleSecretClick}
              className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-br from-[#1a1a1a] to-black border-2 border-zinc-900 shadow-[inset_0_-10px_20px_rgba(255,255,255,0.02),0_10px_30px_rgba(0,0,0,0.8)] flex items-center justify-center active:scale-95 transition-transform duration-100 ease-out z-10"
              aria-label="Capture"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-teal-500/30 bg-black/80 shadow-[inset_0_0_10px_rgba(0,255,170,0.1)] relative">
                {/* Subtle Reflection */}
                <div className="absolute top-2 right-4 w-6 h-4 bg-white/5 rounded-full blur-sm transform rotate-45" />
              </div>
            </button>

            {/* Aperture Blades (Decorative) */}
            <div className="absolute inset-0 border-[30px] border-[#0d0d0d] rounded-full opacity-50 pointer-events-none" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />

          </div>
        </div>
      </div>

      {/* Bottom UI */}
      <div className="absolute bottom-12 flex flex-col items-center gap-2">
        <h1 className="text-xl tracking-[0.3em] font-light text-white/80">30xCam</h1>
        <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
      </div>

    </main>
  );
}
