'use client';

import { useEffect, useRef, useState, FormEvent } from 'react';
import { Message } from '@/types/chat';
import { doc, updateDoc, deleteDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Edit2, Trash2, X, Check, Pin, Plus, CheckCheck, Copy, Circle, CheckCircle2 } from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import ImageEditor from './ImageEditor';
import { User } from 'firebase/auth';

const formatMessageText = (text: string) => {
  if (!text) return text;
  
  // Regex to match **bold**, __underline__, ~~strike~~, *bold*, _italic_, ~strike~
  const regex = /(\*\*.+?\*\*|__.+?__|~~.+?~~|\*.+?\*|_.+?_|~.+?~)/g;
  const parts = text.split(regex);
  
  return parts.map((part, index) => {
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
    return part;
  });
};

interface MessageItemProps {
  message: Message;
  isMine: boolean;
  user: any;
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
}

const formatTime = (timestamp: any) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : (typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp));
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

export default function MessageItem({ message, isMine, user, chatId, isFirstUnreplied, onReply, isAnonymousMode = false, isLastMessage = false, isRevealed = false, onReveal, isActiveReaction = false, onReactOpen, onReactClose, otherEmail, selectionMode = false, isSelected = false, onToggleSelect, isExpanded,
    onToggleExpand,
    searchQuery,
    isPinned = false,
    onPinToggle
  }: MessageItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const renderTextWithHighlights = (text: string, query?: string) => {
    if (!query || !query.trim() || !text) return text;
    
    const safeQuery = Array.from(query).map(c => /[.*+?^${}()|[\]\\]/.test(c) ? '\\' + c : c).join('');
    const parts = text.split(new RegExp(`(${safeQuery})`, 'gi'));
    
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <span key={index} className='bg-amber-300 text-amber-900 rounded-[2px] font-medium'>{part}</span> 
        : part
    );
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
  }, [isMine, message.id, message.seen]);

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
        isDeletedForEveryone: true,
        text: ''
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
        if (selectionMode && onToggleSelect) {
            onToggleSelect();
        }
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

  return (
    <div
      ref={itemRef}
      id={`message-${message.id}`}
      className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'} mb-2.5 animate-pop-in relative`}
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
          className={`relative max-w-[85%] sm:max-w-[70%] rounded-[22px] px-2.5 pt-1.5 pb-1 shadow-sm border ${Math.abs(translateX) > 0 ? 'select-none' : ''} ${showOptions || showDeleteConfirm ? 'scale-[0.98] brightness-95' : ''} ${
          isMine
            ? 'bg-[#d9fdd3] text-[#111b21] rounded-tr-[4px] border-[#c8eed4] cursor-pointer'
            : 'bg-white text-[#111b21] rounded-tl-[4px] border-white cursor-pointer'
        } ${isFirstUnreplied ? 'border-t-[3px] border-t-blue-400 shadow-sm mt-1' : ''} `}
        onClick={() => { if (selectionMode && onToggleSelect) { onToggleSelect(); return; } }}
      >
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
                  onEmojiClick={(emojiData: any) => { handleReaction(emojiData.emoji); setShowFullEmojiPicker(false); }}
                  lazyLoadEmojis={true}
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
                    {isMine && !message.isDeletedForEveryone && (
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
                    {isMine && (
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
            {message.imageUrl && !message.isDeletedForEveryone && (
              <>
                {/* Lightbox state is managed inline with a portal-style fixed overlay */}
                <div className={`mb-1.5 relative rounded-xl overflow-hidden animate-pop-in bg-black/5 pointer-events-auto ${shouldMask ? 'blur-[8px] opacity-60 select-none pointer-events-none' : ''}`} style={{ minWidth: '150px', minHeight: '150px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={message.imageUrl}
                    alt="Photo"
                    className="w-full h-auto object-cover rounded-xl border border-black/5 cursor-zoom-in active:opacity-80 transition-opacity"
                    loading="lazy"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Create and show lightbox
                      const overlay = document.createElement('div');
                      overlay.id = 'img-lightbox';
                      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);animation:fadeIn .15s ease';
                      
                      const img = document.createElement('img');
                      img.src = message.imageUrl!;
                      img.alt = 'Full image';
                      img.style.cssText = 'max-width:95vw;max-height:90vh;object-fit:contain;border-radius:12px;box-shadow:0 25px 60px rgba(0,0,0,0.6)';
                      
                      // Close button
                      const closeBtn = document.createElement('button');
                      closeBtn.innerHTML = '✕';
                      closeBtn.style.cssText = 'position:absolute;top:16px;right:16px;width:40px;height:40px;background:rgba(255,255,255,0.15);border:none;border-radius:50%;color:white;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);transition:background .2s';
                      closeBtn.onmouseenter = () => { closeBtn.style.background = 'rgba(255,255,255,0.25)'; };
                      closeBtn.onmouseleave = () => { closeBtn.style.background = 'rgba(255,255,255,0.15)'; };

                      // Download button
                      const dlBtn = document.createElement('a');
                      dlBtn.href = message.imageUrl!;
                      dlBtn.download = 'image.jpg';
                      dlBtn.target = '_blank';
                      dlBtn.innerHTML = '⬇';
                      dlBtn.style.cssText = 'position:absolute;top:16px;right:64px;width:40px;height:40px;background:rgba(255,255,255,0.15);border-radius:50%;color:white;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);text-decoration:none;transition:background .2s';
                      dlBtn.onmouseenter = () => { dlBtn.style.background = 'rgba(255,255,255,0.25)'; };
                      dlBtn.onmouseleave = () => { dlBtn.style.background = 'rgba(255,255,255,0.15)'; };

                      const close = () => overlay.remove();
                      closeBtn.onclick = close;
                      overlay.onclick = (ev) => { if (ev.target === overlay) close(); };
                      document.addEventListener('keydown', function handler(ev) {
                        if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
                      });

                      overlay.appendChild(img);
                      overlay.appendChild(closeBtn);
                      overlay.appendChild(dlBtn);
                      document.body.appendChild(overlay);
                    }}
                  />
                </div>
              </>
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
            <div className="flex items-center justify-end space-x-1 mt-0.5 self-end float-right">
              {!message.isDeletedForEveryone && message.isEdited && (
                <span className="text-[10px] text-black/40 italic mr-1">
                  Edited
                </span>
              )}
              <span className="text-[10.5px] text-black/45 font-medium tracking-tight">
                {message.editedAt ? formatTime(message.editedAt) : formatTime(message.createdAt)}
              </span>
              {isMine && (
                <div className="flex items-center ml-1.5 space-x-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${message.seen ? 'bg-[#25D366] shadow-[0_0_2px_rgba(37,211,102,0.5)]' : 'bg-black/20'}`} />
                  <div className={`w-1.5 h-1.5 rounded-full ${message.seen ? 'bg-[#25D366] shadow-[0_0_2px_rgba(37,211,102,0.5)]' : 'bg-black/20'}`} />
                </div>
              )}
              {isMine && message.seen && message.seenAt && (
                <span className="text-[10.5px] text-blue-600 font-bold tracking-tight ml-1.5">
                  {formatTime(message.seenAt)}
                </span>
              )}
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
