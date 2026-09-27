import React, { useState, useRef, useEffect } from 'react';
import { Smile, Send, Loader2, Image as ImageIcon } from 'lucide-react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';

export interface ChatInputFormProps {
  isSending: boolean;
  onSend: (e?: React.FormEvent, customText?: string) => void;
  pastedImagesLength: number;
  onPasteImage: (file: File) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  scrollContainerRef: React.RefObject<any>;
  messagesEndRef: React.RefObject<any>;
  updateTypingStatus: (typing: boolean) => void;
  enterToSend: boolean;
}

export const ChatInputForm = React.forwardRef<any, ChatInputFormProps>(
  ({ isSending, onSend, pastedImagesLength, onPasteImage, onImageUpload, scrollContainerRef, messagesEndRef, updateTypingStatus, enterToSend }, ref) => {
    const [text, setText] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    React.useImperativeHandle(ref, () => ({
      setText,
      getText: () => text
    }));

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent | TouchEvent) => {
        const target = event.target as Element;
        if (emojiPickerRef.current && !emojiPickerRef.current.contains(target as Node)) {
          if (!target.closest('#emoji-toggle-btn')) {
            setShowEmojiPicker(false);
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

    const adjustTextareaHeight = () => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
      }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      adjustTextareaHeight();
      updateTypingStatus(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        updateTypingStatus(false);
      }, 1000);
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

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if ((text.trim() || pastedImagesLength > 0) && !isSending) {
        onSend(undefined, text);
        setText('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    };

    return (
      <>
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
        <form onSubmit={handleSubmit} className="flex items-end space-x-2 max-w-4xl mx-auto relative z-20 pointer-events-auto w-full">
          <div className="flex-1 flex items-end bg-white rounded-xl overflow-hidden px-2">
            <button
              id="emoji-toggle-btn"
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
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                let foundImage = false;
                for (let i = 0; i < items.length; i++) {
                  if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                      onPasteImage(file);
                      foundImage = true;
                    }
                  }
                }
                if (foundImage) e.preventDefault();
              }}
              placeholder="Type a message"
              className="flex-1 bg-transparent text-[#111b21] placeholder-[#8696a0] py-[10px] px-2 text-[14.5px] focus:outline-none resize-none leading-snug max-h-[100px] min-h-[40px]"
              rows={1}
              disabled={isSending}
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
                    if ((text.trim() || pastedImagesLength > 0) && !isSending) {
                      handleSubmit(e as unknown as React.FormEvent);
                    }
                  }
                }
              }}
            />
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              id="image-upload"
              onChange={onImageUpload}
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
            disabled={(!text.trim() && pastedImagesLength === 0) || isSending}
            className={`group relative shrink-0 w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 ease-out outline-none ${(!text.trim() && pastedImagesLength === 0) && !isSending
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
      </>
    );
  }
);
ChatInputForm.displayName = 'ChatInputForm';
