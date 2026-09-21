'use client';
import { getToken } from 'firebase/messaging';
import { getFirebaseMessaging } from '@/lib/firebase';


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
  setDoc } from 'firebase/firestore';
import { ref, onValue, set, onDisconnect, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
import { Message } from '@/types/chat';
import MessageItem from './MessageItem';
import { useAuth } from '@/hooks/useAuth';
import { Smile, Send, Info, X, Image as ImageIcon, Loader2, Ghost, ArrowLeft, Copy, Trash2, ChevronDown, ChevronUp, Search, Pin, Camera, MoreVertical, RotateCcw } from 'lucide-react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import ImageEditor from './ImageEditor';
import CameraCapture from './CameraCapture';
import imageCompression from 'browser-image-compression';

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
      for(let i=0; i<encoded.length; i++) {
        xored += String.fromCharCode(encoded.charCodeAt(i) ^ secret.charCodeAt(i % secret.length));
      }
      localStorage.setItem(key, btoa(xored));
    } catch (e) { console.error('Cache set error'); }
  },
  get: (key: string, secret: string) => {
    try {
      const cached = localStorage.getItem(key);
      if(!cached) return null;
      const xored = atob(cached);
      let decoded = '';
      for(let i=0; i<xored.length; i++) {
        decoded += String.fromCharCode(xored.charCodeAt(i) ^ secret.charCodeAt(i % secret.length));
      }
      return JSON.parse(decodeURIComponent(decoded));
    } catch(e) {
      return null;
    }
  }
};

export default function ChatUI({ user }: ChatUIProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [messageLimit, setMessageLimit] = useState(30);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [pinnedMessage, setPinnedMessage] = useState<{ id: string; text: string; senderId: string } | null>(null);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [showUnpinConfirm, setShowUnpinConfirm] = useState(false);
  const [showPinError, setShowPinError] = useState(false);
  

  const chatId = 'private-chat';
  const otherEmail = user.email === 'sadiyaayoub22019@gmail.com' ? 'officialhaadi81@gmail.com' : 'sadiyaayoub22019@gmail.com';

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  
  const initialLoadDone = useRef(false);
  const newestMsgTimeRef = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const pinSwipeStartRef = useRef<number | null>(null);
  const pinSwipeDraggingRef = useRef<boolean>(false);
  const pinBannerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [bottomReadMessageId, setBottomReadMessageId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);

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
  const [otherUserStatus, setOtherUserStatus] = useState<{state: string, last_changed: number} | null>(null);
  const [otherUid, setOtherUid] = useState<string | null>(null);
  const [isAnonymousMode, setIsAnonymousMode] = useState(false);
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

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const messaging = await getFirebaseMessaging();
          if (messaging) {
            
            const registration = await navigator.serviceWorker.register('/sw.js');
            const token = await getToken(messaging, { 
              vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
              serviceWorkerRegistration: registration 
            });
            if (token) {
              await setDoc(doc(db, 'users', user.uid), { fcmTokens: arrayUnion(token) }, { merge: true });
            }
          }
        }
      } catch (err) {
        console.warn('Push setup failed', err);
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
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        const target = event.target as Element;
        if (target.closest('#emoji-toggle-btn')) return;
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const myTypingRef = ref(rtdb, `typingStatus/${chatId}/${user.uid}`);
    onDisconnect(myTypingRef).set(false);

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

    return () => {
      set(myTypingRef, false);
      unsubscribeTyping();
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

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    adjustTextareaHeight();

    if (newText.length > 0) {
      updateTypingStatus(true);
      // Reset the stop-typing timer
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        updateTypingStatus(false);
      }, 2000); // stop indicator after 2s of silence
    } else {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      updateTypingStatus(false);
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updateTypingStatus(false);
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
          setIsLoadingMessages(false);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
        }
      }

      // ΓöÇΓöÇ STEP 2: Live Firestore subscription (only last 10 messages) ΓöÇΓöÇ
      const q = query(
        collection(db, `conversations/${chatId}/messages`),
        orderBy('createdAt', 'desc'),
        firestoreLimit(messageLimit)
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
            } catch(_) {}
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
    }, [messageLimit, chatId, user?.uid]);

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
    if (confirm('Are you sure you want to clear the entire chat? This will hide all messages for you.')) {
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
    }
  };

  const loadMore = () => {
    if (scrollContainerRef.current) {
      prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
      shouldScrollToTopAfterLoad.current = true;
      setTimeout(() => {
        prevScrollHeightRef.current = 0;
        shouldScrollToTopAfterLoad.current = false;
      }, 1500); // Failsafe reset
    }
    setMessageLimit(prev => prev + 25);
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setText(prev => prev + emojiData.emoji);
    adjustTextareaHeight();
    updateTypingStatus(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(false);
    }, 1000);
  };


  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedImageFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendEditedImage = async (file: File, caption: string) => {
    setSelectedImageFile(null);
    setIsUploadingImage(true);
    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);
      
      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('upload_preset', 'Musify');
      formData.append('cloud_name', 'msg8rv36');
      
      const res = await fetch(`https://api.cloudinary.com/v1_1/msg8rv36/image/upload`, {
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
          fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || text.length > 2000 || isSending) return;

    setIsSending(true);
    const messageText = text.trim();
    setText('');
    setShowEmojiPicker(false);
    
    updateTypingStatus(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
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
          fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ receiverUid: otherUid })
          });
        } catch (e) {
          console.error('Failed to trigger notification', e);
        }
      
      setReplyingTo(null);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      console.error("Failed to send message", error);
      setText(messageText);
      adjustTextareaHeight();
    } finally {
      setIsSending(false);
    }
  };


  const visibleMessages = messages.filter(m => {
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

    return (
    <div className="chat-bg flex flex-col h-[100dvh] text-black relative overflow-hidden">
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
        {/* Background Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <h1 className="text-7xl sm:text-9xl font-black text-slate-900/[0.04] tracking-widest uppercase select-none" style={{ fontFamily: 'var(--font-geist-sans)' }}>
            SQUIRREL
          </h1>
        </div>
        {/* Floating Top Section */}
        <div className="absolute top-0 left-0 right-0 z-40 flex flex-col pointer-events-none w-full">
          {/* Header */}
          <div className="pointer-events-auto flex items-center justify-between px-4 py-2 bg-white/20 backdrop-blur-md backdrop-saturate-150 rounded-[32px] shadow-[inset_0_1px_2px_rgba(255,255,255,0.5),0_8px_32px_rgba(0,0,0,0.12)] border border-white/40 shrink-0 pt-[max(env(safe-area-inset-top),0.5rem)] relative mx-2 mt-2 max-w-5xl sm:mx-auto w-[calc(100%-1rem)] mb-1 will-change-transform transform-gpu">
            {/* Sleek yellow shade line */}
            <div className="absolute bottom-0 left-[10%] right-[10%] h-[1.5px] bg-gradient-to-r from-transparent via-yellow-400/90 to-transparent pointer-events-none rounded-full blur-[0.3px]"></div>
            
            {selectionMode ? (
              <div className="flex items-center justify-between w-full h-10">
                <div className="flex items-center">
                  <button onClick={() => { setSelectionMode(false); setSelectedMessages(new Set()); }} className="p-2 mr-2 bg-white/50 rounded-full hover:bg-white text-slate-700 transition-colors shadow-sm">
                  <X size={20} />
                </button>
                <span className="font-bold text-slate-800 text-lg">{selectedMessages.size} selected</span>
              </div>
              <div className="flex items-center space-x-2">
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
                  onClick={() => setShowMenu(!showMenu)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  <MoreVertical size={20} />
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                    <div className="absolute left-0 top-12 z-50 min-w-[180px] bg-white rounded-xl shadow-xl border border-slate-100 py-1 overflow-hidden animate-pop-in">
                      {user.email === 'officialhaadi81@gmail.com' && (
                        <button 
                          onClick={() => {
                            if (otherUid) {
                              const otherStatusRef = ref(rtdb, `/status/${otherUid}`);
                              set(otherStatusRef, { state: 'offline', last_changed: rtdbServerTimestamp() });
                            }
                            setShowMenu(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center"
                        >
                          <RotateCcw size={16} className="mr-2" />
                          Reset Status
                        </button>
                      )}
                      
                      <button 
                        onClick={() => {
                          setShowSearch(!showSearch);
                          if (!showSearch) {
                            setTimeout(() => searchInputRef.current?.focus(), 100);
                          } else {
                            setSearchQuery('');
                          }
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center"
                      >
                        {showSearch ? <X size={16} className="mr-2" /> : <Search size={16} className="mr-2" />}
                        {showSearch ? 'Close Search' : 'Search Messages'}
                      </button>

                      <button 
                        onClick={() => {
                          setIsAnonymousMode(!isAnonymousMode);
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center"
                      >
                        <Ghost size={16} className="mr-2" />
                        {isAnonymousMode ? 'Disable Privacy' : 'Enable Privacy'}
                      </button>

                      <div className="h-px bg-slate-100 my-1" />
                      
                      <button 
                        onClick={handleClearChat}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium transition-colors flex items-center"
                      >
                        <Trash2 size={16} className="mr-2" />
                        Clear Chat
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Right Side: Profile & SignOut */}
              <div className="flex items-center justify-end flex-1 min-w-0 ml-4 space-x-3">
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
            <div className="bg-[#efeae2] border border-slate-300 shadow-md rounded-2xl p-2 flex items-center space-x-2">
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
        className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 flex flex-col relative scroll-smooth w-full max-w-4xl mx-auto"
      >
        {/* Spacers to prevent content from hiding under the floating header */}
        <div className="shrink-0 h-[60px]" />
        {pinnedMessage && !isKeyboardOpen && <div className="shrink-0 h-[50px]" />}
        
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
        {messages.length >= messageLimit && (
          <div className="flex justify-center mb-6 z-10">
            <button 
              onClick={loadMore}
              className="px-4 py-1.5 bg-white shadow-sm rounded-full text-[13px] font-medium text-slate-600 active:scale-95 transition-all"
            >
              Load earlier messages
            </button>
          </div>
        )}
        <div className="flex-1" />
        
          {isLoadingMessages ? (
            <div className="flex flex-col space-y-4 w-full h-full justify-end pb-4 px-2 mt-auto">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`flex w-full ${i % 2 !== 0 ? 'justify-end' : 'justify-start'}`}>
                  <div className={`skeleton-blue h-[45px] ${i % 2 !== 0 ? 'w-2/3 rounded-2xl rounded-tr-sm' : 'w-1/2 rounded-2xl rounded-tl-sm'}`}></div>
                </div>
              ))}
            </div>
          ) : (() => {
            const displayMessages = searchQuery ? visibleMessages.filter(m => m.text?.toLowerCase().includes(searchQuery.toLowerCase())) : visibleMessages;
            let firstUnrepliedId: string | null = null;
            for (let i = displayMessages.length - 1; i >= 0; i--) {
              if (displayMessages[i].senderId === user.uid) break; 
              firstUnrepliedId = displayMessages[i].id;
            }
  
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
                    isMine={msg.senderId === user.uid} 
                    user={user}
                    chatId={chatId}
                    isFirstUnreplied={msg.id === firstUnrepliedId}
                    onReply={() => setReplyingTo(msg)}
                    isAnonymousMode={isAnonymousMode}
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
                  />
                      </div>
                  </div>
                </React.Fragment>
              );
            });
        })()}
        
        {/* Typing Indicator */}
        {isOtherTyping && (
          <div className="flex w-full justify-start mb-2.5 animate-pop-in">
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center space-x-1">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}
        
        <div className="shrink-0 h-[80px]" />
        <div ref={messagesEndRef} className="h-1 w-full shrink-0" />
      </div>

      {/* Floating Composer */}
      <div className="absolute bottom-[env(safe-area-inset-bottom,0px)] pb-3 pt-2 left-0 right-0 z-40 pointer-events-none flex justify-center px-2 sm:px-4 w-full will-change-transform transform-gpu">
        <div className="w-full max-w-4xl relative pointer-events-auto flex flex-col">
        
        {showEmojiPicker && (
          <div ref={emojiPickerRef} className="absolute bottom-[70px] left-2 sm:left-4 z-30 animate-pop-in">
            <EmojiPicker emojiStyle={"native" as any} 
              onEmojiClick={onEmojiClick} 
              theme={Theme.LIGHT}
              lazyLoadEmojis
              searchDisabled
              skinTonesDisabled
              width={280}
              height={350}
            />
          </div>
        )}

        {replyingTo && (
          <div className="max-w-4xl mx-auto mb-2 flex items-center bg-[#e2e8f0] rounded-lg p-2 shadow-sm border-l-4 border-teal-500 animate-slide-up relative z-10 pointer-events-auto">
            <div className="flex-1 overflow-hidden pr-2">
              <p className="text-[12px] font-semibold text-teal-600 mb-0.5">
                {replyingTo.senderId === user.uid ? 'You' : otherEmail}
              </p>
              <p className="text-[13px] text-slate-600 truncate">
                {replyingTo.text}
              </p>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-1 rounded-full hover:bg-slate-300 text-slate-500 shrink-0"
              type="button"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-end space-x-2 max-w-4xl mx-auto relative z-20 pointer-events-auto w-full">
          <div className="flex-1 flex items-end bg-white border border-slate-200 shadow-sm rounded-[32px] overflow-hidden px-2">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="shrink-0 p-3 text-slate-500 hover:text-slate-700 transition-colors self-end"
            >
              <Smile size={24} strokeWidth={1.5} />
            </button>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              placeholder="Type a message"
              className="flex-1 bg-transparent text-[#111b21] placeholder-[#8696a0] py-[10px] px-2 text-[14.5px] focus:outline-none resize-none leading-snug max-h-[100px] min-h-[40px]"
              rows={1}
              onFocus={() => {
                const isMobile = window.innerWidth < 768 || /Mobi|Android/i.test(navigator.userAgent);
                if (isMobile && scrollContainerRef.current) {
                  const target = scrollContainerRef.current;
                  const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
                  
                  if (scrollBottom <= target.clientHeight + 150) {
                    setTimeout(() => {
                      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }, 300);
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const isMobile = window.innerWidth < 768 || /Mobi|Android/i.test(navigator.userAgent);
                  if (enterToSend && !e.shiftKey && !isMobile) {
                    e.preventDefault();
                    if (text.trim() && !isSending) {
                      handleSend(e as unknown as React.FormEvent);
                    }
                  }
                }
              }}
            />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              id="image-upload"
              onChange={handleImageUpload}
              disabled={isSending}
            />
            <label
              htmlFor="image-upload"
              className={`shrink-0 p-3 transition-colors self-end cursor-pointer ${isSending ? 'text-slate-300 pointer-events-none' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {isSending ? <Loader2 size={24} className="animate-spin" strokeWidth={1.5} /> : <ImageIcon size={24} strokeWidth={1.5} />}
            </label>
          </div>
          
          <button
            type="submit"
            disabled={!text.trim() || isSending}
            className={`group relative shrink-0 w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 ease-out outline-none ${
              !text.trim() && !isSending 
                ? 'bg-slate-100/50 backdrop-blur-sm border border-slate-200/50 text-slate-400 cursor-not-allowed opacity-70' 
                : 'bg-blue-500/80 backdrop-blur-md backdrop-saturate-150 border border-blue-400/50 text-white shadow-[0_4px_16px_rgba(59,130,246,0.25)] hover:bg-blue-500/90 hover:scale-105 active:scale-95'
            }`}
          >
            {isSending ? (
              <Loader2 size={20} className="animate-spin" strokeWidth={2.5} />
            ) : (
              <Send size={20} strokeWidth={2.5} className="ml-0.5 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform duration-300" />
            )}
          </button>
        </form>
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
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-5 text-center">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Delete {selectedMessages.size} message{selectedMessages.size > 1 ? 's' : ''}?</h3>
              <p className="text-sm text-slate-500">This action cannot be undone.</p>
            </div>
            <div className="flex flex-col border-t border-slate-100">
              {(() => {
                const selectedMsgs = messages.filter(m => selectedMessages.has(m.id));
                const canDeleteForEveryone = selectedMsgs.every(m => {
                  if (m.senderId !== user.uid) return false;
                  if (m.isDeletedForEveryone) return false;
                  const msgTime = m.createdAt?.toDate ? m.createdAt.toDate().getTime() : (new Date(m.createdAt as any)).getTime();
                  return (Date.now() - msgTime) < (12 * 60 * 60 * 1000);
                });
                return canDeleteForEveryone ? (
                  <button onClick={() => confirmBulkDelete(true)} className="p-4 text-red-500 font-semibold hover:bg-slate-50 transition-colors border-b border-slate-100">
                    Delete for everyone
                  </button>
                ) : null;
              })()}
              <button onClick={() => confirmBulkDelete(false)} className="p-4 text-red-500 font-semibold hover:bg-slate-50 transition-colors border-b border-slate-100">
                Delete for me
              </button>
              <button onClick={() => setShowBulkDeleteModal(false)} className="p-4 text-slate-600 font-medium hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unpin Confirm Modal */}
      {showUnpinConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-5 text-center">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Unpin this message?</h3>
              <p className="text-sm text-slate-500">The message will no longer be pinned at the top of the chat for everyone.</p>
            </div>
            <div className="flex flex-col border-t border-slate-100">
              <button onClick={confirmUnpin} className="p-4 text-blue-600 font-semibold hover:bg-slate-50 transition-colors border-b border-slate-100">
                Unpin Message
              </button>
              <button onClick={() => setShowUnpinConfirm(false)} className="p-4 text-slate-600 font-medium hover:bg-slate-50 transition-colors">
                Cancel
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
    </div>
  );
}
