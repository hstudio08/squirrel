import React, { useRef, useState, useEffect } from 'react';
import { X, RefreshCcw } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
  const [zoom, setZoom] = useState(1);
  const [zoomMin, setZoomMin] = useState(1);
  const [zoomMax, setZoomMax] = useState(5);
  const [hasNativeZoom, setHasNativeZoom] = useState(false);
  const initialPinchDistance = useRef<number | null>(null);
  const initialZoom = useRef<number>(1);

  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { Camera } = await import('@capacitor/camera');
          const status = await Camera.checkPermissions();
          if (status.camera !== 'granted') {
            const req = await Camera.requestPermissions();
            if (req.camera !== 'granted') {
              setError('Camera permission denied.');
              return;
            }
          }
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode }, 
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

        const track = stream.getVideoTracks()[0];
        if (track && track.getCapabilities) {
          const caps = track.getCapabilities() as any;
          if (caps.zoom) {
            setHasNativeZoom(true);
            setZoomMin(caps.zoom.min || 1);
            setZoomMax(caps.zoom.max || 5);
            setZoom(caps.zoom.min || 1);
          } else {
            setHasNativeZoom(false);
            setZoomMin(1);
            setZoomMax(5);
            setZoom(1);
          }
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
  }, [facingMode]);

  useEffect(() => {
    if (streamRef.current && hasNativeZoom) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        track.applyConstraints({
          advanced: [{ zoom }]
        } as any).catch((e) => console.log('Zoom apply error:', e));
      }
    }
  }, [zoom, hasNativeZoom]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    setZoom(hasNativeZoom ? zoomMin : 1);
  };

  const handleCapture = () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    const w = videoRef.current.videoWidth;
    const h = videoRef.current.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Apply mirroring for selfies
      if (facingMode === 'user') {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }

      // Apply zoom crop if fake zoom
      let sx = 0;
      let sy = 0;
      let sWidth = w;
      let sHeight = h;
      
      if (!hasNativeZoom) {
        sWidth = w / zoom;
        sHeight = h / zoom;
        sx = (w - sWidth) / 2;
        sy = (h - sHeight) / 2;
      }

      ctx.drawImage(videoRef.current, sx, sy, sWidth, sHeight, 0, 0, w, h);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
          onCapture(file);
        }
      }, 'image/jpeg', 0.9);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      initialPinchDistance.current = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      initialZoom.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance.current !== null) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      const scale = distance / initialPinchDistance.current;
      const newZoom = Math.min(Math.max(zoomMin, initialZoom.current * scale), zoomMax);
      setZoom(newZoom);
    }
  };

  const handleTouchEnd = () => {
    initialPinchDistance.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    setZoom(prev => Math.min(Math.max(zoomMin, prev - e.deltaY * 0.01), zoomMax));
  };

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-fade-in touch-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      <div className="absolute top-4 left-4 z-50 flex items-center space-x-4">
        <button 
          onClick={onClose}
          className="p-3 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white rounded-full transition-colors shadow-sm"
        >
          <X size={24} />
        </button>
      </div>
      
      <div className="absolute top-4 right-4 z-50">
        <button 
          onClick={toggleCamera}
          className="p-3 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white rounded-full transition-colors shadow-sm"
        >
          <RefreshCcw size={24} />
        </button>
      </div>

      {error ? (
        <div className="text-white text-center p-6 max-w-sm bg-slate-900 rounded-2xl border border-slate-800 z-50">
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
        <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted 
            style={{ 
              transform: `${!hasNativeZoom ? `scale(${zoom}) ` : ''}${facingMode === 'user' ? 'scaleX(-1)' : ''}`,
              transition: 'transform 0.1s ease-out'
            }}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {!error && (
        <>
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 w-64 z-50 flex items-center space-x-3 bg-black/40 p-2 rounded-full backdrop-blur-md">
            <span className="text-white text-xs font-medium w-8 text-center">{zoomMin}x</span>
            <input 
              type="range" 
              min={zoomMin} 
              max={zoomMax} 
              step="0.1" 
              value={zoom} 
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-white"
            />
            <span className="text-white text-xs font-medium w-8 text-center">{zoomMax}x</span>
          </div>

          <div className="absolute bottom-10 left-0 right-0 flex justify-center pb-[max(env(safe-area-inset-bottom),1rem)] z-50">
            <button 
              onClick={handleCapture}
              className="w-[72px] h-[72px] rounded-full flex items-center justify-center border-[4px] border-white/80 backdrop-blur-md active:scale-95 transition-transform shadow-lg"
            >
              <div className="w-[56px] h-[56px] bg-white rounded-full shadow-sm"></div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
