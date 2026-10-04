'use client';
import { getToken } from 'firebase/messaging';
import { getFirebaseMessaging } from '@/lib/firebase';
import imageCompression from 'browser-image-compression';
import { useRouter } from 'next/navigation';

import React, { useState, useEffect, useRef, useLayoutEffect, FormEvent, useMemo } from 'react';
import { User } from 'firebase/auth';
import { db, rtdb } from '@/lib/firebase';
import { getWallpaperSettings, getWallpaperUrl, WallpaperSettings, defaultSettings } from '@/lib/wallpaper';
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
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { ref, onValue, set, onDisconnect, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
import { Message } from '@/types/chat';
import MessageItem from './MessageItem';
import { useAuth } from '@/hooks/useAuth';
import { Smile, Send, Info, X, Image as ImageIcon, Loader2, Ghost, ArrowLeft, Copy, Trash2, ChevronDown, ChevronUp, Search, Pin, Camera, MoreVertical, RotateCcw, Clock, CheckSquare, Lock, Plus, Settings, Power } from 'lucide-react';
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
          <div className={`col-start-1 row-start-1 flex items-center space-x-1.5 transition-opacity duration-500 ease-in-out bg-white/80 px-1.5 py-0.5 rounded-full ${toggle ? 'opacity-100' : 'opacity-0'}`}>
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_6px_rgba(59,130,246,0.8)]"></div>
            <span className="text-[11px] font-bold text-blue-600">Online</span>
          </div>
          <div className={`col-start-1 row-start-1 flex items-center transition-opacity duration-500 ease-in-out bg-white/80 px-1.5 py-0.5 rounded-full ${!toggle ? 'opacity-100' : 'opacity-0'}`}>
            <span className="text-[11px] font-bold text-blue-600 italic">Typing...</span>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-end h-[14px] space-x-1.5 bg-white/80 px-1.5 py-0.5 rounded-full mt-0.5">
        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_6px_rgba(59,130,246,0.8)]"></div>
        <span className="text-[11px] font-bold text-blue-600">Online</span>
      </div>
    );
  }

  if (state === 'logging_in') {
    return (
      <div className="flex items-center justify-end h-[14px] space-x-1.5 bg-white/80 px-1.5 py-0.5 rounded-full mt-0.5">
        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse shadow-[0_0_6px_rgba(245,158,11,0.8)]"></div>
        <span className="text-[11px] font-bold text-amber-600 italic">logging in...</span>
      </div>
    );
  }

  if (!timestamp) {
    return (
      <div className="flex items-center justify-end h-auto leading-none mt-0.5">
        <span className="text-[10px] font-bold text-slate-700 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] tracking-wide">Offline</span>
      </div>
    );
  }

  const date = new Date(timestamp);
  const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)} | ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

  return (
    <div className="flex items-center justify-end animate-fade-in h-auto leading-none mt-0.5">
      <span className="text-[10px] font-bold text-slate-700 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] tracking-wide">{formattedDate}</span>
    </div>
  );
};

// Secure LocalStorage Cache
const secureCache = {
  set: (key: string, data: any, secret: string) => {
    try {
      const text = JSON.stringify(data);
      // Fast obfuscation using native functions
      const encoded = encodeURIComponent(text);
      localStorage.setItem(key, btoa(encoded));
    } catch (e) { console.error('Cache set error'); }
  },
  get: (key: string, secret: string) => {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      const decoded = atob(cached);
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
      {/* Gesture Overlay for Revealing Messages */}
      <div
        className="absolute inset-0 z-20 cursor-grab active:cursor-grabbing"
        onPointerDown={handleTextPointerDown}
        style={{
          transform: `translateX(${swipeX}px)`,
          opacity: Math.max(0, 1 - swipeX / 200)
        }}
      />

      <div className="flex-1 pointer-events-none" />

      {/* Bottom Handle */}
      <div
        className="w-full h-20 cursor-ns-resize flex items-center justify-center bg-zinc-900/50 backdrop-blur-xl border-t border-zinc-700/30 relative z-10 hover:bg-zinc-800/50 transition-colors shadow-[0_-4px_20px_rgba(0,0,0,0.3)] shrink-0"
        onPointerDown={handlePointerDown}
      >
        <div className="flex gap-2 items-center justify-center pointer-events-none">
          <div className="w-2 h-2 rounded-full bg-zinc-400" />
          <div className="w-12 h-2 rounded-full bg-zinc-400" />
          <div className="w-2 h-2 rounded-full bg-zinc-400" />
        </div>
      </div>
    </div>
  );
};

const getApiUrl = (path: string) => {
  const resolvedPath = path.endsWith('/') ? path : `${path}/`;
  if (typeof window !== 'undefined' && window.origin && (window.origin === 'https://localhost' || window.origin === 'http://localhost' || window.origin === 'capacitor://localhost') && window.location.port !== '3000') {
    return `http://10.153.85.8:3000${resolvedPath}`;
  }
  return resolvedPath;
};

const getReplyText = (msg: Message) => {
  if (msg.text) return msg.text;
  if (msg.audioUrl) return 'Voice Note';
  if (msg.imageUrl || (msg.imageUrls && msg.imageUrls.length > 0)) return 'Photo';
  return 'Message';
};

export default function ChatUI({ user }: ChatUIProps) {
  const router = useRouter();
  const [wallpaperSettings, setWallpaperSettings] = useState<WallpaperSettings>(defaultSettings);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [isOtherRecording, setIsOtherRecording] = useState(false);
  const [loadedCount, setLoadedCount] = useState(10);

  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [pastedImages, setPastedImages] = useState<File[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [pinnedMessage, setPinnedMessage] = useState<{ id: string; text: string; senderId: string } | null>(null);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [showUnpinConfirm, setShowUnpinConfirm] = useState(false);
  const [showPinError, setShowPinError] = useState(false);
  const [uploadingImages, setUploadingImages] = useState<{ urls: string[], text: string } | null>(null);
  const [uploadController, setUploadController] = useState<AbortController | null>(null);

  const chatId = 'private-chat';
  const isPartner = user.email === 'sadiyaayoub22019@gmail.com' || user.email === 'officialhaadi81@gmail.com';
  const otherEmail = user.email === 'sadiyaayoub22019@gmail.com' ? 'officialhaadi81@gmail.com' : 'sadiyaayoub22019@gmail.com';

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<any>(null);

  const initialLoadDone = useRef(false);
  const newestMsgTimeRef = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const prevScrollTopRef = useRef<number>(0);
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
  const [unreadDividerMsgId, setUnreadDividerMsgId] = useState<string | null>(null);
  const [unreadDividerCount, setUnreadDividerCount] = useState<number>(0);


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
        // We want to remain at the exact message the user was looking at.
        scrollContainerRef.current.scrollTop = prevScrollTopRef.current + diff;

        prevScrollHeightRef.current = 0;
        shouldScrollToTopAfterLoad.current = false;
      }
    }
  }, [messages, loadedCount]);

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

  const stateRef = useRef({
    showCamera,
    showMenu,
    replyingTo,
    confirmAction,
    isKeyboardOpen,
    showPartnerModal,
    showBulkDeleteModal,
    showUnpinConfirm,
    showClearConfirm,
    showSearch,
    hasSelectedImageFile: !!selectedImageFile,
    hasPastedImages: pastedImages.length > 0,
    selectionMode: false
  });

  useEffect(() => {
    stateRef.current = {
      showCamera,
      showMenu,
      replyingTo,
      confirmAction,
      isKeyboardOpen,
      showPartnerModal,
      showBulkDeleteModal,
      showUnpinConfirm,
      showClearConfirm,
      showSearch,
      hasSelectedImageFile: !!selectedImageFile,
      hasPastedImages: pastedImages.length > 0,
      selectionMode
    };
  }, [
    showCamera, showMenu, replyingTo, confirmAction, isKeyboardOpen,
    showPartnerModal, showBulkDeleteModal, showUnpinConfirm, showClearConfirm,
    showSearch, selectedImageFile, pastedImages
  ]);

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      let foundImage = false;
      const newImages: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            newImages.push(file);
            foundImage = true;
          }
        }
      }
      if (foundImage) {
        setPastedImages(prev => [...prev, ...newImages]);
      }
    };
    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, []);

  useEffect(() => {
    let backListener: any = null;
    let isActive = true;

    const setupBackButton = async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;

      try {
        const { StatusBar } = await import('@capacitor/status-bar');
        await StatusBar.setOverlaysWebView({ overlay: true });
      } catch (e) {
        console.log('StatusBar plugin not available', e);
      }

      const { App: CapacitorApp } = await import('@capacitor/app');

      if (!isActive) return;

      backListener = await CapacitorApp.addListener('backButton', () => {
        const lightboxCloseBtn = document.getElementById('img-lightbox-close');
        if (lightboxCloseBtn) {
          lightboxCloseBtn.click();
          return;
        }

        const s = stateRef.current;

        if (s.hasSelectedImageFile) {
          setSelectedImageFile(null);
        } else if (s.hasPastedImages) {
          setPastedImages([]);
        } else if (s.selectionMode) {
          setSelectionMode(false);
          setSelectedMessages(new Set());
        } else if (s.showCamera) {
          setShowCamera(false);
        } else if (s.showMenu) {
          setShowMenu(false);
        } else if (s.showPartnerModal) {
          setShowPartnerModal(false);
        } else if (s.showBulkDeleteModal) {
          setShowBulkDeleteModal(false);
        } else if (s.showUnpinConfirm) {
          setShowUnpinConfirm(false);
        } else if (s.showClearConfirm) {
          setShowClearConfirm(false);
        } else if (s.showSearch) {
          setShowSearch(false);
        } else if (s.replyingTo) {
          setReplyingTo(null);
        } else if (s.confirmAction) {
          setConfirmAction(null);
        } else if (s.isKeyboardOpen) {
          if (document.activeElement && (document.activeElement as HTMLElement).blur) {
            (document.activeElement as HTMLElement).blur();
          }
        } else {
          // exit app
          CapacitorApp.exitApp();
        }
      });
    };

    setupBackButton();

    return () => {
      isActive = false;
      if (backListener) {
        backListener.remove();
      }
    };
  }, []);



  useEffect(() => {
    const handleOffline = () => {
      setIsClientOffline(true);
      setHideOfflineBanner(false);
    };
    const handleOnline = () => setIsClientOffline(false);

    setIsClientOffline(typeof navigator !== 'undefined' && !navigator.onLine);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

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
      setViewportHeight(window.visualViewport!.height);
    };

    setViewportHeight(window.visualViewport.height);
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

  // Presence is now managed globally by LockManager

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

        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          // Pre-request Camera & Microphone permissions for smooth UX
          try {
            const { Camera } = await import('@capacitor/camera');
            const camPerm = await Camera.checkPermissions();
            if (camPerm.camera !== 'granted') await Camera.requestPermissions();
          } catch (e) { }

          try {
            const { VoiceRecorder } = await import('capacitor-voice-recorder');
            const micPerm = await VoiceRecorder.hasAudioRecordingPermission();
            if (!micPerm.value) await VoiceRecorder.requestAudioRecordingPermission();
          } catch (e) { }

          const { PushNotifications } = await import('@capacitor/push-notifications');
          
          try {
            await PushNotifications.createChannel({
              id: 'default',
              name: 'Default',
              description: 'General Notifications',
              importance: 5,
              visibility: 1
            });
          } catch (e) {
            console.warn('Could not create push channel', e);
          }

          let permStatus = await PushNotifications.checkPermissions();
          if (permStatus.receive !== 'granted') {
            permStatus = await PushNotifications.requestPermissions();
          }
          if (permStatus.receive === 'granted') {
            await PushNotifications.register();
            PushNotifications.addListener('registration', async (token) => {
              localStorage.setItem('fcmToken', token.value);
              await setDoc(doc(db, "users", user.uid, "private", "tokens"), {
                fcmTokens: arrayUnion(token.value)
              }, { merge: true });
            });
          }
        } else {
          const permission = 'Notification' in window ? Notification.permission : 'denied';
          if (permission === 'granted') {
            const messaging = await getFirebaseMessaging();
            if (messaging) {
              const registration = await navigator.serviceWorker.register('/sw.js');
              const token = await getToken(messaging, {
                vapidKey: "BDTGvzgVoIH_GlY0C5y5fHQ5UnQ_OggcwGAST3Vbu07-i-Y-F0pLiUIAhj_c0EnP2Z61xdGhTu3pjEIZBWVqz3c",
                serviceWorkerRegistration: registration
              });
              if (token) {
                localStorage.setItem('fcmToken', token);
                await setDoc(doc(db, "users", user.uid, "private", "tokens"), {
                  fcmTokens: arrayUnion(token)
                }, { merge: true });
              }
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

    // Î“Ã¶Ã‡Î“Ã¶Ã‡ STEP 1: Paint cached messages INSTANTLY (zero Firestore reads) Î“Ã¶Ã‡Î“Ã¶Ã‡
    if (!initialLoadDone.current) {
      const cached = secureCache.get(cacheKey, user.uid);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setMessages(cached);
        setLoadedCount(cached.length); // Render all cached messages instantly
        setIsLoadingMessages(false);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    }

    // Î“Ã¶Ã‡Î“Ã¶Ã‡ STEP 2: Live Firestore subscription (only last 10 messages) Î“Ã¶Ã‡Î“Ã¶Ã‡
    const q = query(
      collection(db, `conversations/${chatId}/messages`),
      orderBy('createdAt', 'desc'),
      firestoreLimit(20)
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

        if (data.senderId !== user.uid && !data.delivered) {
          // Mark as delivered since it reached the device
          batch.update(doc(db, 'conversations', chatId, 'messages', msgDoc.id), { delivered: true, deliveredAt: serverTimestamp() });
          hasUnseen = true;
        }
      });

      if (hasUnseen) batch.commit().catch(e => console.error('Failed to mark seen/delivered', e));

      const liveMessages = fetchedMessages.reverse();

      // Î“Ã¶Ã‡Î“Ã¶Ã‡ STEP 3: Merge live data with cached older messages Î“Ã¶Ã‡Î“Ã¶Ã‡
      setMessages(prev => {
        const mergedMap = new Map<string, Message>();
        // Put cached older messages in first
        prev.forEach(m => mergedMap.set(m.id, m));
        // Overwrite/add live messages (handles edits, deletes, reactions)
        liveMessages.forEach(m => mergedMap.set(m.id, m));

        const merged = Array.from(mergedMap.values()).sort((a, b) => {
          const tA = (a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : (typeof a.createdAt === 'number' ? a.createdAt : Date.now());
          const tB = (b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : (typeof b.createdAt === 'number' ? b.createdAt : Date.now());
          return tA - tB;
        });

        // Î“Ã¶Ã‡Î“Ã¶Ã‡ STEP 4: Persist merged list to cache (serialise Timestamps Î“Ã¥Ã† ms) Î“Ã¶Ã‡Î“Ã¶Ã‡
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
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
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
      // Instantly hide messages locally
      const now = Date.now();
      setClearedAt(now);
      localStorage.setItem(`clearedAt_${user.uid}_${chatId}`, now.toString());
      setShowMenu(false);
      setShowClearConfirm(false);
      localStorage.removeItem(`sq_c_${chatId}_${user.uid}`);
      localStorage.removeItem(`chat_${chatId}`);

      // Clear from memory so they don't get re-cached!
      setMessages(prev => prev.filter(m => {
        let time = 0;
        if (m.createdAt?.toMillis) {
          time = m.createdAt.toMillis();
        } else if (m.createdAt?.seconds) {
          time = m.createdAt.seconds * 1000;
        } else if (m.createdAt) {
          time = new Date(m.createdAt as any).getTime();
        }
        return time > now;
      }));

    } catch (err) {
      console.error('Failed to clear chat', err);
    }
  };


  const loadMore = async () => {
    if (isFetchingMore || messages.length === 0 || !hasMoreMessages) return;

    // If we have more messages in memory than we are currently showing, just show more of them
    if (loadedCount < messages.length) {
      if (scrollContainerRef.current) {
        prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
        prevScrollTopRef.current = scrollContainerRef.current.scrollTop;
        shouldScrollToTopAfterLoad.current = true;
      }
      setLoadedCount(prev => Math.min(messages.length, prev + 20));
      return;
    }

    setIsFetchingMore(true);
    try {
      if (scrollContainerRef.current) {
        prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
        prevScrollTopRef.current = scrollContainerRef.current.scrollTop;
        shouldScrollToTopAfterLoad.current = true;
      }

      const oldestMsg = messages[0];

      let q = query(
        collection(db, `conversations/${chatId}/messages`),
        orderBy('createdAt', 'desc'),
        firestoreLimit(20)
      );

      const oldestDocSnap = await getDoc(doc(db, `conversations/${chatId}/messages`, oldestMsg.id));

      if (oldestDocSnap.exists()) {
        q = query(q, startAfter(oldestDocSnap));
      } else {
        const tsMillis = oldestMsg.createdAt?.seconds
          ? oldestMsg.createdAt.seconds * 1000
          : (typeof oldestMsg.createdAt === 'number' ? oldestMsg.createdAt : Date.now());
        q = query(q, startAfter(Timestamp.fromMillis(tsMillis)));
      }

      const snapshot = await getDocs(q);
      const fetched: Message[] = [];
      snapshot.forEach(docSnap => {
        fetched.push({ id: docSnap.id, ...docSnap.data() } as Message);
      });

      console.log(`[loadMore] Fetched ${fetched.length} older messages from Firestore`);

      if (fetched.length < 20) {
        setHasMoreMessages(false);
      }

      if (fetched.length > 0) {
        const newOlder = fetched.reverse();

        // Adjust clearedAt if needed so the fetched messages become visible
        const oldestFetchedMsg = newOlder[0];
        if (oldestFetchedMsg && clearedAt > 0) {
          const oldestMillis = oldestFetchedMsg.createdAt?.seconds
            ? oldestFetchedMsg.createdAt.seconds * 1000
            : (typeof oldestFetchedMsg.createdAt === 'number' ? oldestFetchedMsg.createdAt : 0);

          if (oldestMillis > 0 && oldestMillis <= clearedAt) {
            setClearedAt(oldestMillis - 1);
            localStorage.setItem(`clearedAt_${user.uid}_${chatId}`, (oldestMillis - 1).toString());
          }
        }

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

  const handleCameraClick = async () => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
        const image = await Camera.getPhoto({
          quality: 80, // Optimized for faster upload
          allowEditing: false,
          resultType: CameraResultType.Base64,
          source: CameraSource.Camera,
          saveToGallery: false,
          correctOrientation: true
        });
        if (image.base64String) {
          const res = await fetch(`data:image/${image.format || 'jpeg'};base64,${image.base64String}`);
          const blob = await res.blob();
          const file = new File([blob], `capture-${Date.now()}.${image.format || 'jpg'}`, { type: `image/${image.format || 'jpeg'}` });
          setSelectedImageFile(file);
        }
      } else {
        setShowCamera(true);
      }
    } catch (e) {
      console.log('Camera error or cancelled', e);
    }
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
          maxSizeMB: 0.4,
          maxWidthOrHeight: 1200,
          useWebWorker: false,
          initialQuality: 0.70
        };
        compressedFile = await imageCompression(fileToCompress, options);
      } catch (e) {
        console.warn('Compression failed, using original file', e);
        compressedFile = file;
      }

      const idToken = await user.getIdToken();
      const sigRes = await fetch(getApiUrl('/api/upload-signature'), {
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
          newMessageData.replyToText = getReplyText(replyingTo);
          newMessageData.replyToSenderId = replyingTo.senderId;
        }

        const msgRef = await addDoc(collection(db, `conversations/${chatId}/messages`), newMessageData);

        // Trigger notification to the other user if they are not online
        if (otherUserStatus?.state !== 'online') {
          try {
            const idToken = await user.getIdToken();
            fetch(getApiUrl('/api/notify'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
              },
              body: JSON.stringify({ 
                receiverUid: otherUid, 
                chatId, 
                messageId: msgRef.id,
                senderToken: localStorage.getItem('fcmToken')
              })
            });
          } catch (e) {
            console.error('Failed to trigger notification', e);
          }
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

  useEffect(() => {
    const updateWallpaperSettings = async () => {
      const s = await getWallpaperSettings();
      setWallpaperSettings(s);
    };
    updateWallpaperSettings();
    window.addEventListener('squirrel-wallpaper-changed', updateWallpaperSettings);
    return () => window.removeEventListener('squirrel-wallpaper-changed', updateWallpaperSettings);
  }, []);

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

  const handleSendAudio = async (file: File | string) => {
    if (isSending) return;
    setIsSending(true);

    const newMsgRef = doc(collection(db, `conversations/${chatId}/messages`));
    const optimisticId = newMsgRef.id;
    let uploadableFile: any = file;
    let blobUrl = '';

    if (typeof file === 'string' && file.startsWith('data:')) {
      const arr = file.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'audio/aac';
      const bstr = atob(arr[1].replace(/\s/g, ''));
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const extension = mime.includes('webm') ? 'webm' : mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : 'aac';
      uploadableFile = new File([u8arr], `voice_note_${Date.now()}.${extension}`, { type: mime });
      blobUrl = URL.createObjectURL(uploadableFile);
    } else if (file instanceof File) {
      blobUrl = URL.createObjectURL(file);
    }

    const optimisticMsg: Message = {
      id: optimisticId,
      senderId: user.uid,
      text: '',
      audioUrl: blobUrl,
      createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any,
      seen: false,
      delivered: false,
      isDeletedForEveryone: false,
      isEdited: false,
      ...(replyingTo ? {
        replyToId: replyingTo.id,
        replyToText: getReplyText(replyingTo),
        replyToSenderId: replyingTo.senderId
      } : {})
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setReplyingTo(null);
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });

    try {
      const idToken = await user.getIdToken();
      const audioCount = messages.filter(m => m.senderId === user.uid && m.audioUrl).length + 1;
      const senderName = user.email ? user.email.split('@')[0] : 'user';
      const publicId = `${senderName}_${audioCount.toString().padStart(2, '0')}`;

      const sigRes = await fetch(getApiUrl('/api/upload-signature'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ folder: 'squirrel/voice_notes', public_id: publicId })
      });
      if (!sigRes.ok) throw new Error('Failed to get upload signature');
      const { timestamp, signature, folder, public_id: resolvedPublicId } = await sigRes.json();

      // `uploadableFile` is already prepared above!
      const formData = new FormData();
      formData.append('file', uploadableFile);
      formData.append('api_key', '296432316579334');
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
      if (data.error) throw new Error(data.error.message);

      if (data.secure_url) {
        const mp3Url = data.secure_url.replace(/\.[^/.]+$/, ".mp3");
        const newMessageData: any = {
          senderId: user.uid,
          audioUrl: mp3Url,
          createdAt: serverTimestamp(),
          seen: false,
          delivered: false,
          isDeletedForEveryone: false,
          isEdited: false
        };

        if (optimisticMsg.replyToId) {
          newMessageData.replyToId = optimisticMsg.replyToId;
          newMessageData.replyToText = optimisticMsg.replyToText;
          newMessageData.replyToSenderId = optimisticMsg.replyToSenderId;
        }

        setDoc(newMsgRef, newMessageData).catch(err => {
          console.error('Failed to send audio message', err);
          setMessages(prev => prev.filter(m => m.id !== optimisticId));
        });

        if (otherUserStatus?.state !== 'online') {
          try {
            fetch(getApiUrl('/api/notify'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
              },
              body: JSON.stringify({ 
                receiverUid: otherUid, 
                chatId, 
                messageId: optimisticId,
                senderToken: localStorage.getItem('fcmToken')
              })
            });
          } catch (e) { }
        }
      }
    } catch (error) {
      console.error("Failed to send audio", error);
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async (e?: FormEvent, textToUse: string = '') => {
    if (e) e.preventDefault();
    if ((!textToUse.trim() && pastedImages.length === 0) || textToUse.length > 2000 || isSending) return;

    const messageText = textToUse.trim();

    updateTypingStatus(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    try {
      if (pastedImages.length > 0) {
        setIsSending(true);

        const imagesToUpload = [...pastedImages];
        setPastedImages([]);

        // Optimistic UI for uploading
        const objectUrls = imagesToUpload.map(file => URL.createObjectURL(file));
        setUploadingImages({ urls: objectUrls, text: messageText });

        const controller = new AbortController();
        setUploadController(controller);

        try {
          const idToken = await user.getIdToken();
          const uploadPromises = imagesToUpload.map(async (file) => {
            let compressedFile = file;
            try {
              const fileToCompress = (!file.type || !file.type.startsWith('image/'))
                ? new File([file], file.name || 'image.jpeg', { type: file.type || 'image/jpeg' })
                : file;
              const options = {
                maxSizeMB: 0.4,
                maxWidthOrHeight: 1200,
                useWebWorker: false,
                initialQuality: 0.70
              };
              compressedFile = await imageCompression(fileToCompress, options);
            } catch (e) {
              console.warn('Compression failed, using original file', e);
              compressedFile = file;
            }

            const sigRes = await fetch(getApiUrl('/api/upload-signature'), {
              method: 'POST',
              signal: controller.signal,
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
            formData.append('api_key', '296432316579334');
            formData.append('timestamp', timestamp.toString());
            formData.append('upload_preset', 'Squirrel');
            formData.append('signature', signature);

            const res = await fetch(`https://api.cloudinary.com/v1_1/wusvh42x/image/upload`, {
              method: 'POST',
              signal: controller.signal,
              body: formData
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error.message);
            return data.secure_url as string;
          });

          const urls = await Promise.all(uploadPromises);
          const validUrls = urls.filter(Boolean);

          if (validUrls.length > 0) {
            const newMessageData: any = {
              senderId: user.uid,
              text: messageText,
              createdAt: serverTimestamp(),
              seen: false,
              delivered: false
            };
            if (validUrls.length === 1) newMessageData.imageUrl = validUrls[0];
            if (validUrls.length > 1) newMessageData.imageUrls = validUrls;

            if (replyingTo) {
              newMessageData.replyToId = replyingTo.id;
              newMessageData.replyToText = getReplyText(replyingTo);
              newMessageData.replyToSenderId = replyingTo.senderId;
            }

            const msgRef = await addDoc(collection(db, `conversations/${chatId}/messages`), newMessageData);

            if (otherUserStatus?.state !== 'online') {
              try {
                fetch(getApiUrl('/api/notify'), {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                  },
                  body: JSON.stringify({ 
                    receiverUid: otherUid, 
                    chatId, 
                    messageId: msgRef.id,
                    senderToken: localStorage.getItem('fcmToken')
                  })
                });
              } catch (e) { }
            }
          }
        } catch (e: any) {
          if (e.name === 'AbortError') {
            console.log('Upload cancelled');
          } else {
            console.error('Upload failed', e);
          }
        } finally {
          // Cleanup optimistic UI
          objectUrls.forEach(url => URL.revokeObjectURL(url));
          setUploadingImages(null);
          setUploadController(null);
        }
      } else {
        const newMessageData: any = {
          text: messageText,
          senderId: user.uid,
          createdAt: serverTimestamp(),
          seen: false,
          delivered: false
        };

        if (replyingTo) {
          newMessageData.replyToId = replyingTo.id;
          newMessageData.replyToText = getReplyText(replyingTo);
          newMessageData.replyToSenderId = replyingTo.senderId;
        }

        // Pre-generate Firestore ID to prevent duplicates in snapshot
        const newMsgRef = doc(collection(db, `conversations/${chatId}/messages`));
        const optimisticId = newMsgRef.id;

        const optimisticMsg: Message = {
          id: optimisticId,
          text: messageText,
          senderId: user.uid,
          createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any,
          seen: false,
          delivered: false,
          ...(replyingTo ? {
            replyToId: replyingTo.id,
            replyToText: getReplyText(replyingTo),
            replyToSenderId: replyingTo.senderId
          } : {})
        };
        setMessages(prev => [...prev, optimisticMsg]);

        // Scroll immediately
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        });

        // Fire and forget - don't await
        setDoc(newMsgRef, newMessageData).catch(err => {
          console.error('Failed to send message', err);
          // Remove optimistic message on error
          setMessages(prev => prev.filter(m => m.id !== optimisticId));
          if (chatInputRef.current) chatInputRef.current.setText(messageText);
        });

        // Trigger notification to the other user if they are not online
        if (otherUserStatus?.state !== 'online') {
          try {
            const idToken = await user.getIdToken();
            fetch(getApiUrl('/api/notify'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
              },
              body: JSON.stringify({ 
                receiverUid: otherUid, 
                chatId, 
                messageId: newMsgRef.id,
                senderToken: localStorage.getItem('fcmToken')
              })
            });
          } catch (e) { }
        }
      }

      setReplyingTo(null);
      // Play sound for sent message (commented out until send.mp3 is added)
      /*
      try {
        const audio = new Audio('/send.mp3');
        audio.volume = 0.5;
        audio.play().catch(e => console.log('Audio play failed', e));
      } catch (e) {
        console.log('Audio init failed', e);
      }
      */
    } catch (error) {
      console.error("Failed to send message", error);
      if (chatInputRef.current) chatInputRef.current.setText(textToUse.trim());
    } finally {
      if (pastedImages.length > 0) {
        setIsSending(false);
      }
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

  useEffect(() => {
    if (unreadDividerMsgId === null && !isLoadingMessages) {
      if (visibleMessages.length > 0) {
        const firstUnreadIndex = visibleMessages.findIndex(m => !m.seen && m.senderId !== user?.uid);
        if (firstUnreadIndex !== -1) {
          setUnreadDividerMsgId(visibleMessages[firstUnreadIndex].id);
          let count = 0;
          for (let i = firstUnreadIndex; i < visibleMessages.length; i++) {
            if (!visibleMessages[i].seen && visibleMessages[i].senderId !== user?.uid) {
              count++;
            }
          }
          setUnreadDividerCount(count);
        } else {
          setUnreadDividerMsgId('none');
        }
      } else {
        setUnreadDividerMsgId('none');
      }
    }
  }, [visibleMessages, user?.uid, unreadDividerMsgId, isLoadingMessages]);

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


  const renderedMessages = useMemo(() => {
    const displayMessages = visibleMessages.slice(-loadedCount);
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
              <div className="bg-white/80  text-slate-600 font-medium text-[11px] px-3 py-1 rounded-full shadow-sm border border-black/5 tracking-wide">
                {formatDateSeparator(msg.createdAt)}
              </div>
            </div>
          )}
          {msg.id === unreadDividerMsgId && (
            <div className="flex justify-center mb-3 mt-1 z-10 relative pointer-events-none w-full animate-pop-in">
              <div className="bg-white/90 text-emerald-500 font-bold text-[11px] px-3 py-1.5 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] tracking-wide flex items-center gap-1.5 border border-black/5">
                <span className="w-4 h-4 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px] leading-none">{unreadDividerCount}</span>
                UNREAD MESSAGE{unreadDividerCount > 1 ? 'S' : ''}
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
  }, [visibleMessages, loadedCount, user, chatId, searchQuery, searchResults, currentSearchIndex, privacyMode, revealedMessages, activeReactionMessageId, selectionMode, selectedMessages, expandedMessageId, pinnedMessage, otherEmail, formatDateSeparator, handlePinToggle, unreadDividerMsgId, unreadDividerCount]);

  return (
    <div 
      className="chat-bg flex flex-col h-[100dvh] text-black relative overflow-hidden"
      style={viewportHeight ? { height: `${viewportHeight}px` } : {}}
    >
      <img
        src="/wallpapers/wp15.jpg"
        alt="Chat Wallpaper"
        className="fixed top-0 left-0 w-[100vw] h-[100vh] object-cover object-top z-0 pointer-events-none"
        style={{
          opacity: wallpaperSettings.opacity / 100,
          filter: `blur(${wallpaperSettings.blur}px)`
        }}
      />
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
        <div className="fixed top-[75px] left-1/2 -translate-x-1/2 bg-red-500/80  text-white text-[12px] font-medium py-1.5 px-3.5 rounded-full shadow-md border border-red-400/20 flex items-center justify-center space-x-2 z-[9999] animate-pop-in">
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
      {/* Attached Top Section */}
      <div className="relative top-0 left-0 right-0 z-40 flex flex-col w-full items-center shrink-0">
        {/* Header */}
        <div className={`flex flex-col px-4 py-3 bg-[#fcfcfc]/95 backdrop-blur-md shadow-[0_2px_10px_rgba(0,0,0,0.05)] border-b border-slate-200 shrink-0 relative w-full pt-[max(env(safe-area-inset-top),0.75rem)] transition-all duration-300 ease-in-out z-40`}>
          <div className="flex items-center justify-between w-full relative z-10">
            {selectionMode ? (
              <div className="flex items-center justify-between w-full h-10">
                <div className="flex items-center">
                  <button onClick={() => { setSelectionMode(false); setSelectedMessages(new Set()); }} className="w-10 h-10 mr-2 border border-slate-200 bg-white rounded-full hover:bg-slate-50 text-slate-700 transition-colors flex items-center justify-center shadow-sm">
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
                  }} className="w-10 h-10 border border-slate-200 bg-white rounded-full hover:bg-slate-50 text-slate-700 transition-colors flex items-center justify-center shadow-sm" title="Select All">
                    <CheckSquare size={20} />
                  </button>
                  <button onClick={handleCopySelected} className="w-10 h-10 border border-slate-200 bg-white rounded-full hover:bg-slate-50 text-slate-700 transition-colors flex items-center justify-center shadow-sm">
                    <Copy size={20} />
                  </button>
                  <button onClick={handleDeleteSelected} className="w-10 h-10 border border-red-200 bg-red-50 hover:bg-red-100 text-red-500 rounded-full transition-colors flex items-center justify-center shadow-sm">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center relative">
                  <button
                    id="menu-toggle-btn"
                    onClick={() => setShowMenu(!showMenu)}
                    className={`relative w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 ease-out active:scale-95 border ${showMenu ? 'border-slate-800 bg-slate-800 text-white shadow-inner' : 'border-slate-200/80 bg-white text-slate-600 hover:text-slate-900 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.12)] hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.15)]'}`}
                  >
                    <ChevronDown className={`transition-transform duration-300 ease-out ${showMenu ? '-rotate-180 text-white' : 'text-slate-500'}`} size={22} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Right Side: Profile & SignOut */}
                <div className="flex items-center justify-end flex-1 min-w-0 ml-3 space-x-3">
                  <div className="flex flex-col items-end overflow-hidden justify-center">
                    <h1 className="text-[15px] font-bold text-slate-900 truncate w-full text-right tracking-tight leading-none">
                      {typeof window !== 'undefined' && localStorage.getItem('squirrel_partnerNickname') ? localStorage.getItem('squirrel_partnerNickname') : (otherUserName || 'Partner')}
                    </h1>
                    <StatusIndicator
                      state={otherUserStatus?.state}
                      timestamp={otherUserStatus?.last_changed || null}
                      isTyping={isOtherTyping}
                    />
                  </div>
                  <button
                    onClick={signOut}
                    className="w-10 h-10 text-red-50 bg-gradient-to-br from-red-600 to-rose-700 border border-red-800 hover:from-red-700 hover:to-rose-800 rounded-xl transition-all shadow-[0_2px_8px_rgba(225,29,72,0.3)] shrink-0 active:scale-95 flex items-center justify-center relative overflow-hidden group"
                    aria-label="Sign Out"
                  >
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="relative z-10 drop-shadow-sm group-hover:rotate-12 transition-transform">
                      <path d="M12 2v10" />
                      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Expanded Menu Options Floating Below Navbar */}
        <div className={`absolute top-full left-0 right-0 w-full flex flex-col items-center transition-all duration-300 origin-top z-30 pt-3 will-change-transform ${showMenu ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
          <div className="flex flex-row items-center justify-center gap-3 px-4 py-1.5 bg-white border border-orange-500/50 shadow-[0_2px_12px_rgba(0,0,0,0.08)] rounded-full">

            <button onClick={() => router.push('/settings')} title="Settings"
              className="w-10 h-10 rounded-full border border-orange-400/40 hover:border-orange-500/70 bg-[#ffe6a7] flex items-center justify-center text-blue-600 hover:bg-[#ffe6a7]/80 hover:text-blue-700 transition-all active:scale-95 group">
              <Settings size={22} className="group-hover:rotate-45 transition-transform" />
            </button>

            {(user.email === 'officialhaadi81@gmail.com') && (
              <button onClick={() => {
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
              }} title="Copy all messages"
                className="w-10 h-10 rounded-full border border-orange-400/40 hover:border-orange-500/70 bg-[#ffe6a7] flex items-center justify-center text-blue-600 hover:bg-[#ffe6a7]/80 hover:text-blue-700 transition-all active:scale-95 group">
                <Copy size={22} className="group-hover:scale-110 transition-transform" />
              </button>
            )}

            <button onClick={() => {
              setShowSearch(!showSearch);
              if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 100);
              else setSearchQuery('');
              setShowMenu(false);
            }} title={showSearch ? 'Close Search' : 'Search Messages'}
              className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all active:scale-95 group ${showSearch ? 'border-orange-500/70 bg-[#ffe6a7]/90 text-blue-700 shadow-md' : 'border-orange-400/40 hover:border-orange-500/70 bg-[#ffe6a7] text-blue-600 hover:bg-[#ffe6a7]/80 hover:text-blue-700'}`}>
              {showSearch ? <X size={22} /> : <Search size={22} className="group-hover:scale-110 transition-transform" />}
            </button>

            <button onClick={(e) => {
              const now = Date.now();
              const DOUBLE_PRESS_DELAY = 300;
              if (privacyTapTimeout.current) { clearTimeout(privacyTapTimeout.current); privacyTapTimeout.current = null; }
              if (now - lastTapRef.current < DOUBLE_PRESS_DELAY) {
                setConfirmAction({
                  title: 'Enable Pure Privacy?',
                  description: 'Are you sure you want to toggle pure privacy mode?',
                  confirmText: 'Toggle',
                  onConfirm: () => { setPrivacyMode(privacyMode === 'pure' ? 'none' : 'pure'); setRevealedMessages([]); setShowMenu(false); setConfirmAction(null); }
                });
              } else {
                privacyTapTimeout.current = setTimeout(() => {
                  setConfirmAction({
                    title: 'Enable Blur Privacy?',
                    description: 'Are you sure you want to toggle blur privacy mode?',
                    confirmText: 'Toggle',
                    onConfirm: () => { setPrivacyMode(privacyMode === 'blur' ? 'none' : 'blur'); setRevealedMessages([]); setShowMenu(false); setConfirmAction(null); }
                  });
                }, DOUBLE_PRESS_DELAY);
              }
              lastTapRef.current = now;
            }} title="Privacy (Tap: Blur, Double: Pure)"
              className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all active:scale-95 group ${privacyMode !== 'none' ? 'border-orange-500/70 bg-[#ffe6a7]/90 text-blue-700 shadow-md' : 'border-orange-400/40 hover:border-orange-500/70 bg-[#ffe6a7] text-blue-600 hover:bg-[#ffe6a7]/80 hover:text-blue-700'}`}>
              <Ghost size={22} className={`${privacyMode === 'none' ? 'group-hover:-translate-y-1' : ''} transition-transform`} />
            </button>

            <button onClick={() => {
              setConfirmAction({
                title: 'Clear Chat?',
                description: 'Are you sure you want to clear all messages? This action cannot be undone.',
                confirmText: 'Clear',
                isDestructive: true,
                onConfirm: () => { handleClearChat(); setConfirmAction(null); }
              });
            }} title="Clear Chat"
              className="w-10 h-10 rounded-full border border-orange-400/40 hover:border-orange-500/70 bg-[#ffe6a7] flex items-center justify-center text-red-500 hover:bg-[#ffe6a7]/80 hover:text-red-600 transition-all active:scale-95 group">
              <Trash2 size={22} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>

          {/* Status Field */}
          <div className="mt-2 mb-1 w-full px-4 flex justify-center">
            <div className="inline-flex bg-white border border-orange-500/50 rounded-full py-1.5 px-5 shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
              <p className="text-[12.5px] text-slate-700 text-center font-medium leading-snug italic text-wrap break-words drop-shadow-sm">
                "{otherUserAbout || "Hey there! I am using Squirrel."}"
              </p>
            </div>
          </div>
        </div>

        {/* Pinned Message */}
        {pinnedMessage && !isKeyboardOpen && (
          <div
            ref={pinBannerRef}
            className="mx-2 max-w-5xl mx-auto w-[calc(100%-1rem)] bg-white/80 backdrop-blur-md rounded-[20px] shadow-sm border border-white/60 px-4 py-2 mt-2 mb-1 flex items-center justify-between shrink-0 relative z-20 cursor-pointer hover:bg-white transition-transform select-none"
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
            className="shrink-0 relative w-11 h-11 rounded-full bg-white/40   shadow-[0_4px_12px_rgba(0,0,0,0.1)] flex items-center justify-center text-slate-700 hover:bg-white/60 hover:scale-105 active:scale-95 transition-all overflow-hidden"
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
        style={{ overflowAnchor: 'none' }}
        onScroll={(e) => {
          setActiveReactionMessageId(null);
          const target = e.target as HTMLDivElement;
          const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 150;
          setShowScrollBottom(!isNearBottom);
        }}
        className={`flex-1 overflow-y-auto px-2 sm:px-4 py-4 flex flex-col relative w-full max-w-4xl mx-auto transition-all duration-500 ${privacyMode === 'pure' ? 'opacity-30 saturate-0 brightness-75' : 'opacity-100 saturate-100 brightness-100'}`}
      >
        {/* Removed h-[120px] spacer because navbar is now relative */}
        {messages.length >= 10 && hasMoreMessages && (
          <div className="flex justify-center w-full mt-4 mb-8 shrink-0 relative z-[50]">
            <div
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Force blur any active input to prevent iOS focus shift bugs
                if (document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
                if (!isFetchingMore) loadMore();
              }}
              className={`px-5 py-2 flex items-center gap-2 rounded-full bg-gradient-to-b from-slate-700 to-slate-800 border-t border-slate-600 border-x border-slate-700 border-b border-slate-900 text-white text-[13px] font-medium shadow-[0_4px_6px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] active:scale-95 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] transition-all duration-100 ease-out select-none cursor-pointer ${isFetchingMore ? 'opacity-50 cursor-default' : ''}`}
            >
              {isFetchingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                  <span className="text-slate-200">Loading...</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-4 h-4 text-slate-300" />
                  <span className="text-slate-100">Load earlier messages</span>
                </>
              )}
            </div>
          </div>
        )}
        <div className="flex-1 shrink-0 min-h-0" />

        {/* Memoized rendered messages */}

        {isLoadingMessages ? (
          <div className="absolute inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-pulse-slow">
            <div className="w-[60vw] max-w-[200px] h-[2px] bg-slate-900 rounded-full overflow-hidden relative shadow-[0_0_10px_rgba(255,255,255,0.05)]">
              <div className="absolute top-0 left-0 h-full w-[40%] bg-gradient-to-r from-transparent via-white to-transparent rounded-full animate-shimmer" style={{ animationDuration: '1.2s' }} />
            </div>
          </div>
        ) : renderedMessages}

        {/* Optimistic Uploading Images UI */}
        {uploadingImages && (
          <div className="flex w-full justify-end mb-2.5 animate-message-sent">
            <div className="max-w-[85%] sm:max-w-[70%] rounded-[22px] px-2.5 pt-1.5 pb-1 shadow-sm border bg-[#d9fdd3] text-[#111b21] rounded-tr-[4px] border-[#c8eed4] opacity-70">
              <div className="flex flex-col relative select-none">
                <div className={`mb-1.5 ${uploadingImages.urls.length > 1 ? 'grid grid-cols-2 gap-[2px] rounded-xl overflow-hidden bg-black/10' : 'rounded-xl overflow-hidden bg-black/5 relative'}`} style={!(uploadingImages.urls.length > 1) ? { maxWidth: '200px', maxHeight: '240px' } : { width: '100%', maxWidth: '240px' }}>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10 rounded-xl transition-all group">
                    <button
                      onClick={() => {
                        console.log("Cancelling upload");
                        uploadController?.abort();
                      }}
                      className="w-12 h-12 bg-red-500/90 text-white rounded-full flex items-center justify-center hover:bg-red-600 active:scale-95 shadow-lg"
                      title="Cancel Upload"
                    >
                      <X size={24} strokeWidth={2.5} />
                    </button>
                  </div>
                  {uploadingImages.urls.map((url, idx) => (
                    <div key={idx} className={`relative overflow-hidden ${uploadingImages.urls.length > 1 ? 'aspect-square bg-black/20' : 'w-full h-auto'} ${uploadingImages.urls.length === 3 && idx === 2 ? 'col-span-2 aspect-[2/1]' : ''}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="Uploading" className={`w-full h-full object-cover scale-105 ${!(uploadingImages.urls.length > 1) ? 'rounded-xl' : ''}`} />
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
          className={`fixed right-6 sm:right-10 z-[100] p-3 rounded-full cursor-pointer animate-pop-in transition-all duration-300 ease-out bg-white/40   border border-white/60 shadow-[0_4px_12px_rgba(0,0,0,0.08)] text-slate-700 hover:text-blue-600 hover:bg-white/60 hover:scale-105 active:scale-95 ${replyingTo ? 'bottom-[145px]' : 'bottom-[90px]'}`}
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
                  {replyingTo.text || (replyingTo.audioUrl ? 'Voice Message' : 'Photo')}
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
            onCameraClick={handleCameraClick}
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/30  animate-fade-in">
          <div className="bg-[#f2f2f2]/95  rounded-[14px] shadow-2xl w-full max-w-[270px] flex flex-col overflow-hidden animate-pop-in text-center border border-white/20">
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/30  animate-fade-in">
          <div className="bg-[#f2f2f2]/95  rounded-[14px] shadow-2xl w-full max-w-[270px] flex flex-col overflow-hidden animate-pop-in text-center border border-white/20">
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
          <div className="bg-slate-800/95  text-white px-5 py-3 rounded-full shadow-lg border border-slate-700/50 flex items-center space-x-3">
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
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[9999] bg-[#f9f9f9]/90  text-black px-6 py-3 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] text-[15px] font-semibold animate-pop-in border border-black/5 pointer-events-none tracking-tight">
          {toastMessage}
        </div>
      )}

      {/* Confirmation Modal (iOS Style) */}
      {confirmAction && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/30  animate-fade-in">
          <div className="bg-[#f2f2f2]/95  rounded-[14px] shadow-2xl w-full max-w-[270px] flex flex-col overflow-hidden animate-pop-in text-center border border-white/20">
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

