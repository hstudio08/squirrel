'use client';

import React, { useState, useRef, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, updateProfile, User } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Check, Loader2, Pen, X, Lock, Bell, Zap, UserRound, MessageCircle, ChevronRight, Shield } from 'lucide-react';
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

  const stateRef = useRef({ isEditingPin: false });

  useEffect(() => {
    let backListener: { remove: () => void } | null = null;
    let isActive = true;

    const setupBackButton = async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      
      const { App: CapacitorApp } = await import('@capacitor/app');
      
      if (!isActive) return;

      backListener = await CapacitorApp.addListener('backButton', () => {
        if (stateRef.current.isEditingPin) {
          stateRef.current.isEditingPin = false;
          setIsEditingPin(false);
        } else {
          router.push('/chat');
        }
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
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [statusSaved, setStatusSaved] = useState(false);

  // Friend Name (was partnerNickname)
  const [friendName, setFriendName] = useState(typeof window !== 'undefined' ? localStorage.getItem('squirrel_partnerNickname') || '' : '');
  const [isSavingFriendName, setIsSavingFriendName] = useState(false);
  const [friendNameSaved, setFriendNameSaved] = useState(false);

  // Quick Lock & Notifications
  const [quickLock, setQuickLock] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // App PIN
  const [appPin, setAppPin] = useState('');
  const [isEditingPin, setIsEditingPin] = useState(false);
  const [pinSaved, setPinSaved] = useState(false);

  useEffect(() => {
    stateRef.current.isEditingPin = isEditingPin;
  }, [isEditingPin]);

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
      import('firebase/firestore').then(({ getDoc, doc }) => {
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
      });
    }
  }, [user, loading, router]);

  // Handlers
  const handleSaveStatus = async () => {
    if (!user || status.length > 35) return;
    setIsSavingStatus(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { status });
      localStorage.setItem('squirrel_status', status);
      setStatusSaved(true);
      setTimeout(() => setStatusSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save status", error);
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleSaveFriendName = async () => {
    if (!user || friendName.length > 30) return;
    setIsSavingFriendName(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { partnerNickname: friendName });
      localStorage.setItem('squirrel_partnerNickname', friendName);
      setFriendNameSaved(true);
      setTimeout(() => setFriendNameSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save friend name", error);
    } finally {
      setIsSavingFriendName(false);
    }
  };

  const handleSavePin = () => {
    const finalPin = appPin.replace(/\s/g, '');
    if (finalPin.length === 0) {
      localStorage.removeItem('squirrel_pin');
      setAppPin('');
    } else if (/^\d{4}$/.test(finalPin)) {
      localStorage.setItem('squirrel_pin', finalPin);
      setAppPin(finalPin);
    } else {
      alert('PIN must be exactly 4 digits.');
      return;
    }
    setIsEditingPin(false);
    setPinSaved(true);
    setTimeout(() => setPinSaved(false), 2000);
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
              import('firebase/firestore').then(({ doc, updateDoc }) => {
                updateDoc(doc(db, 'users', user.uid), { notificationsEnabled: true }).catch(() => {});
              });
            }
          } else {
            alert('Notifications permission denied.');
          }
        } else {
          if ('Notification' in window) {
            Notification.requestPermission().then(permission => {
              if (permission === 'granted') {
                setNotificationsEnabled(true);
                localStorage.setItem('squirrel_notifications', 'true');
                if (user) {
                  import('firebase/firestore').then(({ doc, updateDoc }) => {
                    updateDoc(doc(db, 'users', user.uid), { notificationsEnabled: true }).catch(() => {});
                  });
                }
              } else {
                alert('Notifications permission denied.');
              }
            });
          } else {
            alert('Your browser does not support notifications.');
          }
        }
      } catch (e) {
        alert('Error setting up notifications');
      }
    } else {
      setNotificationsEnabled(false);
      localStorage.setItem('squirrel_notifications', 'false');
      if (user) {
        import('firebase/firestore').then(({ doc, updateDoc }) => {
          updateDoc(doc(db, 'users', user.uid), { notificationsEnabled: false }).catch(() => {});
        });
      }
    }
  };

  if (!isMounted || !user) return null;

  return (
    <div className="h-dvh bg-[#F2F2F7] text-black flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center shrink-0 bg-white/80 backdrop-blur-xl border-b border-gray-200/80 z-20 sticky top-0">
        <button
          onClick={() => router.push('/chat')}
          className="relative z-10 w-10 h-10 flex items-center justify-center text-blue-500 hover:bg-gray-100 rounded-full transition-all active:scale-95"
        >
          <ArrowLeft size={22} strokeWidth={2.5} />
        </button>
        <h1 className="flex-1 text-center text-[17px] font-semibold text-black -ml-10 pointer-events-none">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 pt-5 custom-scrollbar">
        <div className="w-full max-w-md mx-auto px-4 flex flex-col gap-7">

          {/* ─── Section 1: Profile ─── */}
          <div>
            <p className="text-[13px] font-medium text-gray-500 uppercase tracking-wide ml-4 mb-2">Profile</p>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 overflow-hidden">

              {/* Friend Name */}
              <div className="p-4">
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                    <UserRound size={16} className="text-white" strokeWidth={2.5} />
                  </div>
                  <span className="text-[15px] font-semibold text-black">Friend Name</span>
                </div>
                <div className="flex items-center bg-gray-50/80 rounded-xl border border-gray-200/80 px-1 py-1 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
                  <input
                    type="text"
                    placeholder="Enter friend's display name..."
                    maxLength={30}
                    value={friendName}
                    onChange={(e) => setFriendName(e.target.value)}
                    className="flex-1 min-w-0 bg-transparent outline-none text-black text-[15px] px-3 py-2 placeholder:text-gray-400"
                  />
                  <button
                    onClick={handleSaveFriendName}
                    disabled={isSavingFriendName || friendName.length > 30}
                    className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200 flex items-center gap-1 shrink-0 ${
                      friendNameSaved 
                        ? 'bg-emerald-500 text-white shadow-sm' 
                        : 'bg-blue-500 text-white active:scale-95 hover:bg-blue-600 shadow-sm'
                    } disabled:opacity-40`}
                  >
                    {isSavingFriendName ? <Loader2 size={14} className="animate-spin" /> : friendNameSaved ? <><Check size={14} /> Saved</> : 'Save'}
                  </button>
                </div>
                <p className="text-gray-400 text-[12px] ml-1 mt-1.5 leading-snug">Overrides their original name on your device.</p>
              </div>

              <div className="h-[0.5px] bg-gray-200/80 ml-16" />

              {/* About */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center shadow-sm">
                      <MessageCircle size={16} className="text-white" strokeWidth={2.5} />
                    </div>
                    <span className="text-[15px] font-semibold text-black">About</span>
                  </div>
                  <span className="text-[11px] text-gray-400 font-medium tabular-nums">{status.length}/35</span>
                </div>
                <div className="flex items-center bg-gray-50/80 rounded-xl border border-gray-200/80 px-1 py-1 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
                  <input
                    type="text"
                    placeholder="What are you doing?"
                    maxLength={35}
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="flex-1 min-w-0 bg-transparent outline-none text-black placeholder:text-gray-400 text-[15px] px-3 py-2"
                  />
                  <button
                    onClick={handleSaveStatus}
                    disabled={isSavingStatus || status.length > 35}
                    className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200 flex items-center gap-1 shrink-0 ${
                      statusSaved 
                        ? 'bg-emerald-500 text-white shadow-sm' 
                        : 'bg-gray-200 text-gray-700 active:scale-95 hover:bg-gray-300'
                    } disabled:opacity-40`}
                  >
                    {isSavingStatus ? <Loader2 size={14} className="animate-spin" /> : statusSaved ? <><Check size={14} /> Saved</> : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Section 2: Security ─── */}
          <div>
            <p className="text-[13px] font-medium text-gray-500 uppercase tracking-wide ml-4 mb-2">Security</p>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 overflow-hidden">

              {/* App Unlock PIN */}
              {isEditingPin ? (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                        <Lock size={16} className="text-white" strokeWidth={2.5} />
                      </div>
                      <div>
                        <span className="text-[15px] font-semibold text-black block">Set Unlock PIN</span>
                        <span className="text-[12px] text-gray-400 leading-snug">4-digit PIN for the calculator.</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setAppPin(localStorage.getItem('squirrel_pin') || '');
                        setIsEditingPin(false);
                      }} 
                      className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-gray-400 transition-colors active:scale-95"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2.5 mt-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="\d*"
                      maxLength={4}
                      placeholder="• • • •"
                      value={appPin.replace(/\s/g, '')}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setAppPin(val);
                      }}
                      autoFocus
                      className="flex-1 min-w-0 h-12 px-4 bg-gray-50/80 border border-gray-200/80 rounded-xl text-black font-semibold text-lg tracking-[0.4em] text-center outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:tracking-[0.3em] placeholder:text-gray-300"
                    />
                    <button
                      onClick={handleSavePin}
                      disabled={appPin.replace(/\s/g, '').length !== 4 && appPin.replace(/\s/g, '').length !== 0}
                      className="shrink-0 h-12 px-5 rounded-xl bg-blue-500 text-white font-semibold text-[14px] hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed active:scale-95 transition-all shadow-sm"
                    >
                      Save
                    </button>
                  </div>
                  {pinSaved && (
                    <span className="text-emerald-600 text-[13px] flex items-center gap-1 font-medium mt-2.5">
                      <Check size={14} /> PIN Saved Successfully
                    </span>
                  )}
                </div>
              ) : (
                <button 
                  onClick={() => setIsEditingPin(true)}
                  className="p-4 w-full flex items-center justify-between hover:bg-gray-50/80 active:bg-gray-100 transition-colors text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                      <Lock size={16} className="text-white" strokeWidth={2.5} />
                    </div>
                    <div>
                      <h4 className="text-[15px] font-semibold text-black">App Unlock PIN</h4>
                      <p className="text-gray-400 text-[12px] mt-0.5">4-digit PIN for the calculator.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {appPin && <span className="text-gray-400 font-medium text-[14px] tracking-wider">••••</span>}
                    <ChevronRight size={18} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
                  </div>
                </button>
              )}

              <div className="h-[0.5px] bg-gray-200/80 ml-16" />

              {/* Quick Lock */}
              <div className="p-4 w-full flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-sm">
                    <Zap size={16} className="text-white" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="text-[15px] font-semibold text-black">Quick Lock</h4>
                    <p className="text-gray-400 text-[12px] mt-0.5">Instantly lock when minimized</p>
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
                  <div className="w-[51px] h-[31px] bg-gray-200 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-[27px] after:w-[27px] after:shadow-sm after:transition-all after:duration-200 peer-checked:after:translate-x-[20px] transition-colors duration-200" />
                </label>
              </div>
            </div>
          </div>

          {/* ─── Section 3: Preferences ─── */}
          <div>
            <p className="text-[13px] font-medium text-gray-500 uppercase tracking-wide ml-4 mb-2">Preferences</p>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 overflow-hidden">

              {/* App Notifications */}
              <button
                onClick={handleToggleNotifications}
                className="p-4 w-full flex items-center justify-between hover:bg-gray-50/80 active:bg-gray-100 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-sm">
                    <Bell size={16} className="text-white" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="text-[15px] font-semibold text-black">App Notifications</h4>
                    <p className="text-gray-400 text-[12px] mt-0.5">Calculator alerts for messages</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer pointer-events-none">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={notificationsEnabled}
                    readOnly
                  />
                  <div className="w-[51px] h-[31px] bg-gray-200 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-[27px] after:w-[27px] after:shadow-sm after:transition-all after:duration-200 peer-checked:after:translate-x-[20px] transition-colors duration-200" />
                </label>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
