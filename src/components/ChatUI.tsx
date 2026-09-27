'use client';
import { getToken } from 'firebase/messaging';
import { getFirebaseMessaging } from '@/lib/firebase';
import imageCompression from 'browser-image-compression';

import React, { useState, useEffect, useRef, useLayoutEffect, FormEvent, useMemo } from 'react';
import { User } from 'firebase/auth';
import { db, rtdb } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
  addDoc,
  serverTimestamp,
  writeBatch,
  doc,
  updateDoc,
  arrayUnion,
  getCountFromServer,
  deleteField,
  setDoc,
  startAfter,
  getDoc
} from 'firebase/firestore';
import { ref, onValue, set, onDisconnect, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
import { Message } from '@/types/chat';
import MessageItem from './MessageItem';
import { useAuth } from '@/hooks/useAuth';
import { Smile, Send, Info, X, Image as ImageIcon, Loader2, Ghost, ArrowLeft, Copy, Trash2, ChevronDown, ChevronUp, Search, Pin, Camera, MoreVertical, RotateCcw, Clock, CheckSquare, Lock, Plus, Settings } from 'lucide-react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import ImageEditor from './ImageEditor';
import MultiImagePreviewModal from './MultiImagePreviewModal';
import CameraCapture from './CameraCapture';
import { ChatInputForm } from './ChatInputForm';
import OnboardingTour from './OnboardingTour';

interface ChatUIProps {
  user: User;
}

const StatusIndicator = ({ state, timestamp, isTyping }: { state: string | undefined, timestamp: number | null, isTyping: boolean }) => {
  const [toggle, setToggle] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setToggle(prev => !prev);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (state === 'online') {
    if (isTyping) {
      return (
        <div className="grid h-[14px] place-items-end">
          <div className={`col-start-1 row-start-1 flex items-center space-x-1.5 transition-opacity duration-500 ease-in-out ${toggle ? 'opacity-100' : 'opacity-0'}`}>
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_6px_rgba(59,130,246,0.8)]"></div>
            <span className="text-[11px] font-bold text-blue-500">Online</span>
          </div>
          <div className={`col-start-1 row-start-1 flex items-center transition-opacity duration-500 ease-in-out ${!toggle ? 'opacity-100' : 'opacity-0'}`}>
            <span className="text-[11px] font-bold text-blue-500 italic">Typing...</span>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-end h-[14px] space-x-1.5">
        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_6px_rgba(59,130,246,0.8)]"></div>
        <span className="text-[11px] font-bold text-blue-500">Online</span>
      </div>
    );
  }

  if (!timestamp) {
    return (
      <div className="flex items-center justify-end h-[14px]">
        <span className="text-[11px] font-semibold text-slate-500 truncate text-right">Offline</span>
      </div>
    );
  }

  const date = new Date(timestamp);
  const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)} | ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

  return (
    <div className="flex items-center justify-end h-[14px] animate-fade-in">
      <span className="text-[11px] font-semibold text-slate-500 text-right whitespace-nowrap">{formattedDate}</span>
    </div>
  );
};

// Secure LocalStorage Cache
const secureCache = {
  set: (key: string, data: any, secret: string) => {
    try {
      const text = JSON.stringify(data);
      const encoded = encodeURIComponent(text);
      let xored = '';
      for (let i = 0; i < encoded.length; i++) {
        xored += String.fromCharCode(encoded.charCodeAt(i) ^ secret.charCodeAt(i % secret.length));
      }
      localStorage.setItem(key, btoa(xored));
    } catch (e) { console.error('Cache set error'); }
  },
  get: (key: string, secret: string) => {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      const xored = atob(cached);
      let decoded = '';
      for (let i = 0; i < xored.length; i++) {
        decoded += String.fromCharCode(xored.charCodeAt(i) ^ secret.charCodeAt(i % secret.length));
      }
      return JSON.parse(decodeURIComponent(decoded));
    } catch (e) {
      return null;
    }
  }
};

const PurePrivacyCurtain = ({ onClose }: { onClose: () => void }) => {
  const [curHeight, setCurHeight] = useState<number | null>(null);
  const [swipeX, setSwipeX] = useState(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = curHeight || (window.innerHeight - 150);

    const onMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.min(window.innerHeight, Math.max(100, startHeight + deltaY));
      setCurHeight(newHeight);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleTextPointerDown = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    const startX = e.clientX;

    const onMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      if (deltaX > 0) {
        setSwipeX(deltaX);
      }
    };

    const onUp = (upEvent: PointerEvent) => {
      const finalDeltaX = upEvent.clientX - startX;
      if (finalDeltaX > 100) {
        onClose();
      }
      setSwipeX(0);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 bg-black z-[100] flex flex-col shadow-2xl transition-none"
      style={{ height: curHeight !== null ? `${curHeight}px` : 'calc(100vh - 150px)', touchAction: 'none' }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none overflow-hidden pb-12">
        <div
          className="flex flex-col items-center cursor-grab active:cursor-grabbing pointer-events-auto transition-transform"
          onPointerDown={handleTextPointerDown}
          style={{ transform: `translateX(${swipeX}px)`, opacity: Math.max(0, 1 - swipeX / 150) }}
        >
          <h2 className="text-white font-black text-5xl sm:text-6xl uppercase tracking-[0.2em] whitespace-nowrap drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] bg-white/10 backdrop-blur-md px-10 py-5 border-y-4 border-white/20 select-none">
            PERSONAL
          </h2>
          <span className="text-white/80 text-sm mt-4 tracking-widest font-medium select-none uppercase">
            Nothing to see here
          </span>
        </div>
      </div>
      <div className="flex-1 pointer-events-none" />
      <div
        className="w-full h-24 cursor-ns-resize flex items-center justify-center bg-zinc-900 border-t border-zinc-700 relative z-10 hover:bg-zinc-800 transition-colors shadow-[0_-4px_10px_rgba(0,0,0,0.5)] shrink-0"
        onPointerDown={handlePointerDown}
      >
        <div className="flex gap-2 items-center justify-center pointer-events-none">
          <div className="w-2 h-2 rounded-full bg-zinc-500" />
          <div className="w-12 h-2 rounded-full bg-zinc-500" />
          <div className="w-2 h-2 rounded-full bg-zinc-500" />
        </div>
      </div>
    </div>
  );
};

export default function ChatUI({ user }: ChatUIProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [isOtherRecording, setIsOtherRecording] = useState(false);
  const [loadedCount, setLoadedCount] = useState(10);
  const [sessionId, setSessionId] = useState('');
  const [pinUnlockedThisSession, setPinUnlockedThisSession] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [pastedImages, setPastedImages] = useState<File[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [pinnedMessage, setPinnedMessage] = useState<{ id: string; text: string; senderId: string } | null>(null);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [showUnpinConfirm, setShowUnpinConfirm] = useState(false);
  const [showPinError, setShowPinError] = useState(false);
  const [uploadingImages, setUploadingImages] = useState<{urls: string[], text: string} | null>(null);

  const chatId = 'private-chat';
  const otherEmail = user.email === 'sadiyaayoub22019@gmail.com' ? 'officialhaadi81@gmail.com' : 'sadiyaayoub22019@gmail.com';

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<any>(null);

  const initialLoadDone = useRef(false);
  const newestMsgTimeRef = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const pinSwipeStartRef = useRef<number | null>(null);
  const pinSwipeDraggingRef = useRef<boolean>(false);
  const pinBannerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [bottomReadMessageId, setBottomReadMessageId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const lastTapRef = useRef<number>(0);
  const privacyTapTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ title: string; description: string; confirmText?: string; onConfirm: () => void; isDestructive?: boolean } | null>(null);
  const [otherUserAbout, setOtherUserAbout] = useState<string>('');


  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 2500);
  };

  const shouldScrollToTopAfterLoad = useRef(false);

  useLayoutEffect(() => {
    if (shouldScrollToTopAfterLoad.current && scrollContainerRef.current) {
      const diff = scrollContainerRef.current.scrollHeight - prevScrollHeightRef.current;
      if (diff > 0) {
        // The DOM has grown with the new older messages.
        // The user wants to "remain at the top of the loaded chats", meaning they 
        // want to see the oldest message in the newly loaded batch.
        // We can just scroll to the very top (or near top so they don't immediately hit the button).
        scrollContainerRef.current.scrollTop = 10;

        prevScrollHeightRef.current = 0;
        shouldScrollToTopAfterLoad.current = false;
      }
    }
  }, [messages]);

  const [otherUserName, setOtherUserName] = useState<string>('');
  const [otherUserStatus, setOtherUserStatus] = useState<{ state: string, last_changed: number } | null>(null);
  const [otherUid, setOtherUid] = useState<string | null>(null);
  const [partnerData, setPartnerData] = useState<any>(null);
  const [myDoc, setMyDoc] = useState<any>(null);
  const [showPartnerModal, setShowPartnerModal] = useState(false);

  useEffect(() => {
    const unsubMe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setMyDoc(docSnap.data());
      }
    });

    if (otherUid) {
      const unsubPartner = onSnapshot(doc(db, 'users', otherUid), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPartnerData(data);
          if (data.status !== undefined) {
            setOtherUserAbout(data.status);
          }
        }
      });
      return () => {
        unsubMe();
        unsubPartner();
      };
    }
    return () => unsubMe();
  }, [otherUid, user.uid]);
  const [privacyMode, setPrivacyMode] = useState<'none' | 'blur' | 'pure'>('none');
  const [revealedMessages, setRevealedMessages] = useState<string[]>([]);
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [enterToSend, setEnterToSend] = useState(true);
  const [clearedAt, setClearedAt] = useState<number>(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [isClientOffline, setIsClientOffline] = useState(false);
  const [hideOfflineBanner, setHideOfflineBanner] = useState(false);



  useEffect(() => {
    const handleOffline = () => {
      setIsClientOffline(true);
      setHideOfflineBanner(false);
    };
    const handleOnline = () => setIsClientOffline(false);

    setIsClientOffline(typeof navigator !== 'undefined' && !navigator.onLine);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    let sid = sessionStorage.getItem('pin_session_id');
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem('pin_session_id', sid);
    }
    setSessionId(sid);

    if (sessionStorage.getItem('pin_unlocked') === 'true') {
      setPinUnlockedThisSession(true);
    }

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Handle mobile keyboard appearing/disappearing
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const handleViewportResize = () => {
      setIsKeyboardOpen(window.visualViewport!.height < window.innerHeight - 100);
      if (scrollContainerRef.current) {
        const target = scrollContainerRef.current;
        const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;

        // If user hasn't scrolled up more than roughly a page, keep them at the bottom
        // when the keyboard resizes the viewport
        if (scrollBottom <= target.clientHeight + 150) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }
      }
    };

    window.visualViewport.addEventListener('resize', handleViewportResize);
    return () => window.visualViewport?.removeEventListener('resize', handleViewportResize);
  }, []);

  const isTypingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingWriteRef = useRef<number>(0); // throttle RTDB writes


  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      return;
    }
    const query = searchQuery.toLowerCase();
    const results = messages
      .filter(msg => msg.text?.toLowerCase().includes(query))
      .map(msg => msg.id);

    setSearchResults(results);
    if (results.length > 0) {
      setCurrentSearchIndex(results.length - 1);
    } else {
      setCurrentSearchIndex(-1);
    }
  }, [searchQuery, messages]);

  useEffect(() => {
    if (currentSearchIndex >= 0 && searchResults.length > 0) {
      const msgId = searchResults[currentSearchIndex];
      if (msgId) {
        // use msg- prefix as expected by the JSX
        const el = document.getElementById(`msg-${msgId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [currentSearchIndex, searchResults]);

  const handlePrevSearch = () => {
    if (searchResults.length === 0) return;
    setCurrentSearchIndex(prev => (prev > 0 ? prev - 1 : searchResults.length - 1));
  };

  const handleNextSearch = () => {
    if (searchResults.length === 0) return;
    setCurrentSearchIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : 0));
  };

  const { signOut } = useAuth();


  const playNotificationSound = () => {
    try {
      if (document.visibilityState === 'visible') {
        const audio = new Audio('/notification.mp3');
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            // Silently catch NotAllowedError (user didn't interact yet)
            console.warn("Audio auto-play prevented. User needs to interact first.");
          });
        }
      }
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  };


  // Bulletproof fallback for otherUid from messages
  useEffect(() => {
    if (!otherUid && messages.length > 0) {
      const otherMsg = messages.find(m => m.senderId !== user?.uid);
      if (otherMsg) {
        setOtherUid(otherMsg.senderId);
      }
    }
  }, [messages, otherUid, user?.uid]);

  // Fetch other user profile and listen to their presence
  useEffect(() => {
    if (user?.uid && chatId) {
      const stored = localStorage.getItem(`clearedAt_${user.uid}_${chatId}`);
      if (stored) {
        setClearedAt(parseInt(stored, 10));
      }
    }
  }, [user?.uid, chatId]);

  useEffect(() => {
    if (!user) return;
    const fetchOtherUser = async () => {
      try {
        const q = query(collection(db, 'users'), where('email', '==', otherEmail));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const data = snapshot.docs[0].data();
          setOtherUserName(data.displayName || otherEmail.split('@')[0]);
          setOtherUid(data.uid);
        } else {
          setOtherUserName(otherEmail.split('@')[0]);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchOtherUser();
  }, [user, otherEmail]);

  // Manage My Presence
  useEffect(() => {
    if (!user) return;
    const myStatusRef = ref(rtdb, `/status/${user.uid}`);
    const connectedRef = ref(rtdb, '.info/connected');

    const unsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        onDisconnect(myStatusRef).set({ state: 'offline', last_changed: rtdbServerTimestamp() }).then(() => {
          if (document.visibilityState !== 'hidden') {
            set(myStatusRef, { state: 'online', last_changed: rtdbServerTimestamp() });
          } else {
            set(myStatusRef, { state: 'offline', last_changed: rtdbServerTimestamp() });
          }
        });
      }
    });

    const handleVis = () => {
      if (document.visibilityState === 'hidden') {
        set(myStatusRef, { state: 'offline', last_changed: rtdbServerTimestamp() });
      } else {
        set(myStatusRef, { state: 'online', last_changed: rtdbServerTimestamp() });
      }
    };
    document.addEventListener("visibilitychange", handleVis);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVis);
      set(myStatusRef, { state: 'offline', last_changed: rtdbServerTimestamp() });
    };
  }, [user]);

  // Listen to Other User Presence
  useEffect(() => {
    if (!otherUid) return;
    const otherStatusRef = ref(rtdb, `/status/${otherUid}`);
    const unsubscribe = onValue(otherStatusRef, (snap) => {
      setOtherUserStatus(snap.val());
    });
    return () => unsubscribe();
  }, [otherUid]);



  useEffect(() => {
    const setupNotifications = async () => {
      try {
        // Ensure user record exists with email for querying
        if (user.email) {
          await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            uid: user.uid
          }, { merge: true });
        }

        const permission = 'Notification' in window ? Notification.permission : 'denied';
        if (permission === 'granted') {
          const messaging = await getFirebaseMessaging();
          if (messaging) {

            const registration = await navigator.serviceWorker.register('/sw.js');
            const token = await getToken(messaging, {
              vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
              serviceWorkerRegistration: registration
            });
            if (token) {
              await setDoc(doc(db, "users", user.uid, "private", "tokens"), {
                fcmTokens: arrayUnion(token)
              }, { merge: true });
            }
          }
        }
      } catch (err) {
        // Silently ignore push setup permission errors to prevent console spam
      }
    };
    setupNotifications();
  }, [user.uid]);

  const getMaskedEmail = (email: string) => {
    if (!email) return '';
    const prefix = email.split('@')[0];
    if (prefix.length <= 4) return email;
    return prefix.substring(0, 2) + '*****' + prefix.substring(prefix.length - 2);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Element;

      if (menuRef.current && !menuRef.current.contains(target as Node)) {
        if (!target.closest('#menu-toggle-btn')) {
          setShowMenu(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const myTypingRef = ref(rtdb, `typingStatus/${chatId}/${user.uid}`);
    onDisconnect(myTypingRef).set(false).catch(() => { });

    const myRecordingRef = ref(rtdb, `recordingStatus/${chatId}/${user.uid}`);
    onDisconnect(myRecordingRef).set(false).catch(() => { });

    const chatTypingRef = ref(rtdb, `typingStatus/${chatId}`);
    const unsubscribeTyping = onValue(chatTypingRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        let someoneElseIsTyping = false;
        for (const [uid, isTyping] of Object.entries(data)) {
          if (uid !== user.uid && isTyping === true) {
            someoneElseIsTyping = true;
            break;
          }
        }
        setIsOtherTyping(someoneElseIsTyping);
      } else {
        setIsOtherTyping(false);
      }
    });

    const chatRecordingRef = ref(rtdb, `recordingStatus/${chatId}`);
    const unsubscribeRecording = onValue(chatRecordingRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        let someoneElseIsRecording = false;
        for (const [uid, isRecording] of Object.entries(data)) {
          if (uid !== user.uid && isRecording === true) {
            someoneElseIsRecording = true;
            break;
          }
        }
        setIsOtherRecording(someoneElseIsRecording);
      } else {
        setIsOtherRecording(false);
      }
    });

    return () => {
      set(myTypingRef, false).catch(() => { });
      set(myRecordingRef, false).catch(() => { });
      unsubscribeTyping();
      unsubscribeRecording();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [user.uid, chatId]);

  const updateTypingStatus = (typing: boolean) => {
    if (isTypingRef.current === typing) return; // no change, skip

    const now = Date.now();
    if (typing) {
      // Throttle: only write "typing=true" to RTDB at most once per 400ms
      if (now - lastTypingWriteRef.current < 400) return;
      lastTypingWriteRef.current = now;
    }

    isTypingRef.current = typing;
    const myTypingRef = ref(rtdb, `typingStatus/${chatId}/${user.uid}`);
    set(myTypingRef, typing).catch(err => console.error("Typing status error", err));
  };

  const updateRecordingStatus = (recording: boolean) => {
    if (isRecordingRef.current === recording) return;

    isRecordingRef.current = recording;
    const myRecordingRef = ref(rtdb, `recordingStatus/${chatId}/${user.uid}`);
    set(myRecordingRef, recording).catch(err => console.error("Recording status error", err));
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updateTypingStatus(false);
        updateRecordingStatus(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!user?.uid) return;

    const convUnsub = onSnapshot(doc(db, 'conversations', chatId), (docSnap) => {
      if (docSnap.exists()) {
        setPinnedMessage(docSnap.data().pinnedMessage || null);
      }
    });

    const cacheKey = `sq_c_${chatId}_${user.uid}`;

    // ΓöÇΓöÇ STEP 1: Paint cached messages INSTANTLY (zero Firestore reads) ΓöÇΓöÇ
    if (!initialLoadDone.current) {
      const cached = secureCache.get(cacheKey, user.uid);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setMessages(cached);
        setLoadedCount(Math.max(10, cached.length));
        setIsLoadingMessages(false);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
      }
    }

    // ΓöÇΓöÇ STEP 2: Live Firestore subscription (only last 10 messages) ΓöÇΓöÇ
    const q = query(
      collection(db, `conversations/${chatId}/messages`),
      orderBy('createdAt', 'desc'),
      firestoreLimit(10)
    );

    let isFirstSnapshot = true;

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages: Message[] = [];
      const batch = writeBatch(db);
      let hasUnseen = false;

      // Process sound/scroll for truly new incoming messages
      if (initialLoadDone.current && !isFirstSnapshot) {
        let shouldScroll = false;
        let isNearBottom = true;
        if (scrollContainerRef.current) {
          const { scrollHeight, scrollTop, clientHeight } = scrollContainerRef.current;
          isNearBottom = scrollHeight - scrollTop - clientHeight < 250;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const newMsg = change.doc.data();
            let msgTime = 0;
            if (newMsg.createdAt) {
              if (newMsg.createdAt.toMillis) msgTime = newMsg.createdAt.toMillis();
              else if (newMsg.createdAt.seconds) msgTime = newMsg.createdAt.seconds * 1000;
              else if (typeof newMsg.createdAt === 'number') msgTime = newMsg.createdAt;
            }
            if (msgTime > newestMsgTimeRef.current) {
              if (newMsg.senderId === user.uid || isNearBottom) shouldScroll = true;
              if (newMsg.senderId !== user.uid) {
                let isTrulyNew = false;
                if (!newMsg.createdAt) {
                  isTrulyNew = true;
                } else {
                  const msgDate = newMsg.createdAt.toDate ? newMsg.createdAt.toDate() : new Date(typeof newMsg.createdAt === 'number' ? newMsg.createdAt : newMsg.createdAt.seconds * 1000);
                  if (Date.now() - msgDate.getTime() < 10000) isTrulyNew = true;
                }
                if (isTrulyNew) playNotificationSound();
              }
            }
          }
        });

        if (shouldScroll) {
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
      }

      // Build live message list
      snapshot.forEach((msgDoc) => {
        const data = msgDoc.data();
        fetchedMessages.push({ id: msgDoc.id, ...data } as Message);

        let time = 0;
        if (data.createdAt) {
          if (data.createdAt.toMillis) time = data.createdAt.toMillis();
          else if (data.createdAt.seconds) time = data.createdAt.seconds * 1000;
          else if (typeof data.createdAt === 'number') time = data.createdAt;
        }
        if (time > newestMsgTimeRef.current) newestMsgTimeRef.current = time;

        if (data.senderId !== user.uid && !data.seen && document.visibilityState === 'visible') {
          batch.update(doc(db, 'conversations', chatId, 'messages', msgDoc.id), { seen: true, seenAt: serverTimestamp() });
          hasUnseen = true;
        }
      });

      if (hasUnseen) batch.commit().catch(e => console.error('Failed to mark seen', e));

      const liveMessages = fetchedMessages.reverse();

      // ΓöÇΓöÇ STEP 3: Merge live data with cached older messages ΓöÇΓöÇ
      setMessages(prev => {
        const mergedMap = new Map<string, Message>();
        // Put cached older messages in first
        prev.forEach(m => mergedMap.set(m.id, m));
        // Overwrite/add live messages (handles edits, deletes, reactions)
        liveMessages.forEach(m => mergedMap.set(m.id, m));

        const merged = Array.from(mergedMap.values()).sort((a, b) => {
          const tA = (a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : (typeof a.createdAt === 'number' ? a.createdAt : 0);
          const tB = (b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : (typeof b.createdAt === 'number' ? b.createdAt : 0);
          return tA - tB;
        });

        // ΓöÇΓöÇ STEP 4: Persist merged list to cache (serialise Timestamps ΓåÆ ms) ΓöÇΓöÇ
        setTimeout(() => {
          try {
            const toCache = merged.map(m => ({
              ...m,
              createdAt: (m.createdAt as any)?.seconds ? (m.createdAt as any).seconds * 1000 : m.createdAt,
              editedAt: (m.editedAt as any)?.seconds ? (m.editedAt as any).seconds * 1000 : m.editedAt,
              seenAt: (m.seenAt as any)?.seconds ? (m.seenAt as any).seconds * 1000 : m.seenAt,
            }));
            secureCache.set(cacheKey, toCache, user.uid);
          } catch (_) { }
        }, 0);

        return merged;
      });

      setIsLoadingMessages(false);

      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 100);
      }

      isFirstSnapshot = false;
    }, (error) => {
      console.error("Error fetching messages:", error);
    });

    return () => {
      unsubscribe();
      convUnsub();
    };
  }, [chatId, user?.uid]);

  const handleToggleSelect = (id: string) => {
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      if (newSet.size === 0) setSelectionMode(false);
      else setSelectionMode(true);
      return newSet;
    });
  };

  const handleClearHistory = () => {
    const now = Date.now();
    setClearedAt(now);
    localStorage.setItem(`clearedAt_${user.uid}_${chatId}`, now.toString());
    setShowClearConfirm(false);
  };

  const handleCopySelected = () => {
    const texts = messages.filter(m => selectedMessages.has(m.id)).map(m => m.text).join('\n\n');
    navigator.clipboard.writeText(texts);
    setSelectionMode(false);
    setSelectedMessages(new Set());
  };

  const handleDeleteSelected = () => {
    setShowBulkDeleteModal(true);
  };

  const confirmBulkDelete = async (forEveryone: boolean) => {
    try {
      await Promise.all(
        Array.from(selectedMessages).map(id => {
          const docRef = doc(db, `conversations/${chatId}/messages`, id);
          if (forEveryone) {
            return updateDoc(docRef, {
              isDeletedForEveryone: true,
              editedAt: rtdbServerTimestamp()
            });
          } else {
            return updateDoc(docRef, { deletedFor: arrayUnion(user.uid) });
          }
        })
      );
    } catch (e) {
      console.error(e);
    }
    setSelectionMode(false);
    setSelectedMessages(new Set());
    setShowBulkDeleteModal(false);
  };

  const handleClearChat = async () => {
    try {
      const batch = writeBatch(db);
      visibleMessages.forEach(msg => {
        batch.update(doc(db, `conversations/${chatId}/messages`, msg.id), {
          deletedFor: arrayUnion(user.uid)
        });
      });
      await batch.commit();
      setShowMenu(false);
    } catch (err) {
      console.error('Failed to clear chat', err);
    }
  };


  const loadMore = async (overridePin = false) => {
    if (loadedCount >= 100 && !pinUnlockedThisSession && !overridePin) {
      setShowPinModal(true);
      return;
    }
    if (isFetchingMore || messages.length === 0) return;

    setIsFetchingMore(true);
    try {
      if (scrollContainerRef.current) {
        prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
        shouldScrollToTopAfterLoad.current = true;
      }

      const oldestMsg = messages[0];
      const oldestDocSnap = await getDoc(doc(db, `conversations/${chatId}/messages`, oldestMsg.id));

      const q = query(
        collection(db, `conversations/${chatId}/messages`),
        orderBy('createdAt', 'desc'),
        startAfter(oldestDocSnap),
        firestoreLimit(10)
      );

      const snapshot = await getDocs(q);
      const fetched: Message[] = [];
      snapshot.forEach(docSnap => {
        fetched.push({ id: docSnap.id, ...docSnap.data() } as Message);
      });

      if (fetched.length > 0) {
        const newOlder = fetched.reverse();
        setMessages(prev => {
          const mergedMap = new Map<string, Message>();
          newOlder.forEach(m => mergedMap.set(m.id, m));
          prev.forEach(m => mergedMap.set(m.id, m));
          const merged = Array.from(mergedMap.values());

          setTimeout(() => {
            try {
              const toCache = merged.map(m => ({
                ...m,
                createdAt: (m.createdAt as any)?.seconds ? (m.createdAt as any).seconds * 1000 : m.createdAt,
                editedAt: (m.editedAt as any)?.seconds ? (m.editedAt as any).seconds * 1000 : m.editedAt,
                seenAt: (m.seenAt as any)?.seconds ? (m.seenAt as any).seconds * 1000 : m.seenAt,
              }));
              secureCache.set(`sq_c_${chatId}_${user.uid}`, toCache, user.uid);
            } catch (_) { }
          }, 0);

          return merged;
        });
        setLoadedCount(prev => prev + fetched.length);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingMore(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPastedImages(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendEditedImage = async (file: File, caption: string = "") => {
    setSelectedImageFile(null);
    setIsUploadingImage(true);
    try {
      let compressedFile = file;
      try {
        const fileToCompress = (!file.type || !file.type.startsWith('image/'))
          ? new File([file], file.name || 'image.jpeg', { type: file.type || 'image/jpeg' })
          : file;
        const options = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1080,
          useWebWorker: true,
          initialQuality: 0.7
        };
        compressedFile = await imageCompression(fileToCompress, options);
      } catch (e) {
        console.warn('Compression failed, using original file', e);
        compressedFile = file;
      }

      const idToken = await user.getIdToken();
      const sigRes = await fetch('/api/upload-signature', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ upload_preset: 'Squirrel' })
      });
      if (!sigRes.ok) throw new Error('Failed to get upload signature');
      const { timestamp, signature } = await sigRes.json();

      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('api_key', process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || '');
      formData.append('timestamp', timestamp.toString());
      formData.append('upload_preset', 'Squirrel');
      formData.append('signature', signature);

      const res = await fetch(`https://api.cloudinary.com/v1_1/wusvh42x/image/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (data.secure_url) {
        const newMessageData: any = {
          senderId: user.uid,
          text: caption || '',
          imageUrl: data.secure_url,
          createdAt: serverTimestamp(),
          seen: false
        };

        if (replyingTo) {
          newMessageData.replyToId = replyingTo.id;
          newMessageData.replyToText = replyingTo.text || 'Photo';
          newMessageData.replyToSenderId = replyingTo.senderId;
        }

        await addDoc(collection(db, `conversations/${chatId}/messages`), newMessageData);

        // Trigger notification to the other user
        try {
          const idToken = await user.getIdToken();
          fetch('/api/notify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ receiverUid: otherUid })
          });
        } catch (e) {
          console.error('Failed to trigger notification', e);
        }
        setReplyingTo(null);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (err) {
      console.error('Image upload failed', err);
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isSameDay = (d1: any, d2: any) => {
    if (!d1 || !d2) return false;
    const date1 = d1.toDate ? d1.toDate() : new Date(typeof d1 === 'number' ? d1 : d1.seconds ? d1.seconds * 1000 : d1);
    const date2 = d2.toDate ? d2.toDate() : new Date(typeof d2 === 'number' ? d2 : d2.seconds ? d2.seconds * 1000 : d2);
    return date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate();
  };

  const formatDateSeparator = (d: any) => {
    if (!d) return '';
    const date = d.toDate ? d.toDate() : new Date(d);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (isSameDay(date, today)) return 'TODAY';
    if (isSameDay(date, yesterday)) return 'YESTERDAY';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  };

  const handlePinToggle = async (msg: Message) => {
    try {
      if (pinnedMessage?.id === msg.id) {
        // Show confirm unpin dialog
        setShowUnpinConfirm(true);
      } else {
        if (pinnedMessage) {
          // Can't pin two messages
          setShowPinError(true);
          setTimeout(() => setShowPinError(false), 3000);
          return;
        }
        // Pin
        await setDoc(doc(db, 'conversations', chatId), {
          pinnedMessage: { id: msg.id, text: msg.text, senderId: msg.senderId }
        }, { merge: true });
      }
    } catch (error) {
      console.error('Failed to toggle pin', error);
      alert('Failed to pin: ' + (error instanceof Error ? error.message : 'Missing permissions. Did you deploy firestore.rules?'));
    }
  };

  const confirmUnpin = async () => {
    try {
      await updateDoc(doc(db, 'conversations', chatId), {
        pinnedMessage: deleteField()
      });
      setShowUnpinConfirm(false);
    } catch (error) {
      console.error('Failed to unpin', error);
      alert('Failed to unpin: ' + (error instanceof Error ? error.message : 'Missing permissions. Did you deploy firestore.rules?'));
      setShowUnpinConfirm(false);
    }
  };

  const handlePinTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    pinSwipeStartRef.current = clientX;
    pinSwipeDraggingRef.current = false;
    if (pinBannerRef.current) {
      pinBannerRef.current.style.transition = 'none';
    }
  };

  const handlePinTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (pinSwipeStartRef.current === null || !pinBannerRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const diff = clientX - pinSwipeStartRef.current;

    if (Math.abs(diff) > 10) {
      pinSwipeDraggingRef.current = true;
    }

    // Allow sliding only left (diff < 0)
    if (diff < 0) {
      // Add a slight resistance curve
      const offset = diff > -150 ? diff : -150 - Math.sqrt(Math.abs(diff + 150)) * 2;
      pinBannerRef.current.style.transform = `translateX(${offset}px)`;
      pinBannerRef.current.style.opacity = Math.max(0.3, 1 - Math.abs(offset) / 200).toString();
    }
  };

  const handlePinTouchEnd = () => {
    if (pinSwipeStartRef.current === null || !pinBannerRef.current) return;

    const transform = pinBannerRef.current.style.transform;
    const match = transform.match(/translateX\(([-\d.]+)px\)/);
    const offset = match ? parseFloat(match[1]) : 0;

    pinBannerRef.current.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.25s ease';

    if (offset < -75) {
      pinBannerRef.current.style.transform = `translateX(-120%)`;
      pinBannerRef.current.style.opacity = '0';
      setTimeout(() => setShowUnpinConfirm(true), 150);
      setTimeout(() => {
        if (pinBannerRef.current) {
          pinBannerRef.current.style.transform = 'translateX(0)';
          pinBannerRef.current.style.opacity = '1';
        }
      }, 500);
    } else {
      pinBannerRef.current.style.transform = 'translateX(0)';
      pinBannerRef.current.style.opacity = '1';
    }

    pinSwipeStartRef.current = null;
    setTimeout(() => { pinSwipeDraggingRef.current = false; }, 50);
  };

  const handleRevealMessage = (msgId: string) => {
    setRevealedMessages(prev => {
      if (prev.includes(msgId)) {
        return prev.filter(id => id !== msgId);
      }
      const newRevealed = [...prev, msgId];
      if (newRevealed.length > 2) newRevealed.shift();
      return newRevealed;
    });
  };

  const handleSendAudio = async (file: File) => {
    if (isSending) return;
    setIsSending(true);
    try {
      const idToken = await user.getIdToken();
      const audioCount = messages.filter(m => m.senderId === user.uid && m.audioUrl).length + 1;
      const senderName = user.email ? user.email.split('@')[0] : 'user';
      const publicId = `${senderName}_${audioCount.toString().padStart(2, '0')}`;

      const sigRes = await fetch('/api/upload-signature', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ folder: 'squirrel/voice_notes', public_id: publicId })
      });
      if (!sigRes.ok) throw new Error('Failed to get upload signature');
      const { timestamp, signature, folder, public_id: resolvedPublicId } = await sigRes.json();

      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || '');
      formData.append('timestamp', timestamp.toString());
      formData.append('signature', signature);
      formData.append('folder', folder);
      formData.append('public_id', resolvedPublicId);
      formData.append('resource_type', 'video');

      const res = await fetch(`https://api.cloudinary.com/v1_1/wusvh42x/video/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (data.secure_url) {
        const newMessageData: any = {
          senderId: user.uid,
          audioUrl: data.secure_url,
          createdAt: serverTimestamp(),
          seen: false,
          isDeletedForEveryone: false,
          isEdited: false
        };

        if (replyingTo) {
          newMessageData.replyToId = replyingTo.id;
          newMessageData.replyToText = replyingTo.text || 'Voice Note';
          newMessageData.replyToSenderId = replyingTo.senderId;
        }

        await addDoc(collection(db, `conversations/${chatId}/messages`), newMessageData);
        
        try {
          fetch('/api/notify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ receiverUid: otherUid })
          });
        } catch (e) {}
      }
      setReplyingTo(null);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error("Failed to send audio", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async (e?: FormEvent, textToUse: string = '') => {
    if (e) e.preventDefault();
    if ((!textToUse.trim() && pastedImages.length === 0) || textToUse.length > 2000 || isSending) return;

    setIsSending(true);
    const messageText = textToUse.trim();

    updateTypingStatus(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    try {
      if (pastedImages.length > 0) {
        const imagesToUpload = [...pastedImages];
        setPastedImages([]);
        
        // Optimistic UI for uploading
        const objectUrls = imagesToUpload.map(file => URL.createObjectURL(file));
        setUploadingImages({ urls: objectUrls, text: messageText });

        const idToken = await user.getIdToken();
        const uploadPromises = imagesToUpload.map(async (file) => {
          let compressedFile = file;
          try {
            const fileToCompress = (!file.type || !file.type.startsWith('image/'))
              ? new File([file], file.name || 'image.jpeg', { type: file.type || 'image/jpeg' })
              : file;
            const options = {
              maxSizeMB: 0.5,
              maxWidthOrHeight: 1080,
              useWebWorker: true,
              initialQuality: 0.7
            };
            compressedFile = await imageCompression(fileToCompress, options);
          } catch (e) {
            console.warn('Compression failed, using original file', e);
            compressedFile = file;
          }

          const sigRes = await fetch('/api/upload-signature', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${idToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ upload_preset: 'Squirrel' })
          });
          if (!sigRes.ok) throw new Error('Failed to get upload signature');
          const { timestamp, signature } = await sigRes.json();

          const formData = new FormData();
          formData.append('file', compressedFile);
          formData.append('api_key', process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || '');
          formData.append('timestamp', timestamp.toString());
          formData.append('upload_preset', 'Squirrel');
          formData.append('signature', signature);

          const res = await fetch(`https://api.cloudinary.com/v1_1/wusvh42x/image/upload`, {
            method: 'POST',
            body: formData
          });

          const data = await res.json();
          return data.secure_url as string;
        });

        const urls = await Promise.all(uploadPromises);
        const validUrls = urls.filter(Boolean);

        if (validUrls.length > 0) {
          const newMessageData: any = {
            senderId: user.uid,
            text: messageText,
            imageUrl: validUrls.length === 1 ? validUrls[0] : undefined,
            imageUrls: validUrls.length > 1 ? validUrls : undefined,
            createdAt: serverTimestamp(),
            seen: false
          };

          if (replyingTo) {
            newMessageData.replyToId = replyingTo.id;
            newMessageData.replyToText = replyingTo.text || 'Photo';
            newMessageData.replyToSenderId = replyingTo.senderId;
          }

          await addDoc(collection(db, `conversations/${chatId}/messages`), newMessageData);
          
          try {
            fetch('/api/notify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
              },
              body: JSON.stringify({ receiverUid: otherUid })
            });
          } catch (e) {}
        }

        // Cleanup optimistic UI
        objectUrls.forEach(url => URL.revokeObjectURL(url));
        setUploadingImages(null);
      } else {
        const newMessageData: any = {
          text: messageText,
          senderId: user.uid,
          createdAt: serverTimestamp(),
          seen: false
        };

        if (replyingTo) {
          newMessageData.replyToId = replyingTo.id;
          newMessageData.replyToText = replyingTo.text;
          newMessageData.replyToSenderId = replyingTo.senderId;
        }

        await addDoc(collection(db, `conversations/${chatId}/messages`), newMessageData);

        // Trigger notification to the other user
        try {
          const idToken = await user.getIdToken();
          fetch('/api/notify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ receiverUid: otherUid })
          });
        } catch (e) {}
      }

      setReplyingTo(null);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      console.error("Failed to send message", error);
      if (chatInputRef.current) chatInputRef.current.setText(messageText);
    } finally {
      setIsSending(false);
    }
  };

  const visibleMessages = useMemo(() => {
    return messages.filter(m => {
      if (m.deletedFor?.includes(user.uid)) return false;
      if (!m.createdAt) return true;
      let time = 0;
      if (m.createdAt.toDate) {
        time = m.createdAt.toDate().getTime();
      } else if (typeof m.createdAt === 'number') {
        time = m.createdAt;
      } else if (m.createdAt.seconds) {
        time = m.createdAt.seconds * 1000;
      } else {
        time = new Date(m.createdAt as any).getTime();
      }
      return time > clearedAt;
    });
  }, [messages, user.uid, clearedAt]);
  useEffect(() => {
    if (!showScrollBottom && visibleMessages.length > 0) {
      setBottomReadMessageId(visibleMessages[visibleMessages.length - 1].id);
    }
  }, [showScrollBottom, visibleMessages]);

  const unreadCountWhileScrolled = useMemo(() => {
    if (!showScrollBottom || !bottomReadMessageId || visibleMessages.length === 0) return 0;
    const readIndex = visibleMessages.findIndex(m => m.id === bottomReadMessageId);
    if (readIndex === -1) return 0;
    let count = 0;
    for (let i = readIndex + 1; i < visibleMessages.length; i++) {
      if (visibleMessages[i].senderId !== user?.uid) count++;
    }
    return count;
  }, [bottomReadMessageId, visibleMessages, showScrollBottom, user?.uid]);

  const daysCount = new Set(visibleMessages.map(m => {
    if (!m.createdAt) return '';
    const date = m.createdAt.toDate ? m.createdAt.toDate() : new Date(typeof m.createdAt === 'number' ? m.createdAt : (m.createdAt as any).seconds ? (m.createdAt as any).seconds * 1000 : m.createdAt as any);
    return date.toDateString();
  }).filter(Boolean)).size;

  const submitPin = async (finalPin: string) => {
    if (pinLoading) return;
    setPinLoading(true);
    setPinError('');
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/pin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ pin: finalPin })
      });
      if (res.ok) {
        setPinUnlockedThisSession(true);
        sessionStorage.setItem('pin_unlocked', 'true');
        setShowPinModal(false);
        setPinValue('');
        loadMore(true);
      } else if (res.status === 429) {
        setPinError('Too many attempts. Try again in 15 minutes.');
        setPinValue('');
      } else {
        setPinError('Invalid PIN');
        setPinValue('');
      }
    } catch (err) {
      setPinError('Error verifying PIN');
      setPinValue('');
    } finally {
      setPinLoading(false);
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pinValue.length >= 4 || pinLoading) return;
    const newVal = pinValue + digit;
    setPinValue(newVal);
    if (newVal.length === 4) {
      submitPin(newVal);
    }
  };

  const renderedMessages = useMemo(() => {
    const displayMessages = visibleMessages;
    let firstUnrepliedId: string | null = null;
    for (let i = displayMessages.length - 1; i >= 0; i--) {
      if (displayMessages[i].senderId === user?.uid) break;
      firstUnrepliedId = displayMessages[i].id;
    }

    const audioMessageIds = new Set(
      displayMessages
        .filter(m => m.audioUrl)
        .slice(-5)
        .map(m => m.id)
    );

    return displayMessages.map((msg, index) => {
      const showDate = index === 0 || !isSameDay(displayMessages[index - 1].createdAt, msg.createdAt);
      const isNewSenderGroup = index > 0 && !showDate && displayMessages[index - 1].senderId !== msg.senderId;

      return (
        <React.Fragment key={msg.id}>
          {showDate && (
            <div className="flex justify-center mb-4 mt-2 z-10 relative pointer-events-none">
              <div className="bg-white/80 backdrop-blur-md text-slate-600 font-medium text-[11px] px-3 py-1 rounded-full shadow-sm border border-black/5 tracking-wide">
                {formatDateSeparator(msg.createdAt)}
              </div>
            </div>
          )}
          <div className={isNewSenderGroup ? "mt-2" : ""}>
            <div id={`msg-${msg.id}`} className={`transition-all duration-300 ${searchResults.includes(msg.id) ? (searchResults[currentSearchIndex] === msg.id ? 'bg-amber-200/40 ring-2 ring-amber-400 rounded-lg shadow-sm px-1 py-1' : 'bg-amber-100/20 rounded-lg px-1 py-1') : ''}`}>
              <MessageItem searchQuery={searchQuery}
                message={msg}
                isMine={msg.senderId === user?.uid}
                user={user}
                chatId={chatId}
                isFirstUnreplied={msg.id === firstUnrepliedId}
                onReply={() => setReplyingTo(msg)}
                isAnonymousMode={privacyMode === 'blur'}
                isLastMessage={index === displayMessages.length - 1}
                isRevealed={revealedMessages.includes(msg.id)}
                onReveal={() => handleRevealMessage(msg.id)}
                isActiveReaction={activeReactionMessageId === msg.id}
                onReactOpen={() => setActiveReactionMessageId(msg.id)}
                onReactClose={() => setActiveReactionMessageId(null)}
                otherEmail={otherEmail}
                selectionMode={selectionMode}
                isSelected={selectedMessages.has(msg.id)}
                onToggleSelect={() => handleToggleSelect(msg.id)}
                isExpanded={expandedMessageId === msg.id}
                onToggleExpand={() => setExpandedMessageId(prev => prev === msg.id ? null : msg.id)}
                isPinned={pinnedMessage?.id === msg.id}
                onPinToggle={() => handlePinToggle(msg)}
                autoPreloadAudio={audioMessageIds.has(msg.id)}
              />
            </div>
          </div>
        </React.Fragment>
      );
    });
  }, [visibleMessages, user, chatId, searchQuery, searchResults, currentSearchIndex, privacyMode, revealedMessages, activeReactionMessageId, selectionMode, selectedMessages, expandedMessageId, pinnedMessage, otherEmail, formatDateSeparator, handlePinToggle]);

  return (
    <div className="chat-bg flex flex-col h-[100dvh] text-black relative overflow-hidden">
      <OnboardingTour user={user} />
      {privacyMode === 'pure' && <PurePrivacyCurtain onClose={() => setPrivacyMode('none')} />}
      
      {showPartnerModal && (
        <div 
          className="fixed inset-0 z-[99999] bg-transparent flex flex-col items-center justify-start pt-24 p-4 animate-fade-in"
          onClick={() => setShowPartnerModal(false)}
        >
          {/* Animated Instagram + Skyblue/Green Gradient Frame */}
          <div 
            className="w-72 h-72 sm:w-80 sm:h-80 rounded-full relative flex items-center justify-center cursor-pointer hover:scale-[1.02] transition-transform duration-500 ease-out shadow-2xl" 
            style={{ animation: 'slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
          >
            {/* Animated Gradient Background */}
            <div className="absolute inset-0 rounded-full overflow-hidden">
               <div className="absolute inset-[-50%] animate-[spin_5s_linear_infinite]" 
                    style={{ background: 'conic-gradient(from 0deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888, #87CEEB, #32CD32, #f09433)' }}>
               </div>
            </div>
            
            {/* Inner Image Container */}
            <div className="w-[calc(100%-8px)] h-[calc(100%-8px)] rounded-full overflow-hidden bg-slate-50 flex items-center justify-center relative z-10 group">
              {partnerData?.photoURL ? (
                <img 
                  src={partnerData.photoURL} 
                  alt="Profile" 
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-125" 
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              {/* Dummy Photo Fallback */}
              <div 
                className="w-full h-full bg-gradient-to-tr from-slate-200 to-slate-50 flex items-center justify-center"
                style={{ display: partnerData?.photoURL ? 'none' : 'flex' }}
              >
                <svg className="w-1/2 h-1/2 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}
      {isClientOffline && !hideOfflineBanner && (
        <div className="fixed top-[75px] left-1/2 -translate-x-1/2 bg-red-500/80 backdrop-blur-xl text-white text-[12px] font-medium py-1.5 px-3.5 rounded-full shadow-md border border-red-400/20 flex items-center justify-center space-x-2 z-[9999] animate-pop-in">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>
          <span className="whitespace-nowrap leading-none mt-px tracking-wide">No Internet Connection</span>
          <div className="w-px h-3 bg-white/30 mx-1"></div>
          <button
            onClick={() => setHideOfflineBanner(true)}
            className="p-0.5 hover:bg-white/20 rounded-full transition-colors shrink-0 -mr-1"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {/* Floating Top Section */}
      <div className="absolute top-0 left-0 right-0 z-40 flex flex-col pointer-events-none w-full items-center">
        {/* Header */}
        <div className={`pointer-events-auto flex flex-col px-4 py-2 bg-white/20 backdrop-blur-md backdrop-saturate-150 shadow-[inset_0_1px_2px_rgba(255,255,255,0.5),0_8px_32px_rgba(0,0,0,0.12)] border border-white/40 shrink-0 relative max-w-5xl w-[calc(100%-1rem)] mb-1 will-change-transform transform-gpu mt-2 pt-[max(env(safe-area-inset-top),0.5rem)] overflow-hidden transition-all duration-300 ease-in-out ${showMenu ? 'rounded-[24px]' : 'rounded-[32px]'}`}>
          {/* Sleek yellow shade line */}
          <div className="absolute bottom-0 left-[10%] right-[10%] h-[1.5px] bg-gradient-to-r from-transparent via-yellow-400/90 to-transparent pointer-events-none rounded-full blur-[0.3px]"></div>

          <div className="flex items-center justify-between w-full relative z-10">
            {selectionMode ? (
              <div className="flex items-center justify-between w-full h-10">
                <div className="flex items-center">
                  <button onClick={() => { setSelectionMode(false); setSelectedMessages(new Set()); }} className="p-2 mr-2 bg-white/50 rounded-full hover:bg-white text-slate-700 transition-colors shadow-sm">
                    <X size={20} />
                  </button>
                  <span className="font-bold text-slate-800 text-lg">{selectedMessages.size} selected</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={() => {
                    if (selectedMessages.size === messages.length) {
                      setSelectedMessages(new Set());
                      setSelectionMode(false);
                    } else {
                      setSelectedMessages(new Set(messages.map(m => m.id)));
                    }
                  }} className="p-2 bg-white/50 rounded-full hover:bg-white text-slate-700 transition-colors shadow-sm" title="Select All">
                    <CheckSquare size={20} />
                  </button>
                  <button onClick={handleCopySelected} className="p-2 bg-white/50 rounded-full hover:bg-white text-slate-700 transition-colors shadow-sm">
                    <Copy size={20} />
                  </button>
                  <button onClick={handleDeleteSelected} className="p-2 bg-red-500/90 rounded-full hover:bg-red-500 text-white transition-colors shadow-sm">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Left Side: Menu */}
                <div className="flex items-center relative">
                  <button
                    id="menu-toggle-btn"
                    onClick={() => setShowMenu(!showMenu)}
                    className={`relative w-10 h-10 flex items-center justify-center rounded-full transition-all duration-500 ease-out overflow-hidden backdrop-blur-xl backdrop-saturate-200 border border-amber-300/60 shadow-[0_4px_12px_rgba(251,191,36,0.15),inset_0_1px_2px_rgba(255,255,255,0.9)] hover:shadow-[0_6px_16px_rgba(251,191,36,0.25),inset_0_1px_3px_rgba(255,255,255,1)] hover:scale-105 active:scale-95 ${showMenu ? 'bg-amber-100/50 text-amber-900' : 'bg-white/40 text-slate-700 hover:text-amber-800'}`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/70 to-transparent pointer-events-none rounded-full" />
                    <ChevronDown className={`relative z-10 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${showMenu ? '-rotate-180' : ''}`} size={22} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Right Side: Profile & SignOut */}
                <div className="flex items-center justify-end flex-1 min-w-0 ml-4 space-x-3">
                  {/* Partner Profile Picture */}
                  <button 
                    onClick={() => setShowPartnerModal(true)}
                    className="w-[38px] h-[38px] rounded-full shrink-0 shadow-sm hover:scale-105 active:scale-95 transition-transform flex items-center justify-center relative"
                  >
                    {/* Animated Gradient Background */}
                    <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                       <div className="absolute inset-[-50%] animate-[spin_5s_linear_infinite]" 
                            style={{ background: 'conic-gradient(from 0deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888, #87CEEB, #32CD32, #f09433)' }}>
                       </div>
                    </div>
                    
                    <div className="w-[calc(100%-4px)] h-[calc(100%-4px)] rounded-full overflow-hidden bg-slate-100 flex items-center justify-center relative z-10">
                      {partnerData?.photoURL ? (
                        <img src={partnerData?.photoURL} alt="Partner" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      )}
                    </div>
                  </button>

                  <div className="flex flex-col items-end overflow-hidden">
                    <h1 className="text-[14px] font-bold text-slate-800 truncate w-full text-right tracking-wide leading-tight">
                      {getMaskedEmail(otherEmail)}
                    </h1>
                    <StatusIndicator
                      state={otherUserStatus?.state}
                      timestamp={otherUserStatus?.last_changed || null}
                      isTyping={isOtherTyping}
                    />
                  </div>
                  <button
                    onClick={signOut}
                    className={`px-4 py-1.5 text-[13px] font-bold text-white rounded-full shadow-sm transition-all whitespace-nowrap shrink-0 ${otherUserStatus?.state === 'online' ? 'bg-green-500/90 hover:bg-green-500' : 'bg-red-500/90 hover:bg-red-500'}`}
                  >
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Expanded Menu Options inside Navbar */}
          <div className={`w-full flex flex-col transition-all duration-300 origin-top ${showMenu ? 'max-h-[160px] mt-2 mb-0 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
            <div className="flex flex-row items-center justify-around w-full px-2 py-2 bg-white/30 rounded-2xl">
              
              <button
                title="Settings"
                onClick={() => window.location.href = '/settings'}
                className="p-3 text-green-600 bg-white/50 hover:bg-white/70 active:bg-white/90 rounded-full transition-all shadow-sm ring-1 ring-[#D4AF37]/50"
              >
                <Settings size={22} />
              </button>

              {user.email === 'officialhaadi81@gmail.com' && (
                <>
                  <button
                    title={generatedPin ? `PIN: ${generatedPin}` : 'Generate PIN'}
                    onClick={async () => {
                      const idToken = await user.getIdToken();
                      const res = await fetch('/api/pin/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` }
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setGeneratedPin(data.pin);
                        showToast(`Generated PIN: ${data.pin}`);
                      } else {
                        showToast('Failed to generate PIN.');
                      }
                    }}
                    className="p-3 text-slate-600 bg-white/40 hover:bg-white/60 active:bg-white/80 rounded-full transition-all ring-1 ring-[#D4AF37]/50"
                  >
                    <Lock size={20} />
                  </button>
  
                  <button
                    title="Copy all messages"
                    onClick={() => {
                      setConfirmAction({
                        title: 'Copy Messages?',
                        description: 'Copy all currently loaded messages to your clipboard?',
                        confirmText: 'Copy',
                        onConfirm: () => {
                          const texts = visibleMessages.map(m => m.text).join('\n\n');
                          navigator.clipboard.writeText(texts);
                          setShowMenu(false);
                          showToast('All loaded messages copied!');
                          setConfirmAction(null);
                        }
                      });
                    }}
                    className="p-3 text-slate-600 bg-white/40 hover:bg-white/60 active:bg-white/80 rounded-full transition-all ring-1 ring-[#D4AF37]/50"
                  >
                    <Copy size={20} />
                  </button>
                </>
              )}
  
              <button
                title={showSearch ? 'Close Search' : 'Search Messages'}
                onClick={() => {
                  setShowSearch(!showSearch);
                  if (!showSearch) {
                    setTimeout(() => searchInputRef.current?.focus(), 100);
                  } else {
                    setSearchQuery('');
                  }
                  setShowMenu(false);
                }}
                className={`p-3 rounded-full transition-all ring-1 ring-[#D4AF37]/50 ${showSearch ? 'bg-blue-100 text-blue-600' : 'text-slate-600 bg-white/40 hover:bg-white/60 active:bg-white/80'}`}
              >
                {showSearch ? <X size={20} /> : <Search size={20} />}
              </button>
  
              <button
                title={privacyMode !== 'none' ? `Disable Privacy (${privacyMode})` : 'Privacy (Tap: Blur, Double: Pure)'}
                onClick={(e) => {
                  const now = Date.now();
                  const DOUBLE_PRESS_DELAY = 300;
                  
                  if (privacyTapTimeout.current) {
                    clearTimeout(privacyTapTimeout.current);
                    privacyTapTimeout.current = null;
                  }
                  
                  if (now - lastTapRef.current < DOUBLE_PRESS_DELAY) {
                    // Double tap
                    setConfirmAction({
                      title: 'Enable Pure Privacy?',
                      description: 'Are you sure you want to toggle pure privacy mode?',
                      confirmText: 'Toggle',
                      onConfirm: () => {
                        setPrivacyMode(privacyMode === 'pure' ? 'none' : 'pure');
                        setShowMenu(false);
                        setConfirmAction(null);
                      }
                    });
                  } else {
                    // Single tap
                    privacyTapTimeout.current = setTimeout(() => {
                      setConfirmAction({
                        title: 'Enable Blur Privacy?',
                        description: 'Are you sure you want to toggle blur privacy mode?',
                        confirmText: 'Toggle',
                        onConfirm: () => {
                          setPrivacyMode(privacyMode === 'blur' ? 'none' : 'blur');
                          setShowMenu(false);
                          setConfirmAction(null);
                        }
                      });
                    }, DOUBLE_PRESS_DELAY);
                  }
                  lastTapRef.current = now;
                }}
                className={`p-3 rounded-full transition-all ring-1 ring-[#D4AF37]/50 ${privacyMode !== 'none' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-600 bg-white/40 hover:bg-white/60 active:bg-white/80'}`}
              >
                <Ghost size={20} />
              </button>
  
              <button
                title="Clear Chat"
                onClick={() => {
                  setConfirmAction({
                    title: 'Clear Chat?',
                    description: 'Are you sure you want to clear all messages? This action cannot be undone.',
                    confirmText: 'Clear',
                    isDestructive: true,
                    onConfirm: () => {
                      handleClearChat();
                      setConfirmAction(null);
                    }
                  });
                }}
                className="p-3 text-red-600 bg-red-50/50 hover:bg-red-100/60 active:bg-red-200/80 rounded-full transition-all ring-1 ring-[#D4AF37]/50"
              >
                <Trash2 size={20} />
              </button>
            </div>
            
            {/* Status Field */}
            <div className="mt-1.5 w-full px-3 pb-0">
              <div className="w-full bg-white/40 text-[13px] py-1 px-4 rounded-full border border-slate-300/60 shadow-sm text-center font-medium truncate text-slate-600 tracking-wide">
                {otherUserAbout || "Hey there! I am using Squirrel."}
              </div>
            </div>
          </div>
        </div>

        {/* Pinned Message */}
        {pinnedMessage && !isKeyboardOpen && (
          <div
            ref={pinBannerRef}
            className="mx-2 max-w-5xl mx-auto w-[calc(100%-1rem)] bg-white/70 backdrop-blur-md rounded-[20px] shadow-sm border border-white/40 px-4 py-2 mt-1 mb-1 flex items-center justify-between shrink-0 relative z-20 pointer-events-auto cursor-pointer hover:bg-white/80 transition-transform select-none"
            onClick={(e) => {
              if (pinSwipeDraggingRef.current) {
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              const el = document.getElementById(`msg-${pinnedMessage.id}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                  el.classList.add('bg-blue-100/50', 'ring-2', 'ring-blue-400');
                  setTimeout(() => {
                    el.classList.remove('bg-blue-100/50', 'ring-2', 'ring-blue-400');
                  }, 2000);
                }, 300);
              }
            }}
            onTouchStart={handlePinTouchStart}
            onTouchMove={handlePinTouchMove}
            onTouchEnd={handlePinTouchEnd}
            onMouseDown={handlePinTouchStart}
            onMouseMove={handlePinTouchMove}
            onMouseUp={handlePinTouchEnd}
            onMouseLeave={handlePinTouchEnd}
          >
            <div className="flex items-center space-x-3 overflow-hidden flex-1 pointer-events-none">
              <Pin size={16} className="text-blue-500 shrink-0 fill-blue-500" />
              <div className="flex flex-col overflow-hidden w-full">
                <span className="text-[11px] font-bold text-blue-600 tracking-wider mb-0.5">Pinned Message</span>
                <span className="text-[13px] text-slate-700 truncate w-full leading-tight">{pinnedMessage.text}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search Bar - Absolute positioned over messages for speed and no layout shift */}
      <div
        className={`absolute top-[75px] left-0 right-0 z-30 w-full max-w-5xl mx-auto px-4 transition-all duration-150 ease-in-out ${showSearch ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-4 pointer-events-none'}`}
      >
        <div className="flex items-center space-x-2">
          <div className="flex-1 bg-[#efeae2] border border-slate-300 shadow-md rounded-2xl p-2 flex items-center space-x-2">
            <div className="flex-1 bg-white rounded-xl flex items-center px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500/50 transition-all">
              <Search size={16} className="text-slate-400 mr-2 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search loaded messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent outline-none text-sm text-slate-700 placeholder-slate-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="flex items-center space-x-1 shrink-0 bg-white rounded-xl p-1">
                <span className="text-xs font-semibold text-slate-500 px-2 min-w-[40px] text-center">
                  {searchResults.length > 0 ? currentSearchIndex + 1 : 0}/{searchResults.length}
                </span>
                <div className="w-px h-4 bg-slate-300 mx-1"></div>
                <button onClick={handlePrevSearch} disabled={searchResults.length === 0} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                  <ChevronUp size={16} />
                </button>
                <button onClick={handleNextSearch} disabled={searchResults.length === 0} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                  <ChevronDown size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Liquid Glass Close Button with Golden Boundary */}
          <button
            onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
            }}
            className="shrink-0 relative w-11 h-11 rounded-full bg-white/40 backdrop-blur-md backdrop-saturate-150 shadow-[0_4px_12px_rgba(0,0,0,0.1)] flex items-center justify-center text-slate-700 hover:bg-white/60 hover:scale-105 active:scale-95 transition-all overflow-hidden"
          >
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <defs>
                <linearGradient id="goldGradientSearch" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#eab308" />
                  <stop offset="50%" stopColor="#fef3c7" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
              </defs>
              <circle cx="22" cy="22" r="21.5" fill="none" stroke="url(#goldGradientSearch)" strokeWidth="1.5" />
            </svg>
            <X size={20} strokeWidth={2.5} className="relative z-10" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={(e) => {
          setActiveReactionMessageId(null);
          const target = e.target as HTMLDivElement;
          const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 150;
          setShowScrollBottom(!isNearBottom);
        }}
        className={`flex-1 overflow-y-auto px-2 sm:px-4 py-4 flex flex-col relative scroll-smooth w-full max-w-4xl mx-auto transition-all duration-500 ${privacyMode === 'pure' ? 'opacity-30 saturate-0 brightness-75' : 'opacity-100 saturate-100 brightness-100'}`}
      >
        {/* Spacers to prevent content from hiding under the floating header */}
        <div className="shrink-0 h-[60px]" />
        {pinnedMessage && !isKeyboardOpen && <div className="shrink-0 h-[50px]" />}
        {messages.length >= loadedCount && (
          <div className="flex justify-center mb-6 z-10">
            <button
              onClick={() => loadMore()}
              disabled={isFetchingMore}
              className="px-4 py-1.5 bg-white shadow-sm rounded-full text-[13px] font-medium text-slate-600 active:scale-95 transition-all disabled:opacity-50"
            >
              {isFetchingMore ? 'Loading...' : 'Load earlier messages'}
            </button>
          </div>
        )}
        <div className="flex-1" />

        {/* Memoized rendered messages */}

        {isLoadingMessages ? (
          <div className="flex flex-col space-y-4 w-full h-full justify-end pb-4 px-2 mt-auto">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`flex w-full ${i % 2 !== 0 ? 'justify-end' : 'justify-start'}`}>
                <div className={`skeleton-blue h-[45px] ${i % 2 !== 0 ? 'w-2/3 rounded-2xl rounded-tr-sm' : 'w-1/2 rounded-2xl rounded-tl-sm'}`}></div>
              </div>
            ))}
          </div>
        ) : renderedMessages}

        {/* Optimistic Uploading Images UI */}
        {uploadingImages && (
          <div className="flex w-full justify-end mb-2.5 animate-message-sent">
            <div className="max-w-[85%] sm:max-w-[70%] rounded-[22px] px-2.5 pt-1.5 pb-1 shadow-sm border bg-[#d9fdd3] text-[#111b21] rounded-tr-[4px] border-[#c8eed4] opacity-70">
              <div className="flex flex-col relative pointer-events-none select-none">
                <div className={`mb-1.5 ${uploadingImages.urls.length > 1 ? 'grid grid-cols-2 gap-1 rounded-xl overflow-hidden' : 'rounded-xl overflow-hidden relative'}`} style={!(uploadingImages.urls.length > 1) ? { minWidth: '150px', minHeight: '150px' } : undefined}>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10 z-10 rounded-xl">
                    <div className="w-8 h-8 border-4 border-white border-t-teal-500 rounded-full animate-spin shadow-md"></div>
                  </div>
                  {uploadingImages.urls.map((url, idx) => (
                    <div key={idx} className={`relative overflow-hidden ${uploadingImages.urls.length > 1 ? 'aspect-square' : 'w-full h-auto'} ${uploadingImages.urls.length === 3 && idx === 2 ? 'col-span-2 aspect-[2/1]' : ''}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="Uploading" className={`w-full h-full object-cover blur-[2px] scale-105 ${!(uploadingImages.urls.length > 1) ? 'rounded-xl border border-black/5' : ''}`} />
                    </div>
                  ))}
                </div>
                {uploadingImages.text && (
                  <p className="text-[15px] whitespace-pre-wrap break-words leading-snug pr-2">
                    {uploadingImages.text}
                  </p>
                )}
                <div className="flex items-center justify-end space-x-1 mt-0.5 self-end float-right">
                  <span className="text-[10.5px] text-black/45 font-medium tracking-tight">
                    Sending...
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Typing Indicator */}
        {(isOtherTyping || isOtherRecording) && (
          <div className="flex w-full justify-start mb-2.5 animate-pop-in">
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center space-x-1">
              {isOtherRecording ? (
                <div className="flex items-center space-x-1.5">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-[12px] font-medium text-slate-500 tracking-tight">recording audio...</span>
                </div>
              ) : (
                <>
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </>
              )}
            </div>
          </div>
        )}

        <div className="shrink-0 h-[80px]" />
        <div ref={messagesEndRef} className="h-1 w-full shrink-0" />
      </div>

      {showScrollBottom && (
        <button
          onClick={() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          className={`fixed right-6 sm:right-10 z-[100] p-3 rounded-full cursor-pointer animate-pop-in transition-all duration-300 ease-out bg-white/40 backdrop-blur-md backdrop-saturate-150 border border-white/60 shadow-[0_4px_12px_rgba(0,0,0,0.08)] text-slate-700 hover:text-blue-600 hover:bg-white/60 hover:scale-105 active:scale-95 ${replyingTo ? 'bottom-[145px]' : 'bottom-[90px]'}`}
        >
          {unreadCountWhileScrolled > 0 && (
            <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[11px] font-bold px-1.5 py-0.5 min-w-[20px] h-[20px] flex items-center justify-center rounded-full shadow-sm animate-pop-in border border-white/50">
              {unreadCountWhileScrolled}
            </span>
          )}
          <ChevronDown size={22} strokeWidth={2.5} />
        </button>
      )}

      {/* Floating Composer */}
      <div className="absolute bottom-[env(safe-area-inset-bottom,0px)] pb-3 pt-2 left-0 right-0 z-40 pointer-events-none flex justify-center px-2 sm:px-4 w-full will-change-transform transform-gpu">
        <div className="w-full max-w-4xl relative pointer-events-auto flex flex-col">

          {replyingTo && (
            <div className="max-w-4xl w-full mx-auto mb-2 flex items-center justify-between bg-[#e2e8f0] rounded-lg p-2 shadow-sm border-l-4 border-teal-500 animate-slide-up relative z-10 pointer-events-auto overflow-hidden">
              <div className="flex-1 overflow-hidden pr-2 min-w-0 w-0">
                <p className="text-[12px] font-semibold text-teal-600 mb-0.5 truncate">
                  {replyingTo.senderId === user?.uid ? 'You' : otherEmail}
                </p>
                <p className="text-[13px] text-slate-600 truncate">
                  {replyingTo.text || 'Image'}
                </p>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                className="p-1 rounded-full hover:bg-slate-300 text-slate-500 shrink-0 flex-none ml-2"
                type="button"
                aria-label="Cancel reply"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <ChatInputForm
            ref={chatInputRef}
            isSending={isSending}
            onSend={handleSend}
            onSendAudio={handleSendAudio}
            pastedImagesLength={pastedImages.length}
            onPasteImage={(file) => setPastedImages(prev => [...prev, file])}
            onImageUpload={handleImageUpload}
            scrollContainerRef={scrollContainerRef}
            messagesEndRef={messagesEndRef}
            updateTypingStatus={updateTypingStatus}
            updateRecordingStatus={updateRecordingStatus}
            enterToSend={enterToSend}
            onCameraClick={() => setShowCamera(true)}
          />
        </div>
      </div>

      {showCamera && (
        <CameraCapture
          onCapture={(file) => {
            setSelectedImageFile(file);
            setShowCamera(false);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {selectedImageFile && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col animate-pop-in">
          <ImageEditor file={selectedImageFile} onCancel={() => setSelectedImageFile(null)} onSend={handleSendEditedImage} />
        </div>
      )}

      <MultiImagePreviewModal
        files={pastedImages}
        onAddMore={(files) => setPastedImages((prev) => [...prev, ...files])}
        onRemove={(idx) => setPastedImages((prev) => prev.filter((_, i) => i !== idx))}
        onUpdateFile={(idx, newFile) => setPastedImages(prev => prev.map((f, i) => i === idx ? newFile : f))}
        onClose={() => setPastedImages([])}
        onSend={(caption) => {
          if (chatInputRef.current) chatInputRef.current.setText('');
          handleSend(undefined, caption);
        }}
      />

      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#f2f2f2]/95 backdrop-blur-2xl rounded-[14px] shadow-2xl w-full max-w-[270px] flex flex-col overflow-hidden animate-pop-in text-center border border-white/20">
            <div className="px-4 pt-5 pb-4">
              <h3 className="text-[17px] font-semibold text-black tracking-tight">Delete {selectedMessages.size} message{selectedMessages.size > 1 ? 's' : ''}?</h3>
              <p className="text-[13px] text-black/70 leading-snug mt-1 px-1">This action cannot be undone.</p>
            </div>
            <div className="flex flex-col border-t border-black/10">
              {(() => {
                const selectedMsgs = messages.filter(m => selectedMessages.has(m.id));
                const canDeleteForEveryone = selectedMsgs.every(m => {
                  if (m.senderId !== user.uid) return false;
                  if (m.isDeletedForEveryone) return false;
                  const msgTime = m.createdAt?.toDate ? m.createdAt.toDate().getTime() : (new Date(m.createdAt as any)).getTime();
                  return (Date.now() - msgTime) < (12 * 60 * 60 * 1000);
                });
                return canDeleteForEveryone ? (
                  <button onClick={() => confirmBulkDelete(true)} className="h-[44px] text-[17px] font-semibold text-[#FF3B30] hover:bg-black/5 active:bg-black/10 transition-colors border-b border-black/10">
                    Delete for everyone
                  </button>
                ) : null;
              })()}
              <button onClick={() => confirmBulkDelete(false)} className="h-[44px] text-[17px] font-semibold text-[#FF3B30] hover:bg-black/5 active:bg-black/10 transition-colors border-b border-black/10">
                Delete for me
              </button>
              <button onClick={() => setShowBulkDeleteModal(false)} className="h-[44px] text-[17px] font-normal text-[#007AFF] hover:bg-black/5 active:bg-black/10 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unpin Confirm Modal */}
      {showUnpinConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#f2f2f2]/95 backdrop-blur-2xl rounded-[14px] shadow-2xl w-full max-w-[270px] flex flex-col overflow-hidden animate-pop-in text-center border border-white/20">
            <div className="px-4 pt-5 pb-4">
              <h3 className="text-[17px] font-semibold text-black tracking-tight">Unpin this message?</h3>
              <p className="text-[13px] text-black/70 leading-snug mt-1 px-1">The message will no longer be pinned at the top of the chat for everyone.</p>
            </div>
            <div className="flex border-t border-black/10 h-[44px]">
              <button onClick={() => setShowUnpinConfirm(false)} className="flex-1 text-[17px] font-normal text-[#007AFF] hover:bg-black/5 active:bg-black/10 transition-colors border-r border-black/10">
                Cancel
              </button>
              <button onClick={confirmUnpin} className="flex-1 text-[17px] font-semibold text-[#FF3B30] hover:bg-black/5 active:bg-black/10 transition-colors">
                Unpin
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Pin Error Toast */}
      {showPinError && (
        <div className="fixed top-[100px] left-1/2 -translate-x-1/2 z-[100] animate-slide-up">
          <div className="bg-slate-800/95 backdrop-blur-md text-white px-5 py-3 rounded-full shadow-lg border border-slate-700/50 flex items-center space-x-3">
            <Info size={18} className="text-amber-400" />
            <span className="text-sm font-medium tracking-wide">Cannot pin two messages. Unpin first.</span>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes slideUpFullScreen {
          0% { transform: translateY(100%); }
          100% { transform: translateY(0); }
        }
        .animate-slide-up-fullscreen {
          animation: slideUpFullScreen 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
      `}} />
      {showPinModal && (
        <div className="fixed inset-0 z-[99999] bg-white flex flex-col items-center justify-center animate-slide-up-fullscreen overflow-hidden touch-none">
          <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-8 pt-4 pb-12 h-full justify-between bg-white">
            
            <div className="flex flex-col items-center mt-12 w-full">
              <div className="w-16 h-16 bg-blue-50/80 rounded-full flex items-center justify-center mb-6 shadow-sm border border-blue-100">
                <Lock size={32} className="text-blue-500" />
              </div>
              
              <h4 className="text-[22px] font-bold text-slate-800 tracking-wide mb-2">
                Older Messages
              </h4>
              <p className="text-slate-500 font-medium text-sm">Enter 4-digit PIN to load</p>

              <div className="flex justify-center space-x-6 mt-12 mb-6 w-full">
                {[...Array(4)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                      i < pinValue.length 
                        ? 'bg-blue-600 scale-110' 
                        : 'bg-slate-200 border border-slate-300/50'
                    }`} 
                  />
                ))}
              </div>

              <div className="h-6 w-full flex justify-center items-center">
                {pinError && <p className="text-rose-500 text-sm font-semibold tracking-wide animate-pulse bg-rose-50 px-4 py-1 rounded-full">{pinError}</p>}
                {pinLoading && <p className="text-blue-600 text-sm font-semibold tracking-wide animate-pulse flex items-center gap-2 bg-blue-50 px-4 py-1 rounded-full"><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</p>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-x-6 gap-y-4 w-full max-w-[280px] mb-8">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  disabled={pinLoading}
                  onClick={() => handlePinDigit(num.toString())}
                  className="w-[78px] h-[78px] rounded-full text-slate-800 text-[32px] font-light flex items-center justify-center transition-all duration-150 active:bg-slate-200 active:scale-95 hover:bg-slate-50 border border-transparent hover:border-slate-100 disabled:opacity-50 select-none mx-auto"
                >
                  {num}
                </button>
              ))}

              {/* Skip */}
              <button
                onClick={() => { setShowPinModal(false); setPinValue(''); setPinError(''); }}
                className="w-[78px] h-[78px] rounded-full text-emerald-600 text-base font-semibold flex items-center justify-center transition-all duration-150 active:bg-emerald-100 active:scale-95 hover:bg-emerald-50 border border-transparent hover:border-emerald-100/50 select-none mx-auto"
              >
                Skip
              </button>

              {/* 0 */}
              <button
                disabled={pinLoading}
                onClick={() => handlePinDigit('0')}
                className="w-[78px] h-[78px] rounded-full text-slate-800 text-[32px] font-light flex items-center justify-center transition-all duration-150 active:bg-slate-200 active:scale-95 hover:bg-slate-50 border border-transparent hover:border-slate-100 disabled:opacity-50 select-none mx-auto"
              >
                0
              </button>

              {/* Delete */}
              <button
                disabled={pinLoading}
                onClick={() => setPinValue(prev => prev.slice(0, -1))}
                className="w-[78px] h-[78px] rounded-full text-slate-500 flex items-center justify-center transition-all duration-150 active:bg-slate-200 active:text-slate-800 active:scale-95 hover:bg-slate-50 border border-transparent hover:border-slate-100 disabled:opacity-50 select-none mx-auto"
              >
                <Trash2 size={24} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[9999] bg-[#f9f9f9]/90 backdrop-blur-2xl text-black px-6 py-3 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] text-[15px] font-semibold animate-pop-in border border-black/5 pointer-events-none tracking-tight">
          {toastMessage}
        </div>
      )}

      {/* Confirmation Modal (iOS Style) */}
      {confirmAction && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#f2f2f2]/95 backdrop-blur-2xl rounded-[14px] shadow-2xl w-full max-w-[270px] flex flex-col overflow-hidden animate-pop-in text-center border border-white/20">
            <div className="px-4 pt-5 pb-4">
              <h3 className="text-[17px] font-semibold text-black tracking-tight">{confirmAction.title}</h3>
              <p className="text-[13px] text-black/70 leading-snug mt-1 px-1">{confirmAction.description}</p>
            </div>
            <div className="flex border-t border-black/10 h-[44px]">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 text-[17px] font-normal text-[#007AFF] hover:bg-black/5 active:bg-black/10 transition-colors border-r border-black/10"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction.onConfirm}
                className={`flex-1 text-[17px] font-semibold hover:bg-black/5 active:bg-black/10 transition-colors ${confirmAction.isDestructive ? 'text-[#FF3B30]' : 'text-[#007AFF]'}`}
              >
                {confirmAction.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

