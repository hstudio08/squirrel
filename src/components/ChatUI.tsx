'use client';

import React, { useState, useEffect, useRef, FormEvent, Fragment } from 'react';
import { User } from 'firebase/auth';
import { db, rtdb } from '@/lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  limit as firestoreLimit, 
  onSnapshot, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { ref, onValue, set, onDisconnect } from 'firebase/database';
import { Message } from '@/types/chat';
import MessageItem from './MessageItem';
import { useAuth } from '@/hooks/useAuth';
import { Smile, Send, Loader2, Info, X } from 'lucide-react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';

interface ChatUIProps {
  user: User;
}

export default function ChatUI({ user }: ChatUIProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messageLimit, setMessageLimit] = useState(15);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  
  const { signOut } = useAuth();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const otherEmail = user.email === 'officialhaadi81@gmail.com' ? 'sadiyaayoub22019@gmail.com' : 'officialhaadi81@gmail.com';

  // Typing indicator logic
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    // Reference to my typing state
    const myTypingRef = ref(rtdb, `typingStatus/private-chat/${user.uid}`);
    
    // Set to false on disconnect
    onDisconnect(myTypingRef).set(false);

    // Listen to other user's typing state
    // We listen to the whole private-chat node and check if anyone EXCEPT us is typing
    const chatTypingRef = ref(rtdb, `typingStatus/private-chat`);
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

    // Cleanup on unmount
    return () => {
      set(myTypingRef, false);
      unsubscribeTyping();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [user.uid]);

  const updateTypingStatus = (typing: boolean) => {
    if (isTypingRef.current !== typing) {
      isTypingRef.current = typing;
      const myTypingRef = ref(rtdb, `typingStatus/private-chat/${user.uid}`);
      set(myTypingRef, typing).catch(err => console.error("Typing status error", err));
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    adjustTextareaHeight();

    // Typing logic
    if (newText.length > 0) {
      updateTypingStatus(true);
      
      // Debounce stop typing
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        updateTypingStatus(false);
      }, 1000);
    } else {
      updateTypingStatus(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  // Visibility change to stop typing when tab hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updateTypingStatus(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Firestore messages listener
  useEffect(() => {
    const q = query(
      collection(db, 'conversations/private-chat/messages'),
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
        // Check for new messages from the other user to trigger notification
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const newMsg = change.doc.data();
            if (newMsg.senderId !== user.uid && document.visibilityState === 'hidden') {
              const notificationsEnabled = localStorage.getItem('notificationsEnabled') === 'true';
              if (notificationsEnabled && 'serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(registration => {
                  registration.active?.postMessage({ type: 'SHOW_NOTIFICATION' });
                });
              }
            }
          }
        });
      }
    }, (error) => {
      console.error("Error fetching messages:", error);
    });

    return () => unsubscribe();
  }, [messageLimit, isInitialLoad]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || text.length > 2000 || isSending) return;

    setIsSending(true);
    const messageText = text.trim();
    setText('');
    setShowEmojiPicker(false);
    
    // Stop typing indicator immediately
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

      await addDoc(collection(db, 'conversations/private-chat/messages'), newMessageData);
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

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('notificationsEnabled');
    if (saved === 'true') setNotificationsEnabled(true);
  }, []);

  const toggleNotifications = async () => {
    if (!notificationsEnabled) {
      if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          setNotificationsEnabled(true);
          localStorage.setItem('notificationsEnabled', 'true');
        } else {
          alert("Notification permission denied by browser.");
        }
      } else if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
        localStorage.setItem('notificationsEnabled', 'true');
      } else {
        alert("Notification permission is blocked. Please enable it in browser settings.");
      }
    } else {
      setNotificationsEnabled(false);
      localStorage.setItem('notificationsEnabled', 'false');
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-black text-white relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between w-full px-4 py-3 bg-[#0a0a0a] border-b border-white/5 shrink-0 z-20 pt-[max(env(safe-area-inset-top),0.75rem)] relative">
        <button
          onClick={signOut}
          className="flex items-center flex-1 overflow-hidden group hover:opacity-80 transition-opacity"
        >
          <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center mr-3 shrink-0 group-active:scale-95 transition-transform">
            <span className="text-white/70 font-bold text-lg">
              {otherEmail[0].toUpperCase()}
            </span>
          </div>
          <div className="flex flex-col items-start overflow-hidden">
            <h1 className="text-[16px] font-semibold text-white/90 truncate w-full text-left">
              30xCam
            </h1>
            <p className="text-[13px] text-white/50 truncate w-full text-left">
              {otherEmail}
            </p>
          </div>
        </button>

        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 ml-2 text-white/50 hover:text-white/90 rounded-full hover:bg-white/5 transition-colors"
        >
          <Info size={20} />
        </button>

        {showSettings && (
          <div className="absolute top-full right-4 mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl p-4 w-64 z-30 animate-pop-in">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/90">Notifications</span>
              <button 
                onClick={toggleNotifications}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${notificationsEnabled ? 'bg-teal-500' : 'bg-white/20'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
            <p className="text-[11px] text-white/40 mt-2">
              {Notification.permission === 'denied' 
                ? 'Blocked by browser. Allow in site settings.' 
                : 'Receive a generic alert when you get a new message in the background.'}
            </p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 flex flex-col relative scroll-smooth bg-black"
      >
        {messages.length >= messageLimit && (
          <div className="flex justify-center mb-6 z-10">
            <button 
              onClick={loadMore}
              className="px-4 py-1.5 bg-[#1a1a1a] border border-white/10 rounded-full text-[13px] font-medium text-white/70 active:scale-95 transition-all"
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
              isFirstUnreplied={msg.id === firstUnrepliedId}
              onReply={() => setReplyingTo(msg)}
            />
          ));
        })()}
        
        {/* Typing Indicator */}
        {isOtherTyping && (
          <div className="flex w-full justify-start mb-2.5 animate-pop-in">
            <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center space-x-1">
              <div className="typing-dot !bg-white/50" />
              <div className="typing-dot !bg-white/50" />
              <div className="typing-dot !bg-white/50" />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} className="h-1 w-full shrink-0" />
      </div>

      {/* Composer */}
      <div className="shrink-0 px-2 sm:px-4 py-2 bg-[#0a0a0a] border-t border-white/5 pb-[max(env(safe-area-inset-bottom),0.5rem)] z-20">
        
        {showEmojiPicker && (
          <div ref={emojiPickerRef} className="absolute bottom-[70px] left-2 sm:left-4 z-30 animate-pop-in">
            <EmojiPicker 
              onEmojiClick={onEmojiClick} 
              theme={Theme.DARK}
              lazyLoadEmojis
              searchDisabled
              skinTonesDisabled
              width={280}
              height={350}
            />
          </div>
        )}

        {replyingTo && (
          <div className="max-w-4xl mx-auto mb-2 flex items-center bg-[#1a1a1a] rounded-xl p-2 border-l-4 border-teal-500 animate-slide-up relative z-10">
            <div className="flex-1 overflow-hidden pr-2">
              <p className="text-[12px] font-semibold text-teal-500 mb-0.5">
                {replyingTo.senderId === user.uid ? 'You' : otherEmail}
              </p>
              <p className="text-[13px] text-white/70 truncate">
                {replyingTo.text}
              </p>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-1 rounded-full hover:bg-white/10 text-white/50 shrink-0"
              type="button"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-end space-x-2 max-w-4xl mx-auto relative z-20">
          <div className="flex-1 flex items-end bg-[#1a1a1a] rounded-3xl overflow-hidden px-2 border border-white/10 focus-within:border-white/20 transition-colors">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="shrink-0 p-3 text-white/50 hover:text-white/90 transition-colors self-end"
            >
              <Smile size={24} strokeWidth={1.5} />
            </button>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              placeholder="Type a message..."
              className="flex-1 bg-transparent text-white placeholder-white/40 py-[13px] px-2 text-[15px] focus:outline-none resize-none leading-snug max-h-[120px] min-h-[48px]"
              rows={1}
            />
          </div>
          
          <button
            type="submit"
            disabled={!text.trim() || isSending}
            className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 ${
              !text.trim() || isSending
                ? 'bg-white/10 text-white/30 cursor-not-allowed'
                : 'bg-teal-600 text-white hover:bg-teal-500'
            }`}
          >
            <Send size={20} className="ml-1" />
          </button>
        </form>
      </div>
    </div>
  );
}
