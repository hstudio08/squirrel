import React, { useState, useRef, useEffect } from "react";
import { X, Send, RotateCcw, Undo2, Crop, Check } from "lucide-react";
import ReactCrop, { type Crop as CropType } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

interface ImageEditorProps {
  file: File;
  onCancel: () => void;
  onSend: (file: File, caption: string) => void;
}

export default function ImageEditor({ file, onCancel, onSend }: ImageEditorProps) {
  const [caption, setCaption] = useState("");
  const [color, setColor] = useState("#ef4444");
  const [isCropMode, setIsCropMode] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string>("");
  const [cropImageSize, setCropImageSize] = useState({ width: 0, height: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const historyRef = useRef<ImageData[]>([]);
  const [crop, setCrop] = useState<CropType | undefined>({ unit: "%", width: 100, height: 100, x: 0, y: 0 });
  
  const colors = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#000000", "#ffffff"];

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const initCanvas = () => {
    if (imageLoaded && canvasRef.current && containerRef.current && imageRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const img = imageRef.current;

      const container = containerRef.current;
      const maxWidth = container.clientWidth - 80;
      const maxHeight = container.clientHeight - 80;

      let width = img.width;
      let height = img.height;

      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = width * ratio;
      height = height * ratio;

      canvas.width = width;
      canvas.height = height;

      if (ctx) {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      }
      historyRef.current = [];
    }
  };

  useEffect(() => {
    initCanvas();
  }, [imageLoaded]);

  const saveHistoryState = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        historyRef.current.push(ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height));
        if (historyRef.current.length > 20) historyRef.current.shift();
      }
    }
  };

  const undo = () => {
    if (historyRef.current.length > 0 && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        const previousState = historyRef.current.pop();
        if (previousState) {
          ctx.putImageData(previousState, 0, 0);
        }
      }
    }
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    let clientX, clientY;
    if ("touches" in e) {
      const touch = e.touches[0] || (e as React.TouchEvent).changedTouches?.[0];
      if (!touch) return { x: 0, y: 0 };
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startInteraction = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (isCropMode) return;
    setIsDrawing(true);
    saveHistoryState();
    draw(e);
  };

  const stopInteraction = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) ctx.beginPath();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current || isCropMode) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getCoordinates(e);

    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.strokeStyle = color;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const applyCrop = () => {
    if (!crop || !canvasRef.current || crop.width === 0 || crop.height === 0) {
      setIsCropMode(false);
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    saveHistoryState();

    // crop is always stored as PercentCrop
    const targetX = (crop.x / 100) * canvas.width;
    const targetY = (crop.y / 100) * canvas.height;
    const targetWidth = (crop.width / 100) * canvas.width;
    const targetHeight = (crop.height / 100) * canvas.height;

    const croppedImageData = ctx.getImageData(targetX, targetY, targetWidth, targetHeight);

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.putImageData(croppedImageData, 0, 0);

    setIsCropMode(false);
    setCrop(undefined);
  };

  const handleSend = () => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (blob) {
        const editedFile = new File([blob], file.name, { type: "image/jpeg" });
        onSend(editedFile, caption);
      }
    }, "image/jpeg", 0.9);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-pop-in">
      <div className="flex justify-between items-center p-4">
        <button onClick={onCancel} className="p-2 text-slate-800 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
          <X size={24} />
        </button>
        <div className="flex space-x-2">
          {isCropMode ? (
            <button onClick={applyCrop} className="p-2 bg-slate-800 text-white rounded-full transition-colors cursor-pointer">
              <Check size={22} />
            </button>
          ) : (
            <>
              <button onClick={() => {
                if (canvasRef.current) {
                  setCropImageSrc(canvasRef.current.toDataURL());
                  setCropImageSize({ width: canvasRef.current.offsetWidth, height: canvasRef.current.offsetHeight });
                }
                setCrop({ unit: "%", width: 100, height: 100, x: 0, y: 0 });
                setIsCropMode(true);
              }} className="p-2 text-slate-800 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
                <Crop size={22} />
              </button>
              <button onClick={undo} className="p-2 text-slate-800 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
                <Undo2 size={22} />
              </button>
              <button onClick={initCanvas} className="p-2 text-slate-800 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
                <RotateCcw size={22} />
              </button>
            </>
          )}
        </div>
      </div>

      
      <style>{`
        /* Overrides for ReactCrop to make it look like native iOS/WhatsApp cropper */
        .custom-crop .ReactCrop__crop-selection {
          border: 2px solid white !important;
          box-shadow: 0 0 0 9999em rgba(0, 0, 0, 0.5) !important;
          background: transparent !important;
          animation: none !important;
        }
        
        .custom-crop .ReactCrop__drag-handle {
          background: transparent !important;
          border: none !important;
          width: 32px !important;
          height: 32px !important;
        }
        
        .custom-crop .ReactCrop__drag-handle::after {
          display: none !important;
        }
        
        /* Corner Handles (L shapes) */
        .custom-crop .ord-nw {
          border-top: 4px solid white !important;
          border-left: 4px solid white !important;
          top: -2px !important;
          left: -2px !important;
          transform: translate(0, 0) !important;
        }
        .custom-crop .ord-ne {
          border-top: 4px solid white !important;
          border-right: 4px solid white !important;
          top: -2px !important;
          right: -2px !important;
          transform: translate(0, 0) !important;
        }
        .custom-crop .ord-sw {
          border-bottom: 4px solid white !important;
          border-left: 4px solid white !important;
          bottom: -2px !important;
          left: -2px !important;
          transform: translate(0, 0) !important;
        }
        .custom-crop .ord-se {
          border-bottom: 4px solid white !important;
          border-right: 4px solid white !important;
          bottom: -2px !important;
          right: -2px !important;
          transform: translate(0, 0) !important;
        }
        
        /* Edge Handles */
        .custom-crop .ord-n {
          border-top: 4px solid white !important;
          width: 24px !important;
          height: 16px !important;
          top: -2px !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          display: block !important;
        }
        .custom-crop .ord-s {
          border-bottom: 4px solid white !important;
          width: 24px !important;
          height: 16px !important;
          bottom: -2px !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          display: block !important;
        }
        .custom-crop .ord-e {
          border-right: 4px solid white !important;
          width: 16px !important;
          height: 24px !important;
          right: -2px !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
          display: block !important;
        }
        .custom-crop .ord-w {
          border-left: 4px solid white !important;
          width: 16px !important;
          height: 24px !important;
          left: -2px !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
          display: block !important;
        }
        
        /* Rule of Thirds Grid */
        .custom-crop .ReactCrop__rule-of-thirds-vt::before,
        .custom-crop .ReactCrop__rule-of-thirds-vt::after,
        .custom-crop .ReactCrop__rule-of-thirds-hz::before,
        .custom-crop .ReactCrop__rule-of-thirds-hz::after {
          background-color: rgba(255, 255, 255, 0.7) !important;
        }
      `}</style>
      
      <div ref={containerRef} className="flex-1 flex items-center justify-center p-6 overflow-hidden relative">
        <div className="p-3 bg-slate-50 rounded-2xl shadow-xl border border-slate-200 flex items-center justify-center max-w-full max-h-full">
          {isCropMode ? (
            <ReactCrop crop={crop} onChange={(c, pc) => setCrop(pc)} ruleOfThirds className="max-w-full max-h-full custom-crop rounded-md overflow-hidden">
              <img 
                src={cropImageSrc || undefined} 
                className="max-w-full max-h-full object-contain rounded-md" 
                style={cropImageSize.width ? { width: cropImageSize.width, height: cropImageSize.height } : undefined}
                alt="Crop" 
              />
            </ReactCrop>
          ) : (
            <canvas
              ref={canvasRef}
              onMouseDown={startInteraction}
              onMouseUp={stopInteraction}
              onMouseOut={stopInteraction}
              onMouseMove={draw}
              onTouchStart={startInteraction}
              onTouchEnd={stopInteraction}
              onTouchMove={draw}
              className="cursor-crosshair touch-none max-w-full max-h-full object-contain rounded-md"
            />
          )}
        </div>
      </div>

      <div className="p-4 bg-white border-t border-slate-200 pb-[max(env(safe-area-inset-bottom),1rem)]">
        {!isCropMode && (
          <div className="flex justify-center space-x-3 mb-4">
            {colors.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full border-2 transition-transform ${color === c ? 'scale-125 border-slate-400 shadow-sm' : 'border-slate-200 shadow-sm hover:scale-110'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
        
        <div className="flex items-center space-x-3 max-w-4xl mx-auto">
          <div className="flex-1 bg-slate-100 rounded-full px-4 py-3 flex items-center border border-slate-200">
            <input 
              type="text" 
              placeholder="Add a caption..." 
              value={caption}
              onChange={e => setCaption(e.target.value)}
              className="bg-transparent flex-1 outline-none text-slate-800 placeholder-slate-500 text-[15px]"
            />
          </div>
          <button 
            onClick={handleSend}
            className="p-3.5 bg-blue-500 hover:bg-blue-600 rounded-full text-white transition-all shadow-lg hover:shadow-blue-500/30 cursor-pointer"
          >
            <Send size={20} className="ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}
