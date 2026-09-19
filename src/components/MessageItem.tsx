'use client';

import { useEffect, useRef, useState, FormEvent } from 'react';
import { Message } from '@/types/chat';
import { doc, updateDoc, deleteDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Edit2, Trash2, X, Check, Pin } from 'lucide-react';
import { User } from 'firebase/auth';

interface MessageItemProps {
  message: Message;
  isMine: boolean;
  user: User;
  isFirstUnreplied?: boolean;
  onReply?: () => void;
}

const formatTime = (timestamp: any) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date();
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

export default function MessageItem({ message, isMine, user, isFirstUnreplied, onReply }: MessageItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Long press logic
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
            const messageRef = doc(db, 'conversations/private-chat/messages', message.id);
            updateDoc(messageRef, { seen: true }).catch((err) => {
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

  // Close options menu if clicked outside or scrolled
  useEffect(() => {
    const handleClose = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowOptions(false);
        setShowDeleteConfirm(false);
      }
    };
    if (showOptions || showDeleteConfirm) {
      document.addEventListener('mousedown', handleClose);
      document.addEventListener('touchstart', handleClose);
      document.addEventListener('scroll', handleClose, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClose);
      document.removeEventListener('touchstart', handleClose);
      document.removeEventListener('scroll', handleClose, true);
    };
  }, [showOptions, showDeleteConfirm]);

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const newText = editText.trim();
    if (!newText || newText === message.text || newText.length > 2000) {
      setIsEditing(false);
      return;
    }
    
    setIsUpdating(true);
    try {
      const messageRef = doc(db, 'conversations/private-chat/messages', message.id);
      await updateDoc(messageRef, {
        text: newText,
        isEdited: true,
        editedAt: serverTimestamp()
      });
      setIsEditing(false);
      setShowOptions(false);
    } catch (err) {
      console.error('Failed to edit message', err);
      setEditText(message.text);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteForEveryone = async () => {
    if (!window.confirm("Delete message for everyone?")) {
      setShowOptions(false);
      setShowDeleteConfirm(false);
      return;
    }
    try {
      const messageRef = doc(db, 'conversations/private-chat/messages', message.id);
      await updateDoc(messageRef, {
        isDeletedForEveryone: true,
        text: ''
      });
    } catch (err) {
      console.error('Failed to delete message', err);
    }
  };

  const handleDeleteForMe = async () => {
    if (!window.confirm("Delete message for yourself?")) {
      setShowOptions(false);
      setShowDeleteConfirm(false);
      return;
    }
    try {
      const messageRef = doc(db, 'conversations/private-chat/messages', message.id);
      await updateDoc(messageRef, {
        deletedFor: arrayUnion(user.uid)
      });
    } catch (err) {
      console.error('Failed to hide message', err);
    }
  };

  const handleTogglePin = async () => {
    try {
      const messageRef = doc(db, 'conversations/private-chat/messages', message.id);
      await updateDoc(messageRef, {
        isPinned: !message.isPinned
      });
      setShowOptions(false);
    } catch (err) {
      console.error('Failed to pin message', err);
    }
  };

  const startPress = () => {
    if (isEditing) return;
    timerRef.current = setTimeout(() => {
      setShowOptions(true);
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

  const [showReactions, setShowReactions] = useState(false);
  const lastTapRef = useRef<number>(0);
  const [translateX, setTranslateX] = useState(0);
  const dragStartX = useRef<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    dragStartX.current = e.clientX;
    startPress();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!e.isPrimary || dragStartX.current === null) return;
    
    const diffX = e.clientX - dragStartX.current;
    
    if (Math.abs(diffX) > 10) {
      cancelPress();
    }
    
    if (diffX > 0 && !message.isDeletedForEveryone && !isEditing) {
      const visualX = diffX < 60 ? diffX : 60 + (diffX - 60) * 0.2;
      setTranslateX(Math.min(visualX, 80));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    cancelPress();
    
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (translateX > 50 && onReply && !message.isDeletedForEveryone && !isEditing) {
      onReply();
      if (window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    } else if (Math.abs(translateX) < 10) {
      // It was a tap, check for double tap
      if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
        if (!message.isDeletedForEveryone && !isEditing) {
          setShowReactions(true);
          if (window.navigator.vibrate) window.navigator.vibrate(50);
        }
      }
      lastTapRef.current = now;
    }
    
    setTranslateX(0);
    dragStartX.current = null;
  };

  const handleReaction = async (emoji: string) => {
    try {
      const messageRef = doc(db, 'conversations/private-chat/messages', message.id);
      
      let newReactions = message.reactions ? { ...message.reactions } : {};
      
      if (newReactions[user.uid] === emoji) {
        delete newReactions[user.uid]; // Toggle off
      } else {
        newReactions[user.uid] = emoji;
      }
      
      await updateDoc(messageRef, {
        reactions: newReactions
      });
    } catch (err) {
      console.error('Failed to react', err);
    } finally {
      setShowReactions(false);
    }
  };


  if (message.deletedFor && message.deletedFor.includes(user.uid)) {
    return null; // Don't render if deleted for me
  }

  return (
    <div
      ref={itemRef}
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
          }
        }}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: translateX === 0 ? 'transform 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)' : 'none',
          touchAction: 'pan-y'
        }}
        className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 pt-2 pb-1.5 shadow-sm border ${showOptions || showDeleteConfirm ? 'scale-[0.98] brightness-95' : ''} ${
          isMine
            ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-sm border-[#005c4b] cursor-pointer'
            : 'bg-[#202c33] text-[#e9edef] rounded-tl-sm border-[#202c33] cursor-pointer'
        } ${isFirstUnreplied ? 'border-t-[3px] border-t-teal-500 shadow-sm mt-1' : ''}`}
      >
        {/* Pinned Indicator */}
        {message.isPinned && (
          <div className="flex items-center text-white/50 mb-1 text-[11px] font-medium opacity-80">
            <Pin size={10} className="mr-1" /> Pinned
          </div>
        )}

        {/* Reaction Selector Popup */}
        {showReactions && (
          <div className={`absolute ${isMine ? 'right-0' : 'left-0'} bottom-full mb-1 bg-[#2a3942] shadow-2xl rounded-full py-1.5 px-3 z-40 flex items-center space-x-2 animate-pop-in border border-white/5`}>
            {['❤️', '😂', '😮', '😢', '👍'].map(emoji => (
              <button
                key={emoji}
                onClick={(e) => { e.stopPropagation(); handleReaction(emoji); }}
                className="text-2xl hover:scale-125 transition-transform origin-bottom"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Backdrop for Reaction Selector */}
        {showReactions && (
          <div 
            className="fixed inset-0 z-30"
            onClick={(e) => { e.stopPropagation(); setShowReactions(false); }}
          />
        )}

        {(showOptions || showDeleteConfirm) && (
          <div ref={menuRef} className={`absolute ${isMine ? 'right-0' : 'left-0'} bottom-full mb-1 bg-[#2a3942] shadow-xl rounded-xl border border-white/5 py-1 z-30 min-w-[160px] flex flex-col animate-pop-in overflow-hidden ${isMine ? 'origin-bottom-right' : 'origin-bottom-left'}`}>
            
            {!showDeleteConfirm ? (
              <>
                {isMine && !message.isDeletedForEveryone && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsEditing(true); setShowOptions(false); }}
                    className="flex items-center px-4 py-3 text-sm text-white/90 hover:bg-white/5 transition-colors w-full"
                  >
                    <Edit2 size={16} className="mr-3 text-white/50" /> Edit
                  </button>
                )}
                
                {!message.isDeletedForEveryone && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleTogglePin(); }}
                    className="flex items-center px-4 py-3 text-sm text-white/90 hover:bg-white/5 transition-colors w-full border-t border-white/5"
                  >
                    <Pin size={16} className="mr-3 text-white/50" /> {message.isPinned ? 'Unpin' : 'Pin'}
                  </button>
                )}
                
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); setShowOptions(false); }}
                  className="flex items-center px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors w-full border-t border-white/5"
                >
                  <Trash2 size={16} className="mr-3 text-red-400" /> Delete
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteForMe(); }}
                  className="flex items-center px-4 py-3 text-sm text-white/90 hover:bg-white/5 transition-colors w-full"
                >
                  Delete for me
                </button>
                {isMine && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteForEveryone(); }}
                    className="flex items-center px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors w-full border-t border-white/5"
                  >
                    Delete for everyone
                  </button>
                )}
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); setShowOptions(true); }}
                  className="flex items-center justify-center px-4 py-2 text-sm text-white/50 hover:bg-white/5 transition-colors w-full border-t border-white/5 font-medium"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}

        {message.replyToId && !message.isDeletedForEveryone && (
          <div className="mb-1.5 p-1.5 bg-black/20 rounded flex flex-col border-l-[3px] border-l-teal-500 overflow-hidden text-left relative">
            <span className="text-[11px] font-semibold text-teal-400 truncate leading-tight">
              {message.replyToSenderId === user.uid ? 'You' : 'They'}
            </span>
            <span className="text-[13px] text-white/70 truncate leading-tight mt-0.5">
              {message.replyToText}
            </span>
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleEditSubmit} className="flex flex-col min-w-[200px] w-full" onClick={e => e.stopPropagation()}>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="bg-black/20 text-white rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none text-[15px] mb-2 leading-snug w-full"
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
                className="flex items-center justify-center p-2 rounded-full bg-white/10 text-white/50 hover:bg-white/20 transition-colors"
              >
                <X size={16} />
              </button>
              <button 
                type="submit" 
                disabled={isUpdating}
                className="flex items-center justify-center p-2 rounded-full bg-teal-500 text-white hover:bg-teal-400 transition-colors disabled:opacity-50"
              >
                <Check size={16} />
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col relative pointer-events-none select-none">
            <p className={`text-[15px] whitespace-pre-wrap break-words leading-snug pr-2 ${message.isDeletedForEveryone ? 'italic text-white/40 flex items-center' : ''}`}>
              {message.isDeletedForEveryone ? (
                <>
                  <Trash2 size={14} className="mr-1.5 opacity-60" /> This message was deleted
                </>
              ) : (
                message.text
              )}
            </p>
            <div className="flex items-center justify-end space-x-1 mt-0.5 self-end float-right">
              {!message.isDeletedForEveryone && message.isEdited && (
                <span className="text-[10px] text-white/40 italic mr-1">
                  Edited
                </span>
              )}
              <span className="text-[10px] text-white/50 font-medium">
                {message.editedAt ? formatTime(message.editedAt) : formatTime(message.createdAt)}
              </span>
              {isMine && (
                <div className="flex items-center ml-1 space-x-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${message.seen ? 'bg-teal-400 shadow-[0_0_4px_rgba(45,212,191,0.6)]' : 'bg-white/30'}`} />
                  <div className={`w-1.5 h-1.5 rounded-full ${message.seen ? 'bg-teal-400 shadow-[0_0_4px_rgba(45,212,191,0.6)]' : 'bg-white/30'}`} />
                </div>
              )}
            </div>
            
            {/* Render Reactions below the message */}
            {message.reactions && Object.keys(message.reactions).length > 0 && (
              <div className="flex items-center space-x-1 mt-1 -mb-1 bg-[#1a252b] rounded-full px-1.5 py-0.5 shadow-sm border border-white/5 w-fit self-end z-10 translate-y-2 relative pointer-events-auto cursor-default">
                {Object.values(message.reactions).map((emoji, index) => (
                  <span key={index} className="text-[11px] leading-none">{emoji}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
