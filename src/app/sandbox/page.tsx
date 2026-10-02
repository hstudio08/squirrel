'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Loader2, Bell } from 'lucide-react';

export default function SandboxPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (!u) {
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleTestNotification = async () => {
    if (!user) return;
    setIsSending(true);
    setResult(null);
    try {
      const idToken = await user.getIdToken(true);
      const res = await fetch('/api/sandbox-notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setResult({ status: res.status, data });
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            <Bell className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Sandbox Test</h1>
          <p className="text-slate-500 text-sm">
            This will send a test push notification strictly to <span className="font-semibold">officialhaadi81@gmail.com</span> regardless of who is currently logged in.
          </p>
        </div>

        <button
          onClick={handleTestNotification}
          disabled={isSending}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-4 rounded-2xl shadow-md transition-all active:scale-[0.98] flex justify-center items-center space-x-2"
        >
          {isSending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Sending...</span>
            </>
          ) : (
            <span>Send Test Notification</span>
          )}
        </button>

        {result && (
          <div className="mt-6 p-4 bg-slate-100 rounded-xl overflow-x-auto border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Result:</h3>
            <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
