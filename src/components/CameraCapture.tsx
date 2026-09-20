import React, { useRef, useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' }, // Prefers back camera on mobile
          audio: false 
        });
        
        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        setError(err.message || 'Unable to access camera.');
      }
    };

    startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
          onCapture(file);
        }
      }, 'image/jpeg', 0.9);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-fade-in">
      <div className="absolute top-4 left-4 z-50">
        <button 
          onClick={onClose}
          className="p-3 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white rounded-full transition-colors shadow-sm"
        >
          <X size={24} />
        </button>
      </div>

      {error ? (
        <div className="text-white text-center p-6 max-w-sm bg-slate-900 rounded-2xl border border-slate-800">
          <p className="text-red-400 font-bold mb-2">Camera Access Denied</p>
          <p className="text-sm text-slate-300 mb-6">{error}</p>
          <button 
            onClick={onClose} 
            className="px-6 py-2.5 bg-white text-black font-semibold rounded-full hover:bg-slate-200 transition-colors w-full"
          >
            Go Back
          </button>
        </div>
      ) : (
        <video 
          ref={videoRef}
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover"
        />
      )}

      {!error && (
        <div className="absolute bottom-10 left-0 right-0 flex justify-center pb-[max(env(safe-area-inset-bottom),1rem)] z-50">
          <button 
            onClick={handleCapture}
            className="w-[72px] h-[72px] rounded-full flex items-center justify-center border-[4px] border-white/80 backdrop-blur-md active:scale-95 transition-transform shadow-lg"
          >
            <div className="w-[56px] h-[56px] bg-white rounded-full shadow-sm"></div>
          </button>
        </div>
      )}
    </div>
  );
}
