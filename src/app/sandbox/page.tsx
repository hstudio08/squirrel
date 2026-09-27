"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, Image as ImageIcon, X, Plus } from 'lucide-react';
import MultiImagePreviewModal from '@/components/MultiImagePreviewModal';

export function MessageInput({ onSend, onPasteImage }: { onSend: (e?: React.FormEvent, caption?: string) => void, onPasteImage: (file: File) => void }) {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSend(undefined, text);
      setText('');
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 p-3 bg-transparent pointer-events-none flex flex-col items-center">
      <form onSubmit={handleSubmit} className="flex items-end space-x-2 w-full max-w-4xl pointer-events-auto bg-transparent">
        <div className="flex-1 flex items-end bg-[#ffffff] rounded-xl overflow-hidden px-2">
          <button type="button" className="shrink-0 p-3 text-slate-500"><Smile size={24} strokeWidth={1.5} /></button>
          <textarea 
            value={text}
            onChange={(e) => setText(e.target.value)}
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            placeholder="Type a message"
            className="flex-1 bg-transparent text-[#111b21] py-[12px] px-2 text-[14.5px] outline-none resize-none min-h-[44px]"
            rows={1}
          />
          <button type="button" className="shrink-0 p-3 text-slate-500"><ImageIcon size={24} strokeWidth={1.5} /></button>
        </div>
        <button 
          type="submit"
          className="shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-[#00a884] text-white transition-all hover:scale-105 active:scale-95"
        >
          <Send size={20} className="mr-0.5" strokeWidth={2.5} />
        </button>
      </form>
    </div>
  );
}

export default function SandboxPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [pastedImages, setPastedImages] = useState<File[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const handleSend = (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToUse = customText !== undefined ? customText : text;
    if (!textToUse.trim() && pastedImages.length === 0) return;
    
    // Add sent message for images if any
    let content = textToUse;
    let imageUrls: string[] = [];
    if (pastedImages.length > 0) {
      imageUrls = pastedImages.map(file => URL.createObjectURL(file));
    }
    
    setMessages(prev => [...prev, { 
      id: Date.now().toString(), 
      text: content, 
      images: imageUrls,
      isMine: true 
    }]);
    setText('');
    setPastedImages([]);
    
    // Simulate received message after 1.5 seconds
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        text: "This is a sandbox received message reply!", 
        images: [],
        isMine: false 
      }]);
    }, 1500);
  };
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto bg-[#efeae2] relative overflow-hidden font-sans">
      <div className="bg-[#008069] text-white p-4 shadow-md z-10 flex items-center justify-center">
        <h1 className="text-xl font-bold">Sandbox Testing UI</h1>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col space-y-2 pb-24"
      >
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-slate-500 opacity-60">
            Type something to see the pop-in animations...
          </div>
        )}
        
        {messages.map(msg => (
          <div 
            key={msg.id} 
            className={`flex w-full ${msg.isMine ? 'justify-end animate-message-sent' : 'justify-start animate-message-received'} mb-2.5`}
          >
            <div 
              className={`max-w-[85%] sm:max-w-[70%] px-2.5 pt-1.5 pb-1 rounded-[22px] shadow-sm border ${msg.isMine ? 'bg-[#d9fdd3] text-[#111b21] rounded-tr-[4px] border-[#c8eed4]' : 'bg-white text-[#111b21] rounded-tl-[4px] border-white'}`}
            >
              <div className="flex flex-col relative pointer-events-none select-none">
                {msg.images && msg.images.length > 0 && (() => {
                  const urls = msg.images;
                  const isGrid = urls.length > 1;
                  const displayUrls = isGrid ? urls.slice(0, 4) : urls;
                  const remainingCount = urls.length > 4 ? urls.length - 4 : 0;
                  
                  return (
                    <div className={`mb-1.5 pointer-events-auto ${isGrid ? 'grid grid-cols-2 gap-[2px] rounded-xl overflow-hidden bg-black/10' : 'rounded-xl overflow-hidden bg-black/5 relative'} animate-pop-in`} style={!isGrid ? { maxWidth: '210px', maxHeight: '300px' } : { width: '100%', maxWidth: '240px' }}>
                      {displayUrls.map((url: string, idx: number) => {
                        const isLastDisplay = idx === 3;
                        const isThirdOfThree = urls.length === 3 && idx === 2;
                        return (
                          <div 
                            key={idx} 
                            className={`relative overflow-hidden cursor-zoom-in active:opacity-80 transition-opacity ${isGrid ? 'aspect-square bg-black/20' : 'w-full h-auto max-h-[400px] flex items-center justify-center'} ${isThirdOfThree ? 'col-span-2 aspect-[2/1]' : ''}`}
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
                            <img src={url} alt="Photo" className={`w-full h-full object-cover ${!isGrid ? 'rounded-xl max-h-[400px]' : ''}`} loading="lazy" />
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
                {msg.text && (
                  <p className="text-[15px] whitespace-pre-wrap break-words leading-snug pr-2">{msg.text}</p>
                )}
                <div className={`flex items-center space-x-1 ${(!msg.text && msg.images && msg.images.length > 0) ? 'absolute bottom-[4px] right-[4px] bg-black/40 text-white/90 rounded-full px-1.5 py-[1px] z-10 backdrop-blur-sm scale-[0.85] origin-bottom-right' : 'mt-0.5 justify-end self-end float-right'}`}>
                  <div className="flex items-center space-x-1">
                    <span className={`text-[10.5px] font-medium tracking-tight ${(!msg.text && msg.images && msg.images.length > 0) ? 'text-white' : 'text-black/45'}`}>
                      10:45 AM
                    </span>
                    {msg.isMine && (
                      <div className="flex items-center ml-1 space-x-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${(!msg.text && msg.images && msg.images.length > 0) ? 'bg-[#4ade80] shadow-[0_0_2px_rgba(74,222,128,0.8)]' : 'bg-[#25D366] shadow-[0_0_2px_rgba(37,211,102,0.5)]'}`} />
                        <div className={`w-1.5 h-1.5 rounded-full ${(!msg.text && msg.images && msg.images.length > 0) ? 'bg-[#4ade80] shadow-[0_0_2px_rgba(74,222,128,0.8)]' : 'bg-[#25D366] shadow-[0_0_2px_rgba(37,211,102,0.5)]'}`} />
                      </div>
                    )}
                  </div>
                  {msg.isMine && (
                    <span className={`text-[10.5px] font-bold tracking-tight ml-1 ${(!msg.text && msg.images && msg.images.length > 0) ? 'text-blue-300' : 'text-blue-600'}`}>
                      10:46 AM
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <MultiImagePreviewModal
        files={pastedImages}
        onAddMore={(files) => setPastedImages((prev) => [...prev, ...files])}
        onRemove={(idx) => setPastedImages((prev) => prev.filter((_, i) => i !== idx))}
        onUpdateFile={(idx, newFile) => setPastedImages(prev => prev.map((f, i) => i === idx ? newFile : f))}
        onClose={() => setPastedImages([])}
        onSend={(caption) => {
          setText('');
          handleSend(undefined, caption);
        }}
      />
      <MessageInput onSend={handleSend} onPasteImage={(file) => setPastedImages(prev => [...prev, file])} />
    </div>
  );
}
