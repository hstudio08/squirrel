'use client';

import React, { useEffect, useRef, useState, FormEvent } from 'react';
import { Message } from '@/types/chat';
import { doc, updateDoc, serverTimestamp, arrayUnion, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Edit2, Trash2, X, Check, Pin, Plus, CheckCheck, CheckSquare } from 'lucide-react';
import dynamic from 'next/dynamic';
import { EmojiClickData, EmojiStyle } from 'emoji-picker-react';
import { User } from 'firebase/auth';

const EmojiPicker = dynamic(
  () => import('emoji-picker-react'),
  { ssr: false }
);
import CustomAudioPlayer from './CustomAudioPlayer';

const formatMessageText = (text: string) => {
  if (!text) return text;
  
  // Regex to match **bold**, __underline__, ~~strike~~, *bold*, _italic_, ~strike~, and URLs
  const regex = /(\*\*.+?\*\*|__.+?__|~~.+?~~|\*.+?\*|_.+?_|~.+?~|https?:\/\/[^\s]+)/g;
  const parts = text.split(regex);
  
  return parts.map((part, index) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('__') && part.endsWith('__') && part.length > 4) {
      return <u key={index}>{part.slice(2, -2)}</u>;
    }
    if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4) {
      return <del key={index}>{part.slice(2, -2)}</del>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <strong key={index}>{part.slice(1, -1)}</strong>; // WhatsApp style bold
    }
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>; // WhatsApp style italic
    }
    if (part.startsWith('~') && part.endsWith('~') && part.length > 2) {
      return <del key={index}>{part.slice(1, -1)}</del>; // WhatsApp style strikethrough
    }
    if (part.match(/^https?:\/\/[^\s]+$/)) {
      return (
        <a 
          key={index} 
          href={part} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline break-all pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

interface MessageItemProps {
  message: Message;
  isMine: boolean;
  user: User;
  chatId: string;
  isFirstUnreplied: boolean;
  onReply?: () => void;
  isAnonymousMode?: boolean;
  isLastMessage?: boolean;
  isRevealed?: boolean;
  onReveal?: () => void;
  isActiveReaction?: boolean;
  onReactOpen?: () => void;
  onReactClose?: () => void;
  otherEmail?: string;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  searchQuery?: string;
  isPinned?: boolean;
  onPinToggle?: () => void;
  autoPreloadAudio?: boolean;
}

const formatTime = (timestamp: Timestamp | number | Date | any) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : (typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp));
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

export const MessageItemComponent = function MessageItem({ message, isMine, user, chatId, isFirstUnreplied, onReply, isAnonymousMode = false, isLastMessage = false, isRevealed = false, onReveal, isActiveReaction = false, onReactOpen, onReactClose, otherEmail, selectionMode = false, isSelected = false, onToggleSelect,
    isPinned = false,
    onPinToggle,
    autoPreloadAudio = false
  }: MessageItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isEditable = () => {
    if (!message.createdAt) return false;
    let msgTime;
    if (typeof message.createdAt === 'number') {
      msgTime = message.createdAt;
    } else if (typeof (message.createdAt as Timestamp).toMillis === 'function') {
      msgTime = (message.createdAt as Timestamp).toMillis();
    } else if ((message.createdAt as Timestamp).seconds) {
      msgTime = (message.createdAt as Timestamp).seconds * 1000;
    } else if (message.createdAt instanceof Date) {
      msgTime = message.createdAt.getTime();
    } else {
      msgTime = Date.now();
    }
    return (Date.now() - msgTime) <= 600000; // 10 minutes
  };

  const isDeletableForEveryone = () => {
    if (!message.createdAt) return false;
    let msgTime;
    if (typeof message.createdAt === 'number') {
      msgTime = message.createdAt;
    } else if (typeof (message.createdAt as Timestamp).toMillis === 'function') {
      msgTime = (message.createdAt as Timestamp).toMillis();
    } else if ((message.createdAt as Timestamp).seconds) {
      msgTime = (message.createdAt as Timestamp).seconds * 1000;
    } else if (message.createdAt instanceof Date) {
      msgTime = message.createdAt.getTime();
    } else {
      msgTime = Date.now();
    }
    return (Date.now() - msgTime) <= 43200000; // 12 hours
  };
    
    const getMaskedEmail = (email: string) => {
      if (!email) return '';
      const prefix = email.split('@')[0];
      if (prefix.length <= 4) return prefix;
      return `${prefix.substring(0, 2)}*****${prefix.substring(prefix.length - 2)}`;
    };
  
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
    const [showReactionDetails, setShowReactionDetails] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);
  const [optimisticReactions, setOptimisticReactions] = useState(message.reactions || {});
  const reactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setOptimisticReactions(message.reactions || {});
  }, [message.reactions]);

  const shouldMask = isAnonymousMode && !isLastMessage && !isRevealed;
  
  // Long press logic
  const timerRef = useRef<NodeJS.Timeout | null>(null);
    const longPressTriggered = useRef(false);

  useEffect(() => {
    if (isMine || message.seen) return;
    if (typeof window !== 'undefined' && localStorage.getItem('freezePresence') === 'true') return;

    const currentRef = itemRef.current;
    if (!currentRef) return;

    let timeoutId: NodeJS.Timeout;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          timeoutId = setTimeout(() => {
            const messageRef = doc(db, `conversations/${chatId}/messages`, message.id);
            updateDoc(messageRef, { seen: true, seenAt: serverTimestamp() }).catch((err) => {
              console.error('Failed to mark message as seen', err);
            });
            observer.disconnect();
          }, 1000);
        } else {
          if (timeoutId) clearTimeout(timeoutId);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(currentRef);

    return () => {
      observer.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isMine, message.id, message.seen, chatId]);

  // Menu closing is handled by the backdrop overlay

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const newText = editText.trim();
    if (!newText || newText === message.text || newText.length > 2000) {
      setIsEditing(false);
      return;
    }
    
    setIsUpdating(true);
    try {
      const messageRef = doc(db, `conversations/${chatId}/messages`, message.id);
      await updateDoc(messageRef, {
        text: newText,
        isEdited: true,
        editedAt: serverTimestamp()
      });
      setIsEditing(false);
      setShowOptions(false); if (onReactClose) onReactClose();
    } catch (err) {
      console.error('Failed to edit message', err);
      setEditText(message.text);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteForEveryone = async () => {
    setShowOptions(false); if (onReactClose) onReactClose();
      setShowDeleteConfirm(false);
    try {
      const messageRef = doc(db, `conversations/${chatId}/messages`, message.id);
      await updateDoc(messageRef, {
        isDeletedForEveryone: true
      });
    } catch (err) {
      console.error('Failed to delete message', err);
    }
  };

  const handleDeleteForMe = async () => {
    setShowOptions(false); if (onReactClose) onReactClose();
      setShowDeleteConfirm(false);
    try {
      const messageRef = doc(db, `conversations/${chatId}/messages`, message.id);
      await updateDoc(messageRef, {
        deletedFor: arrayUnion(user.uid)
      });
    } catch (err) {
      console.error('Failed to hide message', err);
    }
  };

  const handleTogglePin = async () => {
    try {
      const messageRef = doc(db, `conversations/${chatId}/messages`, message.id);
      await updateDoc(messageRef, {
        isPinned: !message.isPinned
      });
      setShowOptions(false); if (onReactClose) onReactClose();
    } catch (err) {
      console.error('Failed to pin message', err);
    }
  };

  const startPress = () => {
    if (isEditing) return;
    timerRef.current = setTimeout(() => {
        longPressTriggered.current = true;
        setShowOptions(true);
        if (onReactOpen) onReactOpen();
      if (window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }, 450); // 450ms for long press
  };

  const cancelPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

      const [translateX, setTranslateX] = useState(0);
  const dragStartX = useRef<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const isVerticalScroll = useRef<boolean>(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    isVerticalScroll.current = false;
    startPress();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!e.isPrimary || dragStartX.current === null || dragStartY.current === null) return;
    
    if (isVerticalScroll.current) return;
    
    const diffX = e.clientX - dragStartX.current;
    const diffY = e.clientY - dragStartY.current;
    
    if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
      cancelPress();
      
      // If movement is predominantly vertical, ignore horizontal slide
      if (Math.abs(diffY) > Math.abs(diffX)) {
        isVerticalScroll.current = true;
        setTranslateX(0);
        return;
      }
    }
    
    if (!message.isDeletedForEveryone && !isEditing) {
      if (diffX > 0 && onReply) {
        const visualX = diffX < 60 ? diffX : 60 + (diffX - 60) * 0.2;
        setTranslateX(Math.min(visualX, 80));
      } else if (diffX < 0 && isAnonymousMode && !isLastMessage) {
        const visualX = diffX > -60 ? diffX : -60 + (diffX + 60) * 0.2;
        setTranslateX(Math.max(visualX, -80));
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      if (!e.isPrimary) return;
      cancelPress();
      
      if (longPressTriggered.current) {
        if (e.type === 'pointerup') {
          longPressTriggered.current = false;
        }
        setTranslateX(0);
        dragStartX.current = null;
        return;
      }
      
      if ((e.type === 'pointerleave' || e.type === 'pointercancel') && Math.abs(translateX) < 50) {
        setTranslateX(0);
        dragStartX.current = null;
        return;
      }
    
    const now = Date.now();
    
    // If the pointer landed on an interactive element inside the popup (button, a, etc.)
    // do NOT close anything — let the button's own onClick handle it
    const target = e.target as HTMLElement;
    const isInsidePopup = target.closest('[data-popup]') !== null;
    if (isInsidePopup) {
      setTranslateX(0);
      dragStartX.current = null;
      return;
    }

    if (translateX > 50 && onReply && !message.isDeletedForEveryone && !isEditing) {
      onReply();
      if (window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    } else if (translateX < -50 && isAnonymousMode && !isLastMessage && onReveal && !message.isDeletedForEveryone && !isEditing) {
      onReveal();
      if (window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    } else if (Math.abs(translateX) < 10) {
      // Single tap on the bubble itself (not on a popup)
      if (!isActiveReaction && !showOptions && !showDeleteConfirm) {
        // Selection handled by onClick on outer wrapper
      } else {
        // Tapped outside popup — close everything
        if (onReactClose) onReactClose();
        setShowOptions(false); if (onReactClose) onReactClose();
        setShowDeleteConfirm(false);
      }
    }
    
    setTranslateX(0);
    dragStartX.current = null;
  };

  const handleReaction = (emoji: string) => {
    // 1. Optimistic Update immediately
    setOptimisticReactions(prev => {
      const newReactions = { ...prev };
      if (newReactions[user.uid] === emoji) {
        delete newReactions[user.uid]; // Toggle off
      } else {
        newReactions[user.uid] = emoji;
      }
      
      // 2. Clear old timeout to debounce
      if (reactionTimeoutRef.current) {
        clearTimeout(reactionTimeoutRef.current);
      }
      
      // 3. Debounce Firebase write by 500ms
      reactionTimeoutRef.current = setTimeout(async () => {
        try {
          const messageRef = doc(db, `conversations/${chatId}/messages`, message.id);
          await updateDoc(messageRef, {
            reactions: newReactions
          });
        } catch (err) {
          console.error('Failed to react', err);
          // Revert to server state if failed
          setOptimisticReactions(message.reactions || {});
        }
      }, 500);
      
      return newReactions;
    });

    if (onReactClose) onReactClose();
  };


  const outerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const outerLongPressTriggered = useRef(false);

  if (message.deletedFor && message.deletedFor.includes(user.uid)) {
    return null; // Don't render if deleted for me
  }

  const scrollToMessage = (id: string) => {
    const element = document.getElementById(`message-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('bg-black/10', 'transition-colors', 'duration-500');
      setTimeout(() => {
        element.classList.remove('bg-black/10');
      }, 1000);
    }
  };

  const handleOuterPointerDown = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    if (e.target !== e.currentTarget) return;
    
    outerLongPressTriggered.current = false;
    outerTimerRef.current = setTimeout(() => {
      outerLongPressTriggered.current = true;
      if (onToggleSelect && !selectionMode && !showOptions && !showDeleteConfirm && !isActiveReaction && !isEditing) {
        onToggleSelect();
        if (window.navigator.vibrate) window.navigator.vibrate(50);
      }
    }, 450);
  };

  const handleOuterPointerUp = (e: React.PointerEvent) => {
    if (outerTimerRef.current) {
      clearTimeout(outerTimerRef.current);
      outerTimerRef.current = null;
    }
  };

  return (
    <div
      ref={itemRef}
      id={`message-${message.id}`}
      className={`flex w-full ${isMine ? 'justify-end animate-message-sent' : 'justify-start animate-message-received'} mb-2.5 relative cursor-pointer`}
      onPointerDown={handleOuterPointerDown}
      onPointerUp={handleOuterPointerUp}
      onPointerLeave={handleOuterPointerUp}
      onPointerCancel={handleOuterPointerUp}
      onContextMenu={(e) => {
        if (e.target === e.currentTarget && !isEditing) {
          e.preventDefault();
        }
      }}
      onClick={(e) => {
        if (outerLongPressTriggered.current) return;
        if (selectionMode) {
          if (!showOptions && !showDeleteConfirm && !isActiveReaction && !isEditing) {
            if (onToggleSelect) {
              onToggleSelect();
            }
          }
        }
      }}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(e) => {
          if (!isEditing) {
            e.preventDefault(); 
            startPress(); 
            // Fallback for right click on desktop
            if (timerRef.current) clearTimeout(timerRef.current);
              setShowOptions(true);
              if (onReactOpen) onReactOpen();
          }
        }}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: translateX === 0 ? 'transform 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)' : 'none',
          touchAction: 'pan-y'
        }}
        onDoubleClick={(e) => {
              e.stopPropagation();
              if (selectionMode) { if (onToggleSelect) onToggleSelect(); return; }
              if (!message.isDeletedForEveryone && !isEditing && onReactOpen) {
              onReactOpen();
            }
          }}
          className={`relative max-w-[85%] sm:max-w-[70%] rounded-[22px] px-2.5 pt-1.5 pb-1 shadow-sm border transition-colors ${Math.abs(translateX) > 0 ? 'select-none' : ''} ${showOptions || showDeleteConfirm ? 'scale-[0.98] brightness-95' : ''} ${
          isSelected 
            ? 'bg-blue-500/10 text-[#111b21] border-blue-500/30 ring-2 ring-blue-500/20 ' + (isMine ? 'rounded-tr-[4px]' : 'rounded-tl-[4px]')
            : isMine
              ? 'bg-[#d9fdd3] text-[#111b21] rounded-tr-[4px] border-[#c8eed4] cursor-pointer'
              : 'bg-white text-[#111b21] rounded-tl-[4px] border-white cursor-pointer'
        } ${isFirstUnreplied ? 'border-t-[3px] border-t-blue-400 shadow-sm mt-1' : ''} `}
      >
        {selectionMode && (
          <div className="absolute inset-0 z-20 pointer-events-none rounded-inherit">
             <div className={`absolute top-1/2 -translate-y-1/2 ${isMine ? '-left-8' : '-right-8'} w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-colors shadow-sm ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-400 bg-white/80'}`}>
               {isSelected && <Check size={12} strokeWidth={3} className="text-white" />}
             </div>
          </div>
        )}
        {/* Pinned Indicator */}
        {message.isPinned && (
          <div className="flex items-center text-slate-500 mb-1 text-[11px] font-medium opacity-80">
            <Pin size={10} className="mr-1" /> Pinned
          </div>
        )}

        {/* Unified Backdrop */}
        {(showOptions || showDeleteConfirm || isActiveReaction) && (
          <div 
            className="fixed inset-0 z-30"
            onPointerDown={(e) => { e.stopPropagation(); if (onReactClose) onReactClose(); setShowFullEmojiPicker(false); setShowOptions(false); setShowDeleteConfirm(false); }}
            onTouchStart={(e) => { e.stopPropagation(); if (onReactClose) onReactClose(); setShowFullEmojiPicker(false); setShowOptions(false); setShowDeleteConfirm(false); }}
            onWheel={(e) => { e.stopPropagation(); if (onReactClose) onReactClose(); setShowFullEmojiPicker(false); setShowOptions(false); setShowDeleteConfirm(false); }}
            onClick={(e) => { e.stopPropagation(); if (onReactClose) onReactClose(); setShowFullEmojiPicker(false); setShowOptions(false); setShowDeleteConfirm(false); }}
          />
        )}

        {/* Stacked Container */}
        {(showOptions || showDeleteConfirm || isActiveReaction) && (
          <div data-popup onPointerDown={(e) => e.stopPropagation()} className={`absolute ${isMine ? 'right-0 items-end origin-bottom-right' : 'left-0 items-start origin-bottom-left'} bottom-full mb-1 flex flex-col gap-1.5 z-40 animate-pop-in`}>
            
            {/* Reaction Selector Popup */}
            {isActiveReaction && !showFullEmojiPicker && (
              <div className="bg-white shadow-xl rounded-full py-1.5 px-3 flex items-center space-x-2 border border-slate-100 w-max">
                {['\uD83D\uDC4D', '\u2764\uFE0F', '\uD83D\uDE02', '\uD83D\uDE2E', '\uD83D\uDE22'].map(emoji => (
                  <button
                    key={emoji}
                    onClick={(e) => { e.stopPropagation(); handleReaction(emoji); }}
                    className="text-2xl hover:scale-125 transition-transform origin-bottom"
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={(e) => { e.stopPropagation(); setShowFullEmojiPicker(true); }}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600"
                >
                  <Plus size={18} />
                </button>
              </div>
            )}

            {/* Full Emoji Picker */}
            {showFullEmojiPicker && (
              <div className="shadow-2xl rounded-2xl overflow-hidden animate-pop-in z-50 mb-1" onClick={(e) => e.stopPropagation()}>
                <EmojiPicker
                  onEmojiClick={(emojiData: EmojiClickData) => { handleReaction(emojiData.emoji); setShowFullEmojiPicker(false); }}
                  lazyLoadEmojis={true}
                  emojiStyle={EmojiStyle.NATIVE}
                  width={280}
                  height={320}
                  searchDisabled={true}
                  skinTonesDisabled={true}
                />
              </div>
            )}

            {/* Options Menu */}
            {(showOptions || showDeleteConfirm) && (
              <div
                ref={menuRef}
                className="bg-white shadow-xl rounded-xl border border-slate-100 py-1 min-w-[160px] flex flex-col overflow-hidden w-max"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {!showDeleteConfirm ? (
                  <>
                    <button
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onPinToggle) onPinToggle();
                        setShowOptions(false); if (onReactClose) onReactClose();
                      }}
                      className="flex items-center px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors w-full border-b border-slate-100"
                    >
                      <Pin size={16} className={`mr-3 ${isPinned ? 'text-blue-500 fill-blue-500' : 'text-slate-500'}`} /> {isPinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onToggleSelect) onToggleSelect();
                        setShowOptions(false); if (onReactClose) onReactClose();
                      }}
                      className="flex items-center px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors w-full border-b border-slate-100"
                    >
                      <CheckSquare size={16} className="mr-3 text-slate-500" /> Select
                    </button>
                    {isMine && !message.isDeletedForEveryone && isEditable() && (
                      <button
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsEditing(true);
                          setShowOptions(false); if (onReactClose) onReactClose();
                        }}
                        className="flex items-center px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors w-full"
                      >
                        <Edit2 size={16} className="mr-3 text-slate-500" /> Edit
                      </button>
                    )}
                    <button
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowDeleteConfirm(true);
                        setShowOptions(false); if (onReactClose) onReactClose();
                      }}
                      className={`flex items-center px-4 py-3 text-sm text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors w-full ${isMine && !message.isDeletedForEveryone ? 'border-t border-slate-100' : ''}`}
                    >
                      <Trash2 size={16} className="mr-3 text-red-500" /> Delete
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteForMe();
                      }}
                      className="flex items-center px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors w-full"
                    >
                      Delete for me
                    </button>
                    {isMine && isDeletableForEveryone() && (
                      <button
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteForEveryone();
                        }}
                        className="flex items-center px-4 py-3 text-sm text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors w-full border-t border-slate-100"
                      >
                        Delete for everyone
                      </button>
                    )}
                    <button
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowDeleteConfirm(false);
                        setShowOptions(true);
                      }}
                      className="flex items-center justify-center px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors w-full border-t border-slate-100 font-medium"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}


        {message.replyToId && !message.isDeletedForEveryone && (
          <div onClick={(e) => { e.stopPropagation(); scrollToMessage(message.replyToId!); }} className={`mb-1.5 p-1.5 bg-black/5 rounded flex flex-col border-l-[3px] border-l-teal-500 overflow-hidden text-left relative before:absolute before:inset-0 before:bg-white/40 before:-z-10 cursor-pointer hover:bg-black/10 transition-colors ${shouldMask ? 'blur-[3.5px] opacity-60 select-none' : ''}`}>
            <span className="text-[11px] font-semibold text-teal-600 truncate leading-tight">
              {message.replyToSenderId === user.uid ? 'You' : 'They'}
            </span>
            <span className="text-[13px] text-black/70 truncate leading-tight mt-0.5">
              {message.replyToText}
            </span>
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleEditSubmit} className="flex flex-col min-w-[200px] w-full" onClick={e => e.stopPropagation()}>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="bg-white/60 text-[#111b21] rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none text-[15px] mb-2 leading-snug w-full"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsEditing(false);
                  setEditText(message.text);
                }
              }}
            />
            <div className="flex justify-end space-x-1.5">
              <button 
                type="button" 
                onClick={() => { setIsEditing(false); setEditText(message.text); }}
                className="flex items-center justify-center p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
              >
                <X size={16} />
              </button>
              <button 
                type="submit" 
                disabled={isUpdating}
                className="flex items-center justify-center p-2 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                <Check size={16} />
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col relative pointer-events-none select-none">
        {/* Image Message */}
            {(() => {
              const urls = message.imageUrls || (message.imageUrl ? [message.imageUrl] : []);
              if (urls.length === 0 || message.isDeletedForEveryone) return null;
              
              const isGrid = urls.length > 1;
              const displayUrls = isGrid ? urls.slice(0, 4) : urls;
              const remainingCount = urls.length > 4 ? urls.length - 4 : 0;
              
              return (
                <div className={`mb-1.5 pointer-events-auto ${isGrid ? 'grid grid-cols-2 gap-[2px] rounded-xl overflow-hidden bg-black/10' : 'rounded-xl overflow-hidden bg-black/5 relative'} animate-pop-in ${shouldMask ? 'blur-[8px] opacity-60 select-none pointer-events-none' : ''}`} style={!isGrid ? { maxWidth: '320px', maxHeight: '420px' } : { width: '100%', maxWidth: '320px' }}>
                  {displayUrls.map((url, idx) => {
                    const isLastDisplay = idx === 3;
                    const isThirdOfThree = urls.length === 3 && idx === 2;
                    return (
                      <div 
                        key={idx} 
                        className={`relative overflow-hidden cursor-zoom-in active:opacity-80 transition-opacity ${isGrid ? 'aspect-square bg-black/20' : 'w-full h-auto'} ${isThirdOfThree ? 'col-span-2 aspect-[2/1]' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          let currentIdx = idx;
                          
                          const overlay = document.createElement('div');
                          overlay.id = 'img-lightbox';
                          overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.95);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(12px);animation:fadeIn .2s ease;touch-action:none;';
                          
                          const container = document.createElement('div');
                          container.style.cssText = 'position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;';
                          
                          const img = document.createElement('img');
                          img.src = urls[currentIdx];
                          img.alt = 'Full image';
                          img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;user-select:none;transition:transform 0.2s ease, opacity 0.2s ease;';
                          
                          const updateImage = () => {
                            img.style.opacity = '0';
                            img.style.transform = 'scale(0.95)';
                            setTimeout(() => {
                              img.src = urls[currentIdx];
                              img.style.opacity = '1';
                              img.style.transform = 'scale(1)';
                              counter.textContent = `${currentIdx + 1} / ${urls.length}`;
                            }, 150);
                          };

                          const closeBtn = document.createElement('button');
                          closeBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
                          closeBtn.style.cssText = 'position:absolute;top:20px;left:20px;width:44px;height:44px;background:rgba(255,255,255,0.15);border:none;border-radius:50%;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);transition:background .2s;z-index:10;';
                          closeBtn.onmouseenter = () => { closeBtn.style.background = 'rgba(255,255,255,0.25)'; };
                          closeBtn.onmouseleave = () => { closeBtn.style.background = 'rgba(255,255,255,0.15)'; };

                          const dlBtn = document.createElement('a');
                          dlBtn.href = urls[currentIdx];
                          dlBtn.download = 'image.jpg';
                          dlBtn.target = '_blank';
                          dlBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';
                          dlBtn.style.cssText = 'position:absolute;top:20px;right:20px;width:44px;height:44px;background:rgba(255,255,255,0.15);border-radius:50%;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);text-decoration:none;transition:background .2s;z-index:10;';
                          dlBtn.onmouseenter = () => { dlBtn.style.background = 'rgba(255,255,255,0.25)'; };
                          dlBtn.onmouseleave = () => { dlBtn.style.background = 'rgba(255,255,255,0.15)'; };

                          const counter = document.createElement('div');
                          counter.textContent = `${currentIdx + 1} / ${urls.length}`;
                          counter.style.cssText = 'position:absolute;top:32px;left:50%;transform:translateX(-50%);color:white;font-weight:600;font-size:16px;text-shadow:0 1px 4px rgba(0,0,0,0.5);z-index:10;';
                          
                          if (urls.length < 2) counter.style.display = 'none';

                          const prevBtn = document.createElement('button');
                          prevBtn.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
                          prevBtn.style.cssText = 'position:absolute;left:16px;top:50%;transform:translateY(-50%);width:56px;height:56px;background:rgba(255,255,255,0.1);border:none;border-radius:50%;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);transition:background .2s;z-index:10;';
                          prevBtn.onmouseenter = () => { prevBtn.style.background = 'rgba(255,255,255,0.2)'; };
                          prevBtn.onmouseleave = () => { prevBtn.style.background = 'rgba(255,255,255,0.1)'; };
                          
                          const nextBtn = document.createElement('button');
                          nextBtn.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
                          nextBtn.style.cssText = 'position:absolute;right:16px;top:50%;transform:translateY(-50%);width:56px;height:56px;background:rgba(255,255,255,0.1);border:none;border-radius:50%;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);transition:background .2s;z-index:10;';
                          nextBtn.onmouseenter = () => { nextBtn.style.background = 'rgba(255,255,255,0.2)'; };
                          nextBtn.onmouseleave = () => { nextBtn.style.background = 'rgba(255,255,255,0.1)'; };

                          if (urls.length < 2) {
                            prevBtn.style.display = 'none';
                            nextBtn.style.display = 'none';
                          }

                          prevBtn.onclick = (ev) => {
                            ev.stopPropagation();
                            if (currentIdx > 0) { currentIdx--; updateImage(); dlBtn.href = urls[currentIdx]; }
                          };
                          nextBtn.onclick = (ev) => {
                            ev.stopPropagation();
                            if (currentIdx < urls.length - 1) { currentIdx++; updateImage(); dlBtn.href = urls[currentIdx]; }
                          };

                          const close = () => {
                            overlay.style.opacity = '0';
                            setTimeout(() => overlay.remove(), 200);
                          };
                          closeBtn.onclick = close;
                          overlay.onclick = (ev) => { if (ev.target === overlay || ev.target === container) close(); };
                          
                          document.addEventListener('keydown', function handler(ev) {
                            if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
                            if (ev.key === 'ArrowLeft' && currentIdx > 0) { currentIdx--; updateImage(); dlBtn.href = urls[currentIdx]; }
                            if (ev.key === 'ArrowRight' && currentIdx < urls.length - 1) { currentIdx++; updateImage(); dlBtn.href = urls[currentIdx]; }
                          });

                          container.appendChild(img);
                          overlay.appendChild(container);
                          overlay.appendChild(closeBtn);
                          overlay.appendChild(dlBtn);
                          overlay.appendChild(counter);
                          overlay.appendChild(prevBtn);
                          overlay.appendChild(nextBtn);
                          document.body.appendChild(overlay);
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt="Photo"
                          className={`w-full h-full object-cover ${!isGrid ? 'rounded-xl' : ''}`}
                          loading="lazy"
                        />
                        {isLastDisplay && remainingCount > 0 && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-3xl font-medium tracking-wide">
                            +{remainingCount}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            
            {message.audioUrl && !message.isDeletedForEveryone && (
              <div className={`mt-1 mb-1 relative z-10 w-[240px] ${shouldMask ? 'blur-[3.5px] opacity-60 select-none' : ''}`}>
                <CustomAudioPlayer 
                  src={message.audioUrl}
                  autoPreload={autoPreloadAudio}
                />
              </div>
            )}

            <p className={`text-[15px] whitespace-pre-wrap break-words leading-snug pr-2 ${message.isDeletedForEveryone ? 'italic text-black/50 flex items-center' : ''} ${shouldMask ? 'blur-[3.5px] opacity-60 select-none' : ''}`}>
              {message.isDeletedForEveryone ? (
                <>
                  <span className="italic font-light text-[14px] text-black/50 tracking-wide">This message was deleted</span>
                </>
              ) : (
                formatMessageText(message.text)
              )}
            </p>
            <div className={`flex items-center space-x-1 ${(!message.text && ((message.imageUrls?.length || 0) > 0 || !!message.imageUrl)) ? 'absolute bottom-[4px] right-[4px] bg-black/40 text-white/90 rounded-full px-1.5 py-[1px] z-10 backdrop-blur-sm scale-[0.85] origin-bottom-right' : 'mt-0.5 justify-end self-end float-right'}`}>
              <div className="flex items-center space-x-1">
                {!message.isDeletedForEveryone && message.isEdited && (
                  <span className={`text-[10px] italic mr-1 ${(!message.text && ((message.imageUrls?.length || 0) > 0 || !!message.imageUrl)) ? 'text-white/80' : 'text-black/40'}`}>
                    Edited
                  </span>
                )}
                <span className={`text-[10.5px] font-medium tracking-tight ${(!message.text && ((message.imageUrls?.length || 0) > 0 || !!message.imageUrl)) ? 'text-white' : 'text-black/45'}`}>
                  {message.editedAt ? formatTime(message.editedAt) : formatTime(message.createdAt)}
                </span>
                {isMine && (
                  <div className="flex items-center ml-1.5 opacity-90">
                    {message.seen ? (
                      <div className="flex items-center">
                        <div className="flex items-center space-x-[3px] mr-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${(!message.text && ((message.imageUrls?.length || 0) > 0 || !!message.imageUrl)) ? 'bg-green-400 drop-shadow-sm' : 'bg-green-500'}`}></div>
                          <div className={`w-1.5 h-1.5 rounded-full ${(!message.text && ((message.imageUrls?.length || 0) > 0 || !!message.imageUrl)) ? 'bg-green-400 drop-shadow-sm' : 'bg-green-500'}`}></div>
                        </div>
                        {message.seenAt && (
                          <span className={`text-[10px] font-semibold tracking-tight ${(!message.text && ((message.imageUrls?.length || 0) > 0 || !!message.imageUrl)) ? 'text-blue-300 drop-shadow-sm' : 'text-blue-500'}`}>
                            {formatTime(message.seenAt)}
                          </span>
                        )}
                      </div>
                    ) : message.delivered ? (
                      <div className={`w-1.5 h-1.5 rounded-full ${(!message.text && ((message.imageUrls?.length || 0) > 0 || !!message.imageUrl)) ? 'bg-green-400 drop-shadow-sm' : 'bg-green-500'}`}></div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
            
            {/* Render Reactions below the message */}
            {optimisticReactions && Object.keys(optimisticReactions).length > 0 && (
              <div 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  const uids = Object.keys(optimisticReactions);
                  if (uids.length === 1 && uids[0] === user.uid) {
                    handleReaction(optimisticReactions[user.uid]);
                  } else {
                    setShowReactionDetails(true); 
                  }
                }}
                className={`flex items-center space-x-1 mt-1 -mb-1 rounded-full px-1.5 py-0.5 shadow-sm border w-fit self-end z-10 translate-y-2 relative pointer-events-auto cursor-pointer transition-all duration-200 ${optimisticReactions[user.uid] ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-100 hover:bg-blue-100' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
              >
                {Object.values(optimisticReactions).map((emoji, index) => (
                  <span key={index} className="text-[12px] leading-none">{emoji as string}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showReactionDetails && optimisticReactions && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setShowReactionDetails(false); }}>
          <div className="bg-white rounded-[16px] p-3 w-full max-w-[200px] shadow-xl border border-slate-100 animate-pop-in flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[13px] font-bold text-slate-800">Reactions</span>
              <button onClick={() => setShowReactionDetails(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full p-1 transition-colors">
                <X size={14} />
              </button>
            </div>
            <div className="flex flex-col space-y-1.5">
              {Object.entries(optimisticReactions).map(([uid, emoji]) => (
                <div key={uid} className={`flex items-center justify-between p-1.5 rounded-lg border ${uid === user.uid ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-slate-50 border-transparent'}`}>
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 bg-white shadow-sm rounded-full flex items-center justify-center text-[15px]">
                      {emoji as string}
                    </div>
                    <span className="text-[12px] font-semibold text-slate-700 truncate">
                      {uid === user.uid ? 'You' : (otherEmail ? getMaskedEmail(otherEmail) : 'Other')}
                    </span>
                  </div>
                  {uid === user.uid && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReaction(emoji as string);
                        setShowReactionDetails(false);
                      }}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                      title="Remove reaction"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(MessageItemComponent, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.text === nextProps.message.text &&
    prevProps.message.isDeletedForEveryone === nextProps.message.isDeletedForEveryone &&
    prevProps.message.seen === nextProps.message.seen &&
    prevProps.message.delivered === nextProps.message.delivered &&
    JSON.stringify(prevProps.message.reactions) === JSON.stringify(nextProps.message.reactions) &&
    prevProps.isFirstUnreplied === nextProps.isFirstUnreplied &&
    prevProps.isAnonymousMode === nextProps.isAnonymousMode &&
    prevProps.isLastMessage === nextProps.isLastMessage &&
    prevProps.isRevealed === nextProps.isRevealed &&
    prevProps.isActiveReaction === nextProps.isActiveReaction &&
    prevProps.selectionMode === nextProps.selectionMode &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.isPinned === nextProps.isPinned &&
    prevProps.searchQuery === nextProps.searchQuery
  );
});
