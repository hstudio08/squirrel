import React, { useState, useRef, useEffect } from 'react';
import { Smile, Send, Loader2, Image as ImageIcon, Camera, Mic, Trash2, StopCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { EmojiClickData, Theme } from 'emoji-picker-react';

const EmojiPicker = dynamic(
  () => import('emoji-picker-react'),
  { ssr: false }
);

export interface ChatInputFormProps {
  isSending: boolean;
  onSend: (e?: React.FormEvent, customText?: string) => void;
  onSendAudio?: (file: File | string) => void;
  pastedImagesLength: number;
  onPasteImage: (file: File) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  scrollContainerRef: React.RefObject<any>;
  messagesEndRef: React.RefObject<any>;
  updateTypingStatus: (typing: boolean) => void;
  updateRecordingStatus?: (recording: boolean) => void;
  enterToSend: boolean;
  onCameraClick: () => void;
}

export const ChatInputForm = React.forwardRef<any, ChatInputFormProps>(
  ({ isSending, onSend, onSendAudio, pastedImagesLength, onPasteImage, onImageUpload, scrollContainerRef, messagesEndRef, updateTypingStatus, updateRecordingStatus, enterToSend, onCameraClick }, ref) => {
    const [text, setText] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const prevTextLengthRef = useRef(0);

    // Voice Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [slideOffset, setSlideOffset] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const touchStartX = useRef<number>(0);
    const isHoldingRef = useRef(false);
    const isStartingRef = useRef(false);
    const isCancelledRef = useRef(false);

    useEffect(() => {
      if (recordingTime >= 60 && isRecording) {
        stopRecording(false);
      }
    }, [recordingTime, isRecording]);

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

    useEffect(() => {
      return () => {
        // Cleanup media recorder on unmount
        if (timerRef.current) clearInterval(timerRef.current);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
      };
    }, []);

    const adjustTextareaHeight = (newText: string) => {
      const textarea = textareaRef.current;
      if (textarea) {
        requestAnimationFrame(() => {
          if (newText.length < prevTextLengthRef.current || newText === '') {
            textarea.style.height = 'auto';
          }
          textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
          prevTextLengthRef.current = newText.length;
        });
      }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newVal = e.target.value;
      setText(newVal);
      adjustTextareaHeight(newVal);
      updateTypingStatus(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        updateTypingStatus(false);
      }, 1000);
    };

    const onEmojiClick = (emojiData: EmojiClickData) => {
      setText(prev => {
        const newVal = prev + emojiData.emoji;
        adjustTextareaHeight(newVal);
        return newVal;
      });
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
        prevTextLengthRef.current = 0;
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    };

    const startRecording = async () => {
      if (isStartingRef.current) return;
      isStartingRef.current = true;
      isHoldingRef.current = true;
      isCancelledRef.current = false;
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { VoiceRecorder } = await import('capacitor-voice-recorder');
          
          // Check if already recording to avoid ALREADY_RECORDING error
          const status = await VoiceRecorder.getCurrentStatus();
          if (status.status !== 'NONE') {
            try {
              await VoiceRecorder.stopRecording();
            } catch(e) {}
          }

          const hasPerm = await VoiceRecorder.hasAudioRecordingPermission();
          if (!hasPerm.value) {
            const req = await VoiceRecorder.requestAudioRecordingPermission();
            if (!req.value) {
              alert('Microphone permission denied.');
              isHoldingRef.current = false;
              isStartingRef.current = false;
              return;
            }
          }
          await VoiceRecorder.startRecording();
          
          if (!isHoldingRef.current) {
            try { await VoiceRecorder.stopRecording(); } catch(e) {}
            isStartingRef.current = false;
            return;
          }

          setIsRecording(true);
          if (updateRecordingStatus) updateRecordingStatus(true);
          setRecordingTime(0);
          timerRef.current = setInterval(() => {
            setRecordingTime(prev => prev + 1);
          }, 1000);
          isStartingRef.current = false;
          return; // Native recording started, return early
        }

        // --- Web Fallback ---
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          alert('Microphone not supported in this browser. If you are on mobile, ensure you are using a secure connection (HTTPS) as browsers block microphone access on normal HTTP.');
          isHoldingRef.current = false;
          isStartingRef.current = false;
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        if (!isHoldingRef.current) {
          stream.getTracks().forEach(track => track.stop());
          isStartingRef.current = false;
          return;
        }

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = () => {
          stream.getTracks().forEach(track => track.stop());
          if (!isCancelledRef.current && audioChunksRef.current.length > 0) {
            let mimeType = mediaRecorder.mimeType;
            if (!mimeType) {
              mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
            }
            const extension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
            const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
            const file = new File([audioBlob], `voice_note_${Date.now()}.${extension}`, { type: mimeType });
            if (onSendAudio) {
              onSendAudio(file);
            }
          }
          audioChunksRef.current = [];
        };

        mediaRecorder.start();
        setIsRecording(true);
        if (updateRecordingStatus) updateRecordingStatus(true);
        setRecordingTime(0);
        
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
        isStartingRef.current = false;
      } catch (err) {
        console.error('Failed to start recording', err);
        alert('Microphone access denied or unavailable. Please check your browser permissions.');
        isHoldingRef.current = false;
        isStartingRef.current = false;
      }
    };

    const stopRecording = async (cancel: boolean = false) => {
      isHoldingRef.current = false;
      setSlideOffset(0);
      setIsRecording(false);
      if (updateRecordingStatus) updateRecordingStatus(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);

      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { VoiceRecorder } = await import('capacitor-voice-recorder');
          const result = await VoiceRecorder.stopRecording();
          
          if (cancel) {
            isCancelledRef.current = true;
          } else if (!isCancelledRef.current && result.value && result.value.recordDataBase64) {
            const mimeType = result.value.mimeType || 'audio/aac';
            const dataUri = `data:${mimeType};base64,${result.value.recordDataBase64}`;
            
            if (onSendAudio) {
              onSendAudio(dataUri);
            }
          }
        } else {
          // --- Web Fallback ---
          if (cancel) {
            isCancelledRef.current = true;
            audioChunksRef.current = []; 
          }
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        }
      } catch (err) {
        console.error('Failed to stop recording', err);
      }
    };

    const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const isInputEmpty = !text.trim() && pastedImagesLength === 0;

    return (
      <>
        {showEmojiPicker && !isRecording && (
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
          {isRecording ? (
            <div className="flex-1 flex items-center bg-white rounded-xl overflow-hidden px-4 h-[44px] justify-between shadow-sm animate-fade-in border border-red-100 relative">
              <div className="flex items-center space-x-3 text-red-500 animate-pulse">
                <Mic size={20} className="fill-red-500" />
                <span className="font-medium text-[15px]">{formatTime(recordingTime)}</span>
              </div>
              <div className="text-slate-400 font-medium text-sm flex items-center animate-pulse"
                   style={{ opacity: Math.max(0, 1 - Math.abs(slideOffset) / 80) }}>
                &lt; Slide left to cancel
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-end bg-white rounded-xl overflow-hidden px-2 shadow-sm">
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
                      if (!isInputEmpty && !isSending) {
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
                onClick={() => localStorage.setItem('squirrel_bypass_lock', Date.now().toString())}
                disabled={isSending}
              />
              <label
                htmlFor="image-upload"
                onClick={() => localStorage.setItem('squirrel_bypass_lock', Date.now().toString())}
                className={`shrink-0 p-2 sm:p-3 transition-colors self-end cursor-pointer ${isSending ? 'text-slate-300 pointer-events-none' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {isSending ? <Loader2 size={24} className="animate-spin" strokeWidth={1.5} /> : <ImageIcon size={24} strokeWidth={1.5} />}
              </label>
              <button
                type="button"
                onClick={() => { localStorage.setItem('squirrel_bypass_lock', Date.now().toString()); onCameraClick(); }}
                disabled={isSending}
                className={`shrink-0 p-2 sm:p-3 transition-colors self-end ${isSending ? 'text-slate-300 pointer-events-none' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Camera size={24} strokeWidth={1.5} />
              </button>
            </div>
          )}

          {isInputEmpty ? (
            <button
              type="button"
              disabled={isSending}
              style={{ transform: slideOffset < 0 ? `translateX(${slideOffset}px)` : (isRecording ? 'scale(1.25) translateY(-8px)' : 'none') }}
              onPointerDown={(e) => {
                if (isSending) return;
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                touchStartX.current = e.clientX;
                setSlideOffset(0);
                startRecording();
              }}
              onPointerMove={(e) => {
                if (!isHoldingRef.current) return;
                const distance = touchStartX.current - e.clientX;
                if (distance > 0) {
                  setSlideOffset(-distance);
                }
                if (distance > 100) {
                  stopRecording(true);
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              }}
              onPointerUp={(e) => {
                if (!isHoldingRef.current) return;
                e.currentTarget.releasePointerCapture(e.pointerId);
                stopRecording(false);
              }}
              className={`group relative shrink-0 w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-300 ease-out outline-none shadow-md touch-none ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
            >
              <Mic size={22} strokeWidth={2.5} className="text-white" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSending}
              className="group relative shrink-0 w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 ease-out outline-none bg-blue-500/80   border border-blue-400/50 text-white shadow-[0_4px_16px_rgba(59,130,246,0.25)] hover:bg-blue-500/90 hover:scale-105 active:scale-95"
            >
              {isSending ? (
                <Loader2 size={20} className="animate-spin" strokeWidth={2.5} />
              ) : (
                <Send size={20} strokeWidth={2.5} className="ml-0.5 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform duration-300" />
              )}
            </button>
          )}
        </form>
      </>
    );
  }
);
ChatInputForm.displayName = 'ChatInputForm';
