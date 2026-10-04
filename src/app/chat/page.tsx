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
    return <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-950" />;
  }

  return <ChatUI user={user} />;
}
