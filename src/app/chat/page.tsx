'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import ChatUI from '@/components/ChatUI';

export default function ChatPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (sessionStorage.getItem('chatUnlocked') === 'true') {
        setIsUnlocked(true);
      } else {
        router.push('/');
      }
    }
  }, [router]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading || !user || !isUnlocked) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-950 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px] pointer-events-none"></div>
        
        <div className="flex flex-col items-center space-y-8 z-10">
          {/* Complex Loader Ring */}
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full border-[3px] border-zinc-800"></div>
            <div className="absolute inset-0 rounded-full border-[3px] border-blue-500 border-t-transparent animate-spin"></div>
            <div className="absolute inset-3 rounded-full border-[3px] border-zinc-800"></div>
            <div className="absolute inset-3 rounded-full border-[3px] border-emerald-500 border-b-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-emerald-500 rounded-full animate-pulse shadow-[0_0_20px_rgba(59,130,246,0.5)]"></div>
            </div>
          </div>
          
          {/* Animated Text */}
          <div className="flex flex-col items-center space-y-3">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-zinc-200 to-zinc-400 bg-clip-text text-transparent animate-pulse">
              Preparing your experience
            </h2>
            <div className="flex space-x-1.5 items-center">
              <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return <ChatUI user={user} />;
}
