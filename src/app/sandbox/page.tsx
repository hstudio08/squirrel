"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function SandboxPage() {
  const [status, setStatus] = useState<{ state: string; last_changed: number } | null>(null);
  const [freezePresence, setFreezePresence] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/sandbox/status');
        const data = await res.json();
        
        if (res.ok) {
          setStatus(data.status);
          setFreezePresence(data.freezePresence);
        }
      } catch (e) {
        console.error("Error fetching sandbox status", e);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchStatus();

    // Poll every 1 second
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  // Format the last seen timestamp
  let formattedLastSeen = "Offline";
  if (status?.last_changed) {
    const date = new Date(status.last_changed);
    formattedLastSeen = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)} | ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center p-6 md:p-12 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden mt-10">
        <div className="bg-slate-800 p-6 text-center text-white">
          <h1 className="text-2xl font-bold tracking-tight">Sadiya's Phone</h1>
          <p className="text-slate-300 text-sm mt-1">This is exactly what she sees at the top of her chat.</p>
        </div>
        
        <div className="p-8 flex flex-col space-y-8">
          <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Haadi's Current Status</h2>
            
            {status?.state === 'online' ? (
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                <span className="text-lg font-bold text-blue-500">Online</span>
              </div>
            ) : (
              <div className="flex flex-col">
                <span className="text-lg font-bold text-slate-700">{formattedLastSeen}</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <p className="text-sm text-slate-500 leading-relaxed text-center mt-4">
              This sandbox is unauthenticated and mirrors exactly what Sadiya's app reads from the database.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
