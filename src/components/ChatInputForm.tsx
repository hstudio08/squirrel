import React, { useState, useRef, useEffect } from 'react';
import { Smile, Send, Loader2, Image as ImageIcon, Camera, Mic, Trash2, StopCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { EmojiClickData, Theme } from 'emoji-picker-react';
import { App as CapacitorApp } from '@capacitor/app';
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
    const [slideOffsetY, setSlideOffsetY] = useState(0);
    const [isLockedRecording, setIsLockedRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const touchStartX = useRef<number>(0);
    const touchStartY = useRef<number>(0);
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
      if (showEmojiPicker && emojiPickerRef.current) {
        setTimeout(() => {
          const scrollable = emojiPickerRef.current?.querySelector('.epr-body');
          if (scrollable) {
            scrollable.scrollTop = 0;
          }
        }, 10);
      }
    }, [showEmojiPicker]);
    
    useEffect(() => {
      let backButtonListener: any = null;
      const initBackButton = async () => {
        try {
          backButtonListener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
            if (showEmojiPicker) {
              setShowEmojiPicker(false);
            } else if (canGoBack) {
              window.history.back();
            }
          });
        } catch (e) {
          console.warn("Capacitor App plugin not available");
        }
      };
      initBackButton();
      return () => {
        if (backButtonListener) {
          backButtonListener.remove();
        }
      };
    }, [showEmojiPicker]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent | TouchEvent) => {
        const target = event.target as Element;
        if (emojiPickerRef.current && !emojiPickerRef.current.contains(target as Node)) {
          if (!target.closest('#chat-input-form')) {
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
        if (newText.length < prevTextLengthRef.current || newText === '') {
          textarea.style.height = 'auto';
        }
        textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
        prevTextLengthRef.current = newText.length;
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
      setSlideOffsetY(0);
      setIsRecording(false);
      setIsLockedRecording(false);
      if (updateRecordingStatus) updateRecordingStatus(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);

      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { VoiceRecorder } = await import('capacitor-voice-recorder');
          
          // Only stop if actually recording
          const status = await VoiceRecorder.getCurrentStatus();
          if (status.status === 'RECORDING') {
            try {
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
            } catch (err: any) {
              // Ignore short recording fetch failures if canceled or short
              if (!cancel) {
                console.error('Failed to fetch recording:', err);
              }
            }
          } else {
             // If not recording yet, startRecording's isHoldingRef check will handle cancellation.
             if (cancel) isCancelledRef.current = true;
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
        console.error('Failed to stop recording cleanly', err);
      }
    };

    const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const isInputEmpty = !text.trim() && pastedImagesLength === 0;

    return (
      <div className="w-full flex flex-col relative z-20 pointer-events-auto">
        {/* Sleek Horizontal Loader */}
        <div className={`absolute -top-1 left-0 w-full h-[2px] bg-transparent overflow-hidden transition-opacity duration-300 z-50 ${isSending ? 'opacity-100' : 'opacity-0'}`}>
          <div className="w-1/2 h-full bg-emerald-500 rounded-full absolute" style={{ animation: 'chatInputLoad 1.5s infinite ease-in-out' }} />
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes chatInputLoad {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(250%); }
            }
          `}} />
        </div>
        <form id="chat-input-form" onSubmit={handleSubmit} className="flex items-end space-x-2 max-w-4xl mx-auto w-full mb-2 pl-3 pr-10 sm:px-8 pointer-events-auto">
          {isRecording ? (
            <div className="flex-1 flex items-center bg-white rounded-full overflow-hidden px-4 h-[44px] justify-between shadow-sm border border-red-400/50 relative">
              <div className="flex items-center space-x-3 text-red-500 animate-pulse">
                <Mic size={20} className="fill-red-500" />
                <span className="font-medium text-[15px]">{formatTime(recordingTime)}</span>
              </div>
              <div className="text-slate-400 font-medium text-[13px] flex items-center animate-pulse gap-2"
                   style={{ opacity: Math.max(0, 1 - Math.abs(slideOffset) / 80 - Math.abs(slideOffsetY) / 80) }}>
                {isLockedRecording ? (
                  <span className="text-emerald-500">Locked</span>
                ) : (
                  <>
                    <span>&lt; Cancel</span>
                    <span className="text-[10px]">|</span>
                    <span>Lock ^</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div 
              className="flex-1 flex items-end bg-white rounded-3xl pl-1 pr-1.5 shadow-sm border border-slate-200 transition-all focus-within:shadow-md focus-within:border-emerald-300"
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (!target.closest('button') && !target.closest('label') && target !== textareaRef.current) {
                  if (showEmojiPicker) {
                    setShowEmojiPicker(false);
                    setTimeout(() => {
                      textareaRef.current?.focus();
                    }, 50);
                  } else {
                    textareaRef.current?.focus();
                  }
                }
              }}
            >
              <button
                id="emoji-toggle-btn"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (showEmojiPicker) {
                    setShowEmojiPicker(false);
                    textareaRef.current?.focus();
                  } else {
                    setShowEmojiPicker(true);
                    textareaRef.current?.blur();
                  }
                }}
                className="shrink-0 p-2.5 sm:p-3 text-slate-500 hover:text-emerald-500 transition-colors self-end mb-0.5"
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
                placeholder="Message"
                className="flex-1 bg-transparent text-black placeholder-slate-400 py-[12px] px-1 text-[16px] focus:outline-none resize-none leading-snug max-h-[120px] min-h-[44px] custom-scrollbar"
                rows={1}
                readOnly={isSending}
                onClick={() => {
                  if (showEmojiPicker) {
                    setShowEmojiPicker(false);
                    setTimeout(() => {
                      textareaRef.current?.focus();
                    }, 50);
                  }
                }}
                onFocus={() => {
                  setShowEmojiPicker(false);
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
              {!text.trim() && (
                <>
                  <label
                    htmlFor="image-upload"
                    onClick={() => localStorage.setItem('squirrel_bypass_lock', Date.now().toString())}
                    className={`shrink-0 p-2 sm:p-2.5 transition-colors self-end mb-0.5 cursor-pointer ${isSending ? 'text-slate-300 pointer-events-none' : 'text-slate-500 hover:text-emerald-500'}`}
                  >
                    <ImageIcon size={22} strokeWidth={1.5} />
                  </label>
                  <button
                    type="button"
                    onClick={() => { localStorage.setItem('squirrel_bypass_lock', Date.now().toString()); onCameraClick(); }}
                    disabled={isSending}
                    className={`shrink-0 p-2 sm:p-2.5 transition-colors self-end mb-0.5 mr-0.5 ${isSending ? 'text-slate-300 pointer-events-none' : 'text-slate-500 hover:text-emerald-500'}`}
                  >
                    <Camera size={22} strokeWidth={1.5} />
                  </button>
                </>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSending || (isInputEmpty && pastedImagesLength === 0)}
            onPointerDown={(e) => e.preventDefault()}
            className={`mr-1 shrink-0 w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full outline-none text-white transition-all duration-300 shadow-sm self-end mb-0.5 ${isSending || (isInputEmpty && pastedImagesLength === 0) ? 'opacity-50 cursor-default bg-emerald-400' : 'active:scale-90 hover:scale-[1.05] bg-emerald-500 cursor-pointer'}`}
          >
            <Send size={20} strokeWidth={2.5} className="ml-1 pr-0.5" />
          </button>
        </form>
        <div 
          className={`w-full overflow-hidden transition-[height] duration-200 ease-out flex justify-center bg-transparent ${
            showEmojiPicker && !isRecording ? 'h-[350px]' : 'h-0'
          }`}
        >
          <div ref={emojiPickerRef} className="w-full max-w-4xl h-[350px]">
            <EmojiPicker 
              emojiStyle={"native" as any}
              onEmojiClick={onEmojiClick}
              theme={Theme.LIGHT}
              lazyLoadEmojis={false}
              searchDisabled
              skinTonesDisabled
              previewConfig={{ showPreview: false }}
              width="100%"
              height={350}
            />
          </div>
        </div>
      </div>
    );
  }
);
ChatInputForm.displayName = 'ChatInputForm';
