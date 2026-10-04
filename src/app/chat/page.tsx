'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import ChatUI from '@/components/ChatUI';

export default function ChatPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading && !user) {
      router.push('/');
    }
  }, [user, loading, router, mounted]);

  if (!mounted || loading || !user) {
    return (
      <main className="h-[100dvh] bg-black text-white flex flex-col font-sans overflow-hidden">
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes sleekLoad {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(250%); }
          }
        `}} />
        <div className="w-full h-[2px] bg-transparent overflow-hidden relative mt-[20dvh]">
          <div className="w-1/2 h-full bg-white rounded-full absolute" style={{ animation: 'sleekLoad 1.5s infinite ease-in-out' }} />
        </div>
      </main>
    );
  }

  return <ChatUI user={user} />;
}
