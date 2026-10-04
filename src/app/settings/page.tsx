'use client';

import React, { useState, useRef, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { ArrowLeft, Lock, Bell, Zap, UserRound, MessageCircle, Edit2, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(
    typeof window !== 'undefined' 
      ? JSON.parse(localStorage.getItem('squirrel_cachedUser') || 'null')
      : null
  );
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let backListener: { remove: () => void } | null = null;
    let isActive = true;

    const setupBackButton = async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      
      const { App: CapacitorApp } = await import('@capacitor/app');
      
      if (!isActive) return;

      backListener = await CapacitorApp.addListener('backButton', () => {
        router.push('/chat');
      });
    };

    setupBackButton();

    return () => {
      isActive = false;
      if (backListener) backListener.remove();
    };
  }, [router]);

  // About / Status
  const [status, setStatus] = useState(typeof window !== 'undefined' ? localStorage.getItem('squirrel_status') || '' : '');

  // Friend Name (was partnerNickname)
  const [friendName, setFriendName] = useState(typeof window !== 'undefined' ? localStorage.getItem('squirrel_partnerNickname') || '' : '');

  // Quick Lock & Notifications
  const [quickLock, setQuickLock] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // App PIN
  const [appPin, setAppPin] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        localStorage.setItem('squirrel_cachedUser', JSON.stringify({
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          photoURL: u.photoURL
        }));
      }
      setLoading(false);
    });
    // Load saved values
    const savedPin = localStorage.getItem('squirrel_pin');
    if (savedPin) setAppPin(savedPin);
    const savedQuickLock = localStorage.getItem('squirrel_quick_lock');
    if (savedQuickLock === 'true') setQuickLock(true);
    const savedNotifs = localStorage.getItem('squirrel_notifications');
    if (savedNotifs === 'true') setNotificationsEnabled(true);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    } else if (user) {
      getDoc(doc(db, 'users', user.uid)).then(snap => {
        if (snap.exists()) {
          if (snap.data().status !== undefined) {
            setStatus(snap.data().status);
            localStorage.setItem('squirrel_status', snap.data().status);
          }
          if (snap.data().partnerNickname !== undefined) {
            setFriendName(snap.data().partnerNickname);
            localStorage.setItem('squirrel_partnerNickname', snap.data().partnerNickname);
          }
        }
      });
    }
  }, [user, loading, router]);

  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const showToastWithMessage = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 2500);
  };

  // Handlers
  const handleSaveStatus = async () => {
    if (!user || status.length > 35) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { status });
      localStorage.setItem('squirrel_status', status);
      showToastWithMessage('Status saved');
    } catch (error) {
      console.error("Failed to save status", error);
    }
  };

  const handleSaveFriendName = async () => {
    if (!user || friendName.length > 30) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { partnerNickname: friendName });
      localStorage.setItem('squirrel_partnerNickname', friendName);
      showToastWithMessage('Name saved');
    } catch (error) {
      console.error("Failed to save friend name", error);
    }
  };

  const handleSavePin = () => {
    const finalPin = appPin.replace(/\s/g, '');
    if (finalPin.length === 0) {
      localStorage.removeItem('squirrel_pin');
      setAppPin('');
      showToastWithMessage('PIN removed');
    } else if (/^\d{4}$/.test(finalPin)) {
      localStorage.setItem('squirrel_pin', finalPin);
      setAppPin(finalPin);
      showToastWithMessage('PIN saved');
    } else {
      setAppPin(localStorage.getItem('squirrel_pin') || '');
    }
  };

  const handleToggleNotifications = async () => {
    const val = !notificationsEnabled;
    if (val) {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { LocalNotifications } = await import('@capacitor/local-notifications');
          let permStatus = await LocalNotifications.checkPermissions();
          if (permStatus.display !== 'granted') {
            permStatus = await LocalNotifications.requestPermissions();
          }
          if (permStatus.display === 'granted') {
            setNotificationsEnabled(true);
            localStorage.setItem('squirrel_notifications', 'true');
            if (user) {
              updateDoc(doc(db, 'users', user.uid), { notificationsEnabled: true }).catch(() => {});
            }
          }
        } else {
          if ('Notification' in window) {
            Notification.requestPermission().then(permission => {
              if (permission === 'granted') {
                setNotificationsEnabled(true);
                localStorage.setItem('squirrel_notifications', 'true');
                if (user) {
                  updateDoc(doc(db, 'users', user.uid), { notificationsEnabled: true }).catch(() => {});
                }
              }
            });
          }
        }
      } catch (e) {
        console.error('Error setting up notifications', e);
      }
    } else {
      setNotificationsEnabled(false);
      localStorage.setItem('squirrel_notifications', 'false');
      if (user) {
        updateDoc(doc(db, 'users', user.uid), { notificationsEnabled: false }).catch(() => {});
      }
    }
  };

  if (!isMounted || !user) {
    return (
      <div className="h-dvh bg-[#F5F5F7] text-slate-900 flex flex-col font-sans overflow-hidden page-transition">
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes slideIn {
            from { opacity: 0; transform: translateX(20px); }
            to { opacity: 1; transform: translateX(0); }
          }
          .page-transition {
            animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          @keyframes sleekLoad {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(250%); }
          }
        `}} />
        <div className="w-full h-[2px] bg-transparent overflow-hidden relative">
          <div className="w-1/2 h-full bg-slate-400/50 rounded-full absolute" style={{ animation: 'sleekLoad 1.5s infinite ease-in-out' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-[#F5F5F7] text-slate-900 flex flex-col font-sans overflow-hidden page-transition">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .page-transition {
          animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />
      {/* Header */}
      <div className="px-3 pt-[max(env(safe-area-inset-top,1rem),1rem)] pb-3 flex items-center shrink-0">
        <button
          onClick={() => router.push('/chat')}
          className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-black/5 rounded-full transition-all active:scale-95"
        >
          <ArrowLeft size={24} strokeWidth={2} />
        </button>
        <h1 className="ml-2 text-[22px] font-semibold tracking-tight text-slate-900">Settings</h1>
      </div>

      <div className="flex-1 px-4 py-2 flex flex-col gap-3 overflow-hidden">
        
        {/* Profile Card */}
        <div className="bg-white border border-slate-200/60 shadow-sm rounded-[24px] p-4 flex flex-col gap-5">
          {/* Friend Name */}
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <UserRound size={22} strokeWidth={2} />
            </div>
            <div className="flex-1">
              <span className="text-[12px] font-medium text-slate-500 block mb-0.5">Friend's Name</span>
              <div className="flex items-center group relative">
                <input 
                  type="text" 
                  placeholder="Name"
                  maxLength={30}
                  value={friendName}
                  onChange={(e) => setFriendName(e.target.value)}
                  onBlur={handleSaveFriendName}
                  className="w-full bg-transparent outline-none text-slate-900 text-[16px] placeholder:text-slate-400 font-medium py-1 pr-8 border-b border-transparent focus:border-blue-400/30 transition-colors"
                />
                <Edit2 size={14} className="text-slate-300 absolute right-1 pointer-events-none" />
              </div>
            </div>
          </div>
          
          <div className="h-[1px] w-full bg-slate-100 ml-14" />
          
          {/* About */}
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <MessageCircle size={22} strokeWidth={2} />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <span className="text-[12px] font-medium text-slate-500 block mb-0.5">About</span>
                <span className="text-[10px] text-slate-400">{status.length}/35</span>
              </div>
              <div className="flex items-center relative">
                <input 
                  type="text" 
                  placeholder="What's up?"
                  maxLength={35}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  onBlur={handleSaveStatus}
                  className="w-full bg-transparent outline-none text-slate-900 text-[16px] placeholder:text-slate-400 font-medium py-1 pr-8 border-b border-transparent focus:border-purple-400/30 transition-colors"
                />
                <Edit2 size={14} className="text-slate-300 absolute right-1 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Security & System Card */}
        <div className="bg-white border border-slate-200/60 shadow-sm rounded-[24px] flex flex-col pt-1">
          {/* App PIN */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                <Lock size={22} strokeWidth={2} />
              </div>
              <div className="flex flex-col">
                <span className="text-[16px] font-medium text-slate-900">Unlock PIN</span>
                <span className="text-[13px] text-slate-500">4-digit calculator code</span>
              </div>
            </div>
            <input 
              type="text"
              inputMode="numeric"
              pattern="\d*"
              maxLength={4}
              placeholder="None"
              value={appPin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                setAppPin(val);
              }}
              onBlur={handleSavePin}
              className="w-28 h-12 bg-[#F2F2F7] rounded-xl px-2 py-3 text-center text-slate-900 font-bold text-[22px] tracking-[0.2em] outline-none border border-transparent focus:border-orange-400/50 transition-colors placeholder:tracking-normal placeholder:text-slate-400 placeholder:font-normal placeholder:text-[15px]"
            />
          </div>

          <div className="h-[1px] w-full bg-slate-100 ml-18" />

          {/* Quick Lock */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Zap size={22} strokeWidth={2} />
              </div>
              <div className="flex flex-col">
                <span className="text-[16px] font-medium text-slate-900">Quick Lock</span>
                <span className="text-[13px] text-slate-500">Lock instantly on minimize</span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={quickLock} 
                onChange={(e) => {
                  const val = e.target.checked;
                  setQuickLock(val);
                  localStorage.setItem('squirrel_quick_lock', val.toString());
                }} 
              />
              <div className="w-[48px] h-[26px] bg-[#E5E5EA] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[22px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-slate-200 after:rounded-full after:h-[22px] after:w-[22px] after:transition-all peer-checked:after:border-transparent peer-checked:bg-emerald-500 transition-colors"></div>
            </label>
          </div>

          <div className="h-[1px] w-full bg-slate-100 ml-18" />

          {/* Notifications */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Bell size={22} strokeWidth={2} />
              </div>
              <div className="flex flex-col">
                <span className="text-[16px] font-medium text-slate-900">Alerts</span>
                <span className="text-[13px] text-slate-500">Calculator notifications</span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={notificationsEnabled} 
                onChange={handleToggleNotifications} 
              />
              <div className="w-[48px] h-[26px] bg-[#E5E5EA] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[22px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-slate-200 after:rounded-full after:h-[22px] after:w-[22px] after:transition-all peer-checked:after:border-transparent peer-checked:bg-blue-500 transition-colors"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      <div 
        className={`fixed top-[env(safe-area-inset-top,1rem)] left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-900/95 text-white px-4 py-2.5 rounded-full shadow-lg shadow-black/10 transition-all duration-300 ease-out ${
          showToast ? 'translate-y-4 opacity-100' : '-translate-y-8 opacity-0 pointer-events-none'
        }`}
      >
        <CheckCircle2 size={16} className="text-emerald-400" />
        <span className="text-[14px] font-medium tracking-tight whitespace-nowrap">{toastMessage}</span>
      </div>
    </div>
  );
}
