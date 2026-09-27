import React, { useState, useRef, useEffect } from "react";
import { X, Send, Plus, Trash2, Edit2 } from "lucide-react";
import ImageEditor from "./ImageEditor";

interface MultiImagePreviewModalProps {
  files: File[];
  onAddMore: (files: File[]) => void;
  onRemove: (index: number) => void;
  onUpdateFile: (index: number, newFile: File) => void;
  onClose: () => void;
  onSend: (text: string) => void;
}

export default function MultiImagePreviewModal({
  files,
  onAddMore,
  onRemove,
  onUpdateFile,
  onClose,
  onSend,
}: MultiImagePreviewModalProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [caption, setCaption] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Generate object URLs synchronously for missing ones
  const urlsRef = useRef<Map<File, string>>(new Map());
  useEffect(() => {
    return () => {
      urlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const currentUrls = files.map(file => {
    if (!urlsRef.current.has(file)) {
      urlsRef.current.set(file, URL.createObjectURL(file));
    }
    return urlsRef.current.get(file)!;
  });

  // Cleanup removed files
  useEffect(() => {
    const currentFiles = new Set(files);
    for (const [file, url] of urlsRef.current.entries()) {
      if (!currentFiles.has(file)) {
        URL.revokeObjectURL(url);
        urlsRef.current.delete(file);
      }
    }
  }, [files]);

  // Keep active index in bounds
  if (files.length > 0 && activeIndex >= files.length) {
    setActiveIndex(files.length - 1);
  }

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files) {
        const pastedFiles = Array.from(e.clipboardData.files).filter(file => file.type.startsWith('image/'));
        if (pastedFiles.length > 0) {
          onAddMore(pastedFiles);
        }
      }
    };
    
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [onAddMore]);

  if (files.length === 0) return null;

  const currentObjectUrl = currentUrls[activeIndex] || "";

  if (isEditing && files[activeIndex]) {
    return (
      <ImageEditor 
        file={files[activeIndex]}
        onCancel={() => setIsEditing(false)}
        onSend={(editedFile) => {
          onUpdateFile(activeIndex, editedFile);
          setIsEditing(false);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0b141a] flex flex-col animate-pop-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-transparent absolute top-0 left-0 right-0 z-50 pointer-events-auto">
        <button
          onClick={onClose}
          className="p-2 text-white hover:bg-white/10 rounded-full transition-colors drop-shadow-md"
        >
          <X size={28} />
        </button>
        <div className="flex space-x-3">
          <button
            onClick={() => setIsEditing(true)}
            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors drop-shadow-md"
          >
            <Edit2 size={24} />
          </button>
          <button
            onClick={() => {
              if (files.length === 1) {
                onClose();
              } else {
                onRemove(activeIndex);
                if (activeIndex >= files.length - 1) setActiveIndex(Math.max(0, files.length - 2));
              }
            }}
            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors drop-shadow-md"
            title="Remove Image"
          >
            <Trash2 size={24} />
          </button>
        </div>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 relative flex items-center justify-center bg-[#0b141a] overflow-hidden w-full h-full pt-16 pb-24">
        {files.map((file, idx) => (
          <div 
            key={idx}
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${idx === activeIndex ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'}`}
          >
            <img
              src={currentUrls[idx]}
              alt={`Preview ${idx}`}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        ))}
      </div>

      {/* Bottom Area: Caption and Thumbnails */}
      <div className="bg-[#0b141a]/90 backdrop-blur-md flex flex-col p-4 w-full z-20 absolute bottom-0 left-0 right-0">
        {/* Caption Input */}
        <div className="w-full max-w-4xl mx-auto flex items-center bg-[#2a3942] rounded-full px-4 py-3 shadow-lg mb-4 border border-white/10">
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onSend(caption);
              }
            }}
            placeholder="Add a caption..."
            className="flex-1 bg-transparent outline-none text-[15px] text-white placeholder-slate-400 px-2"
            autoFocus
          />
        </div>

        {/* Thumbnail Tray & Send Button */}
        <div className="w-full max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex-1 flex items-center space-x-3 overflow-x-auto py-2 px-1 scrollbar-hide">
            {files.map((file, idx) => (
              <div
                key={idx}
                className={`relative shrink-0 w-[60px] h-[60px] rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                  activeIndex === idx
                    ? "border-emerald-500 scale-105 shadow-lg"
                    : "border-transparent opacity-50 hover:opacity-100"
                }`}
                onClick={() => setActiveIndex(idx)}
              >
                <img
                  src={currentUrls[idx]}
                  alt="thumb"
                  className="w-full h-full object-cover bg-black/50"
                />
              </div>
            ))}
            <label className="shrink-0 w-[60px] h-[60px] rounded-xl border-2 border-white/20 flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors text-white/70 hover:text-white">
              <Plus size={24} />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onAddMore(Array.from(e.target.files));
                    fileInputRef.current!.value = "";
                  }
                }}
              />
            </label>
          </div>
          <button
            onClick={() => onSend(caption)}
            className="shrink-0 ml-4 w-12 h-12 flex items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition-transform hover:scale-105 hover:bg-emerald-600 active:scale-95"
          >
            <Send size={20} className="mr-0.5" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
