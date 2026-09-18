'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import ChatUI from '@/components/ChatUI';

export default function ChatPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-950">
        <p className="text-zinc-400">Loading...</p>
      </main>
    );
  }

  return <ChatUI user={user} />;
}
