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
  serverTimestamp 
} from 'firebase/firestore';
import { ref, onValue, set, onDisconnect, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
import { Message } from '@/types/chat';
import MessageItem from './MessageItem';
import { useAuth } from '@/hooks/useAuth';
import { Smile, Send, Info, X, Image as ImageIcon, Loader2 } from 'lucide-react';
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

  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { signOut } = useAuth();

  const playNotificationSound = () => {
    try {
      if (document.visibilityState === 'visible') {
        const audio = new Audio('/notification.mp3');
        audio.play().catch(e => console.error("Audio play failed:", e));
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

  const statusText = isOtherTyping 
    ? 'typing...' 
    : otherUserStatus?.state === 'online' 
      ? 'Online' 
      : formatLastSeen(otherUserStatus?.last_changed || null);
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
      snapshot.forEach((doc) => {
        fetchedMessages.push({ id: doc.id, ...doc.data() } as Message);
      });
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


  return (
    <div className="flex flex-col h-[100dvh] bg-black text-white relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between w-full px-4 py-3 bg-[#0a0a0a] border-b border-white/5 shrink-0 z-20 pt-[max(env(safe-area-inset-top),0.75rem)] relative">
        <div className="flex items-center flex-1 overflow-hidden group">
          <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center mr-3 shrink-0">
            <span className="text-white/70 font-bold text-lg">
              {otherEmail[0].toUpperCase()}
            </span>
          </div>
          <div className="flex flex-col items-start overflow-hidden w-full">
            <h1 className="text-[16px] font-semibold text-white/90 truncate w-full text-left">
              30xCam
            </h1>
            <p className="text-[13px] text-white/50 truncate w-full text-left">
              {otherEmail}
            </p>
          </div>
        </div>

        <button 
          onClick={signOut}
          className="px-3 py-1.5 ml-2 text-[12px] font-medium text-red-400 border border-red-400/30 rounded-full hover:bg-red-400/10 transition-colors whitespace-nowrap"
        >
          Sign Out
        </button>

      </div>

      {/* Messages */}
      <div 
        className="chat-bg flex-1 overflow-y-auto px-2 sm:px-4 py-4 flex flex-col relative scroll-smooth"
      >
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
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].senderId === user.uid) {
              break; 
            }
            firstUnrepliedId = messages[i].id;
          }

          return messages.map((msg) => (
            <MessageItem 
              key={msg.id} 
              message={msg} 
              isMine={msg.senderId === user.uid} 
              user={user}
              chatId={chatId}
              isFirstUnreplied={msg.id === firstUnrepliedId}
              onReply={() => setReplyingTo(msg)}
            />
          ));
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
      <div className="shrink-0 px-2 sm:px-4 py-2 bg-[#f0f2f5] pb-[max(env(safe-area-inset-bottom),0.5rem)] z-20">
        
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
          <div className="flex-1 flex items-end bg-white rounded-3xl overflow-hidden shadow-sm px-2">
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
              className="flex-1 bg-transparent text-[#111b21] placeholder-[#8696a0] py-[13px] px-2 text-[15px] focus:outline-none resize-none leading-snug max-h-[120px] min-h-[48px]"
              rows={1}
            />
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
