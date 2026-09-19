'use client';

import React, { useState, useEffect, useRef, FormEvent } from 'react';
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
} from 'firebase/firestore';
import { ref, onValue, set, onDisconnect, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
import { Message } from '@/types/chat';
import MessageItem from './MessageItem';
import { useAuth } from '@/hooks/useAuth';
import { Smile, Send, Info, X, Image as ImageIcon, Loader2, Ghost, Settings, ArrowLeft, Copy, Trash2 } from 'lucide-react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';

interface ChatUIProps {
  user: User;
}

export default function ChatUI({ user }: ChatUIProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [messageLimit, setMessageLimit] = useState(25);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  

  const chatId = 'private-chat';
  const otherEmail = user.email === 'sadiyaayoub22019@gmail.com' ? 'officialhaadi81@gmail.com' : 'sadiyaayoub22019@gmail.com';

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  
  const [otherUserName, setOtherUserName] = useState<string>('');
  const [otherUserStatus, setOtherUserStatus] = useState<{state: string, last_changed: number} | null>(null);
  const [otherUid, setOtherUid] = useState<string | null>(null);
  const [isAnonymousMode, setIsAnonymousMode] = useState(false);
  const [revealedMessages, setRevealedMessages] = useState<string[]>([]);
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [enterToSend, setEnterToSend] = useState(false);
  const [clearedAt, setClearedAt] = useState<number>(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());

  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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


  // Fetch other user profile and listen to their presence
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
          set(myStatusRef, { state: 'online', last_changed: rtdbServerTimestamp() });
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

  const formatLastSeen = (timestamp: number | null) => {
    if (!timestamp) return 'Offline';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Last seen just now';
    if (date.toDateString() === now.toDateString()) {
      return `Last seen today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `Last seen on ${date.toLocaleDateString()}`;
  };

  const statusText = otherUserStatus?.state === 'online' ? 'Online' : formatLastSeen(otherUserStatus?.last_changed || null);
  
  const getMaskedEmail = (email: string) => {
    if (!email) return '';
    const prefix = email.split('@')[0];
    if (prefix.length <= 4) return email;
    return prefix.substring(0, 2) + '*****' + prefix.substring(prefix.length - 2);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
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
    if (isTypingRef.current !== typing) {
      isTypingRef.current = typing;
      const myTypingRef = ref(rtdb, `typingStatus/${chatId}/${user.uid}`);
      set(myTypingRef, typing).catch(err => console.error("Typing status error", err));
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    adjustTextareaHeight();

    if (newText.length > 0) {
      updateTypingStatus(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        updateTypingStatus(false);
      }, 1000);
    } else {
      updateTypingStatus(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
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
    const q = query(
      collection(db, `conversations/${chatId}/messages`),
      orderBy('createdAt', 'desc'),
      firestoreLimit(messageLimit)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages: Message[] = [];
      const batch = writeBatch(db);
      let hasUnseen = false;

      snapshot.forEach((msgDoc) => {
        const data = msgDoc.data();
        fetchedMessages.push({ id: msgDoc.id, ...data } as Message);
        
        if (data.senderId !== user.uid && !data.seen && document.visibilityState === 'visible') {
          batch.update(doc(db, 'chats', chatId, 'messages', msgDoc.id), { seen: true, seenAt: serverTimestamp() });
          hasUnseen = true;
        }
      });
      
      if (hasUnseen) {
        batch.commit().catch(e => console.error('Failed to mark seen', e));
      }

      const reversed = fetchedMessages.reverse();
      setMessages(reversed);
      
      if (isInitialLoad) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
          setIsInitialLoad(false);
        }, 100);
      } else {
        let shouldScroll = false;
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const newMsg = change.doc.data();
            shouldScroll = true; // Auto scroll on any new message
            if (newMsg.senderId !== user.uid) {
              playNotificationSound();
            }
          }
        });

        if (shouldScroll) {
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      }
    }, (error) => {
      console.error("Error fetching messages:", error);
    });

    return () => unsubscribe();
  }, [messageLimit, isInitialLoad, chatId]);

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

  const handleCopySelected = () => {
    const texts = messages.filter(m => selectedMessages.has(m.id)).map(m => m.text).join('\n\n');
    navigator.clipboard.writeText(texts);
    setSelectionMode(false);
    setSelectedMessages(new Set());
  };

  const handleDeleteSelected = async () => {
    if (!window.confirm(`Delete ${selectedMessages.size} messages for everyone?`)) return;
    try {
      await Promise.all(
        Array.from(selectedMessages).map(id => updateDoc(doc(db, `conversations/${chatId}/messages`, id), {
          text: '',
          isDeletedForEveryone: true,
          editedAt: rtdbServerTimestamp()
        }))
      );
    } catch (e) {
      console.error(e);
    }
    setSelectionMode(false);
    setSelectedMessages(new Set());
  };

  const loadMore = () => {
    setMessageLimit(prev => prev + 15);
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


  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'Obsidian');
    formData.append('cloud_name', 'dislib3k');

    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/dislib3k/image/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.secure_url) {
        // Send message with image
        const newMessageData: any = {
          text: '',
          imageUrl: data.secure_url,
          senderId: user.uid,
          createdAt: serverTimestamp(),
          seen: false
        };

        if (replyingTo) {
          newMessageData.replyToId = replyingTo.id;
          newMessageData.replyToText = replyingTo.text || 'Photo';
          newMessageData.replyToSenderId = replyingTo.senderId;
        }

        await addDoc(collection(db, 'chats', chatId, 'messages'), newMessageData);
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
    }
  };

  const isSameDay = (d1: any, d2: any) => {
    if (!d1 || !d2) return false;
    const date1 = d1.toDate ? d1.toDate() : new Date(d1);
    const date2 = d2.toDate ? d2.toDate() : new Date(d2);
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

  const handleRevealMessage = (msgId: string) => {
    setRevealedMessages(prev => {
      if (prev.includes(msgId)) return prev;
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

  const daysCount = new Set(visibleMessages.map(m => {
    if (!m.createdAt) return '';
    const date = m.createdAt.toDate ? m.createdAt.toDate() : new Date(typeof m.createdAt === 'number' ? m.createdAt : (m.createdAt as any).seconds ? (m.createdAt as any).seconds * 1000 : m.createdAt as any);
    return date.toDateString();
  }).filter(Boolean)).size;

  if (showSettings) {
    return (
      <div className="flex flex-col h-[100dvh] bg-white relative overflow-hidden w-full max-w-5xl mx-auto">
        <div className="flex items-center px-4 py-4 bg-white shadow-sm border-b border-slate-100 z-10 pt-[max(env(safe-area-inset-top),1rem)]">
          <button onClick={() => setShowSettings(false)} className="p-2 mr-3 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-700 transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-slate-800 tracking-wide">Settings</h1>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col space-y-4">
          <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
            <span className="text-slate-600 font-medium">Total Messages</span>
            <span className="text-slate-900 font-bold text-lg">{visibleMessages.length}</span>
          </div>
          <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
            <span className="text-slate-600 font-medium">My Messages</span>
            <span className="text-slate-900 font-bold text-lg">{visibleMessages.filter(m => m.senderId === user.uid).length}</span>
          </div>
          <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
            <span className="text-slate-600 font-medium">Days Chatted</span>
            <span className="text-slate-900 font-bold text-lg">{daysCount}</span>
          </div>
          <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
            <span className="text-slate-600 font-medium">Messages Today</span>
            <span className="text-slate-900 font-bold text-lg">{visibleMessages.filter((m: any) => isSameDay(m.createdAt, new Date())).length}</span>
          </div>
          <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
            <span className="text-slate-600 font-medium">Enter to Send</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={enterToSend} onChange={(e) => setEnterToSend(e.target.checked)} className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
          <div className="pt-4 border-t border-slate-100">
            <button 
              onClick={() => setShowClearConfirm(true)}
              className="w-full py-3.5 px-4 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors"
            >
              Clear Chat History
            </button>
          </div>
        </div>
        {/* Messages */}
      <div onScroll={() => setActiveReactionMessageId(null)} className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 flex flex-col relative scroll-smooth w-full max-w-4xl mx-auto">
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
        
        {(() => {
          let firstUnrepliedId: string | null = null;
          for (let i = visibleMessages.length - 1; i >= 0; i--) {
            if (visibleMessages[i].senderId === user.uid) break; 
            firstUnrepliedId = visibleMessages[i].id;
          }

          return visibleMessages.map((msg, index) => {
              const showDate = index === 0 || !isSameDay(visibleMessages[index - 1].createdAt, msg.createdAt);
              return (
                <React.Fragment key={msg.id}>
                  {showDate && (
                    <div className="flex justify-center mb-4 mt-2 z-10 relative pointer-events-none">
                      <div className="bg-white/80 backdrop-blur-md text-slate-600 font-medium text-[11px] px-3 py-1 rounded-full shadow-sm border border-black/5 tracking-wide">
                        {formatDateSeparator(msg.createdAt)}
                      </div>
                    </div>
                  )}
                  <MessageItem 
                    message={msg} 
                    isMine={msg.senderId === user.uid} 
                    user={user}
                    chatId={chatId}
                    isFirstUnreplied={msg.id === firstUnrepliedId}
                    onReply={() => setReplyingTo(msg)}
                    isAnonymousMode={isAnonymousMode}
                    isLastMessage={index === visibleMessages.length - 1}
                    isRevealed={revealedMessages.includes(msg.id)}
                    onReveal={() => handleRevealMessage(msg.id)}
                    isActiveReaction={activeReactionMessageId === msg.id}
                    onReactOpen={() => setActiveReactionMessageId(msg.id)}
                    onReactClose={() => setActiveReactionMessageId(null)}
                    otherEmail={otherEmail}
                    selectionMode={selectionMode}
                    isSelected={selectedMessages.has(msg.id)}
                    onToggleSelect={() => handleToggleSelect(msg.id)}
                  />
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
        
        <div ref={messagesEndRef} className="h-1 w-full shrink-0" />
      </div>

      {/* Composer */}
      <div className="shrink-0 px-2 sm:px-4 py-3 bg-white/30 backdrop-blur-xl border-t border-white/40 pb-[max(env(safe-area-inset-bottom),0.75rem)] z-20">
        
        {showEmojiPicker && (
          <div ref={emojiPickerRef} className="absolute bottom-[70px] left-2 sm:left-4 z-30 animate-pop-in">
            <EmojiPicker 
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
          <div className="max-w-4xl mx-auto mb-2 flex items-center bg-[#e2e8f0] rounded-lg p-2 shadow-sm border-l-4 border-teal-500 animate-slide-up relative z-10">
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

        <form onSubmit={handleSend} className="flex items-end space-x-2 max-w-4xl mx-auto relative z-20">
          <div className="flex-1 flex items-end bg-white/60 backdrop-blur-md border border-white/50 rounded-3xl overflow-hidden shadow-sm px-2">
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
            className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center shadow-sm transition-all active:scale-95 ${
              !text.trim() || isSending
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-[#00a884] text-white hover:bg-[#008f6f]'
            }`}
          >
            <Send size={20} className="ml-1" />
          </button>
        </form>
      </div>
    </div>
  );
}
}
