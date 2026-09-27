import React, { useState, useRef, useEffect } from "react";
import { X, Send, RotateCcw, Undo2, Crop, Check, Type, PenTool } from "lucide-react";
import ReactCrop, { type Crop as CropType } from "react-image-crop";
import Draggable from "react-draggable";
import "react-image-crop/dist/ReactCrop.css";

interface ImageEditorProps {
  file: File;
  onCancel: () => void;
  onSend: (file: File) => void;
}



export default function ImageEditor({ file, onCancel, onSend }: ImageEditorProps) {
  const [color, setColor] = useState("#ef4444");
  const [thickness, setThickness] = useState(4);
  const [activeTool, setActiveTool] = useState<"doodle" | "crop">("doodle");
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
  const fonts = ["sans-serif", "serif", "monospace", "cursive"];
  const sizes = [16, 24, 32, 48, 64];

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
      const maxWidth = container.clientWidth - 40;
      const maxHeight = container.clientHeight - 40;

      let width = img.width;
      let height = img.height;

      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = width * ratio;
      height = height * ratio;

      canvas.width = width;
      canvas.height = height;
      
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";

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
    
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startInteraction = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (activeTool !== "doodle") return;
    if ("touches" in e && e.touches.length > 1) return; // Allow zooming
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
    if (!isDrawing || !canvasRef.current || activeTool !== "doodle") return;
    if ("touches" in e && e.touches.length > 1) {
       setIsDrawing(false);
       if (canvasRef.current) canvasRef.current.getContext("2d")?.beginPath();
       return;
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getCoordinates(e);

    ctx.lineWidth = thickness;
    ctx.lineCap = "round";
    ctx.strokeStyle = color;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const applyCrop = () => {
    if (!crop || !canvasRef.current || crop.width === 0 || crop.height === 0) {
      setActiveTool("doodle");
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    saveHistoryState();

    const targetX = (crop.x / 100) * canvas.width;
    const targetY = (crop.y / 100) * canvas.height;
    const targetWidth = (crop.width / 100) * canvas.width;
    const targetHeight = (crop.height / 100) * canvas.height;

    const croppedImageData = ctx.getImageData(targetX, targetY, targetWidth, targetHeight);

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    canvas.style.width = targetWidth + "px";
    canvas.style.height = targetHeight + "px";
    
    ctx.putImageData(croppedImageData, 0, 0);

    setActiveTool("doodle");
    setCrop(undefined);
  };
  
  const handleSendAction = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    
    canvas.toBlob((blob) => {
      if (blob) {
        const editedFile = new File([blob], file.name, { type: "image/jpeg" });
        onSend(editedFile);
      }
    }, "image/jpeg", 0.9);
  };



  return (
    <div className="fixed inset-0 z-[200] bg-[#0b141a] flex flex-col animate-pop-in">
      <div className="flex justify-between items-center p-4 bg-[#202c33]">
        <button onClick={onCancel} className="p-2 text-white hover:bg-slate-700 rounded-full transition-colors cursor-pointer">
          <X size={24} />
        </button>
        <div className="flex space-x-2">
          {activeTool === "crop" ? (
            <button onClick={applyCrop} className="p-2 bg-teal-500 text-white rounded-full transition-colors cursor-pointer">
              <Check size={22} />
            </button>
          ) : (
            <>
              <button onClick={() => {
                if (canvasRef.current) {
                  setCropImageSrc(canvasRef.current.toDataURL());
                  setCropImageSize({ width: parseFloat(canvasRef.current.style.width), height: parseFloat(canvasRef.current.style.height) });
                }
                setCrop({ unit: "%", width: 100, height: 100, x: 0, y: 0 });
                setActiveTool("crop");
              }} className="p-2 rounded-full transition-colors cursor-pointer text-white hover:bg-slate-700">
                <Crop size={22} />
              </button>
              <button onClick={() => setActiveTool("doodle")} className={`p-2 rounded-full transition-colors cursor-pointer ${activeTool === 'doodle' ? 'bg-slate-700 text-teal-400' : 'text-white hover:bg-slate-700'}`}>
                <PenTool size={22} />
              </button>
              <button onClick={undo} className="p-2 text-white hover:bg-slate-700 rounded-full transition-colors cursor-pointer">
                <Undo2 size={22} />
              </button>
              <button onClick={initCanvas} className="p-2 text-white hover:bg-slate-700 rounded-full transition-colors cursor-pointer" title="Reset image">
                <RotateCcw size={22} />
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        .custom-crop .ReactCrop__crop-selection { border: 2px solid white !important; box-shadow: 0 0 0 9999em rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(0,0,0,0.5) !important; background: transparent !important; animation: none !important; }
        .custom-crop .ReactCrop__drag-handle { background: transparent !important; border: none !important; width: 32px !important; height: 32px !important; }
        .custom-crop .ReactCrop__drag-handle::after { display: none !important; }
        .custom-crop .ord-nw { border-top: 4px solid white !important; border-left: 4px solid white !important; top: -2px !important; left: -2px !important; transform: translate(0, 0) !important; filter: drop-shadow(1px 1px 1px rgba(0,0,0,0.8)); }
        .custom-crop .ord-ne { border-top: 4px solid white !important; border-right: 4px solid white !important; top: -2px !important; right: -2px !important; transform: translate(0, 0) !important; filter: drop-shadow(-1px 1px 1px rgba(0,0,0,0.8)); }
        .custom-crop .ord-sw { border-bottom: 4px solid white !important; border-left: 4px solid white !important; bottom: -2px !important; left: -2px !important; transform: translate(0, 0) !important; filter: drop-shadow(1px -1px 1px rgba(0,0,0,0.8)); }
        .custom-crop .ord-se { border-bottom: 4px solid white !important; border-right: 4px solid white !important; bottom: -2px !important; right: -2px !important; transform: translate(0, 0) !important; filter: drop-shadow(-1px -1px 1px rgba(0,0,0,0.8)); }
        .custom-crop .ord-n { border-top: 4px solid white !important; width: 24px !important; height: 16px !important; top: -2px !important; left: 50% !important; transform: translateX(-50%) !important; display: block !important; filter: drop-shadow(0px 1px 1px rgba(0,0,0,0.8)); }
        .custom-crop .ord-s { border-bottom: 4px solid white !important; width: 24px !important; height: 16px !important; bottom: -2px !important; left: 50% !important; transform: translateX(-50%) !important; display: block !important; filter: drop-shadow(0px -1px 1px rgba(0,0,0,0.8)); }
        .custom-crop .ord-e { border-right: 4px solid white !important; width: 16px !important; height: 24px !important; right: -2px !important; top: 50% !important; transform: translateY(-50%) !important; display: block !important; filter: drop-shadow(-1px 0px 1px rgba(0,0,0,0.8)); }
        .custom-crop .ord-w { border-left: 4px solid white !important; width: 16px !important; height: 24px !important; left: -2px !important; top: 50% !important; transform: translateY(-50%) !important; display: block !important; filter: drop-shadow(1px 0px 1px rgba(0,0,0,0.8)); }
        .custom-crop .ReactCrop__rule-of-thirds-vt::before, .custom-crop .ReactCrop__rule-of-thirds-vt::after, .custom-crop .ReactCrop__rule-of-thirds-hz::before, .custom-crop .ReactCrop__rule-of-thirds-hz::after { background-color: rgba(255, 255, 255, 0.7) !important; }
      `}</style>
      
      <div ref={containerRef} className="flex-1 flex items-center justify-center p-6 overflow-hidden relative">
        <div className="relative w-full h-full flex items-center justify-center" style={{ touchAction: activeTool === 'doodle' ? 'none' : 'auto' }}>
          
          <div style={{ display: activeTool === "crop" ? "flex" : "none" }} className="w-full h-full absolute inset-0 items-center justify-center">
            {cropImageSrc && (
              <ReactCrop crop={crop} onChange={(c, pc) => setCrop(pc)} ruleOfThirds className="max-w-full max-h-full custom-crop rounded-md overflow-hidden">
                <img 
                  src={cropImageSrc} 
                  className="max-w-full max-h-full object-contain rounded-md" 
                  style={cropImageSize.width ? { width: cropImageSize.width, height: cropImageSize.height } : undefined}
                  alt="Crop" 
                />
              </ReactCrop>
            )}
          </div>
          
          <div style={{ display: activeTool !== "crop" ? "flex" : "none" }} className="w-full h-full absolute inset-0 items-center justify-center">
            <canvas
              ref={canvasRef}
              onMouseDown={startInteraction}
              onMouseUp={stopInteraction}
              onMouseOut={stopInteraction}
              onMouseMove={draw}
              onTouchStart={startInteraction}
              onTouchEnd={stopInteraction}
              onTouchMove={draw}
              className={`${activeTool === 'doodle' ? 'cursor-crosshair' : 'cursor-default'} max-w-full max-h-full object-contain rounded-md shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2ZmZiIgLz4KPHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjY2NjIiAvPgo8cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iI2NjYyIgLz4KPC9zdmc+')] bg-repeat ring-1 ring-white/10`}
            />
          </div>
        </div>
      </div>

      {activeTool !== 'crop' && (
        <div className="p-4 bg-[#202c33] border-t border-slate-700">
          
          {activeTool === 'doodle' && (
            <div className="flex justify-center space-x-6 mb-4 max-w-md mx-auto items-center">
              <span className="text-white text-xs opacity-70">Thickness:</span>
              <input 
                type="range" min="1" max="20" value={thickness} onChange={(e) => setThickness(Number(e.target.value))}
                className="flex-1 accent-teal-500"
              />
            </div>
          )}

          {activeTool === 'doodle' && (
            <div className="flex justify-center space-x-3 mb-4">
              {colors.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${color === c ? 'scale-125 border-teal-400 shadow-lg' : 'border-slate-500 shadow-sm hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
          
          <div className="flex items-center justify-center space-x-3 max-w-4xl mx-auto">
            <button 
              onClick={handleSendAction}
              className="px-6 py-2.5 bg-teal-500 hover:bg-teal-600 rounded-full text-white font-medium transition-all shadow-lg hover:shadow-teal-500/30 cursor-pointer focus:outline-none flex items-center gap-2"
            >
              <Check size={20} />
              <span>Done</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
