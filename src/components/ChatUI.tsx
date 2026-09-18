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
import { Send, Smile } from 'lucide-react';
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
      await addDoc(collection(db, 'conversations/private-chat/messages'), {
        text: messageText,
        senderId: user.uid,
        createdAt: serverTimestamp(),
        seen: false
      });
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
    <div className="flex flex-col h-[100dvh] bg-[#efeae2] relative overflow-hidden">
      {/* Header - Completely clickable as Logout */}
      <button
        onClick={signOut}
        className="flex items-center w-full px-4 py-3 bg-[#f0f2f5] border-b border-slate-200 shrink-0 z-20 pt-[max(env(safe-area-inset-top),0.75rem)] hover:bg-[#e9edef] active:bg-[#d1d7db] transition-colors"
      >
        <div className="w-10 h-10 bg-slate-300 rounded-full flex items-center justify-center mr-3 shrink-0">
          <span className="text-slate-600 font-bold text-lg">
            {otherEmail[0].toUpperCase()}
          </span>
        </div>
        <div className="flex flex-col items-start overflow-hidden">
          <h1 className="text-[16px] font-semibold text-[#111b21] truncate w-full text-left">
            Private chat
          </h1>
          <p className="text-[13px] text-[#667781] truncate w-full text-left">
            {otherEmail}
          </p>
        </div>
      </button>

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
          // Find the first message from the other user that is after our last reply
          let firstUnrepliedId: string | null = null;
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].senderId === user.uid) {
              break; // Found our last reply
            }
            // This message is from the other user
            firstUnrepliedId = messages[i].id;
          }

          return messages.map((msg) => (
            <MessageItem 
              key={msg.id} 
              message={msg} 
              isMine={msg.senderId === user.uid} 
              user={user} 
              isFirstUnreplied={msg.id === firstUnrepliedId}
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
        
        {/* Emoji Picker Popover */}
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

        <form onSubmit={handleSend} className="flex items-end space-x-2 max-w-4xl mx-auto">
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
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
