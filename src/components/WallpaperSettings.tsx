'use client';
import React, { useState, useEffect, useRef } from 'react';
import { WallpaperSettings, defaultSettings, getWallpaperSettings, saveWallpaperSettings, saveCustomWallpaper, getCustomWallpapers, deleteCustomWallpaper, getWallpaperUrl } from '@/lib/wallpaper';
import { Image as ImageIcon, Plus, Trash2, X } from 'lucide-react';

export default function WallpaperSettingsPanel() {
  const [settings, setSettings] = useState<WallpaperSettings>(defaultSettings);
  const [customList, setCustomList] = useState<{id: string, url: string}[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getWallpaperSettings().then(s => setSettings(s));
    getCustomWallpapers().then(c => setCustomList(c));
  }, []);

  useEffect(() => {
    getWallpaperUrl(settings).then(url => setPreviewUrl(url));
    saveWallpaperSettings(settings);
  }, [settings]);

  const handlePresetSelect = (id: string) => {
    setSettings({ ...settings, type: 'preset', id });
  };

  const handleCustomSelect = (id: string) => {
    setSettings({ ...settings, type: 'custom', id });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const id = await saveCustomWallpaper(file);
      const url = URL.createObjectURL(file);
      setCustomList(prev => [...prev, { id, url }]);
      setSettings({ ...settings, type: 'custom', id });
    }
  };

  const handleDeleteCustom = async (id: string) => {
    await deleteCustomWallpaper(id);
    setCustomList(prev => prev.filter(x => x.id !== id));
    if (settings.type === 'custom' && settings.id === id) {
      setSettings({ ...settings, type: 'preset', id: 'wp1.jpg' });
    }
  };

  // Generate 15 preset items
  const presets = Array.from({ length: 15 }, (_, i) => `wp${i + 1}.jpg`);

  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 p-4 w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-black font-semibold text-[16px]">Chat Wallpaper</h4>
          <p className="text-gray-500 text-[13px] mt-0.5">Customize your chat background</p>
        </div>
      </div>

      {/* Live Preview */}
      <div className="w-full h-48 rounded-2xl mb-4 relative overflow-hidden bg-zinc-900 flex items-center justify-center border border-gray-200">
        {previewUrl ? (
          <img 
            src={previewUrl} 
            alt="Wallpaper Preview" 
            className="absolute inset-0 w-full h-full object-cover transition-all duration-300 ease-in-out"
            style={{ 
              opacity: settings.opacity / 100, 
              filter: `blur(${settings.blur}px)` 
            }}
          />
        ) : (
          <div className="text-gray-500 text-sm">No Wallpaper</div>
        )}
        {/* Mock Chat UI */}
        <div className="z-10 bg-white/80 backdrop-blur-md px-4 py-2 rounded-full text-black text-xs shadow-sm self-end mb-4 font-medium">
          Hello! How are you?
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="text-xs font-semibold text-gray-700 flex justify-between mb-1">
            <span>Opacity</span>
            <span>{settings.opacity}%</span>
          </label>
          <input 
            type="range" 
            min="0" max="100" 
            value={settings.opacity} 
            onChange={e => setSettings({...settings, opacity: Number(e.target.value)})}
            className="w-full accent-blue-500 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700 flex justify-between mb-1">
            <span>Blur</span>
            <span>{settings.blur}px</span>
          </label>
          <input 
            type="range" 
            min="0" max="20" step="1"
            value={settings.blur} 
            onChange={e => setSettings({...settings, blur: Number(e.target.value)})}
            className="w-full accent-blue-500 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      <div className="mb-2">
        <h5 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Presets</h5>
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 h-40 overflow-y-auto pr-1">
          {presets.map(wp => (
            <button 
              key={wp}
              onClick={() => handlePresetSelect(wp)}
              className={`w-full aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                settings.type === 'preset' && settings.id === wp 
                  ? 'border-blue-500 scale-95 shadow-md' 
                  : 'border-transparent hover:scale-95'
              }`}
            >
              <img src={`/wallpapers/${wp}`} alt={wp} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <h5 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider flex items-center justify-between">
          <span>My Wallpapers</span>
          <button onClick={() => fileInputRef.current?.click()} className="text-blue-500 flex items-center gap-1 hover:text-blue-600">
            <Plus size={14} /> Add
          </button>
        </h5>
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          className="hidden" 
          onClick={() => localStorage.setItem('squirrel_bypass_lock', Date.now().toString())}
          onChange={handleUpload} 
        />
        
        {customList.length === 0 ? (
          <div className="text-center py-6 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
            <ImageIcon size={24} className="mx-auto text-gray-300 mb-2" />
            <p className="text-xs text-gray-400">No custom wallpapers added.</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {customList.map(item => (
              <div key={item.id} className="relative group aspect-square rounded-xl overflow-hidden">
                <button 
                  onClick={() => handleCustomSelect(item.id)}
                  className={`w-full h-full border-2 transition-all ${
                    settings.type === 'custom' && settings.id === item.id 
                      ? 'border-blue-500 scale-95 shadow-md' 
                      : 'border-transparent hover:scale-95'
                  }`}
                >
                  <img src={item.url} alt="custom" className="w-full h-full object-cover" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteCustom(item.id); }}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-80 hover:opacity-100"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
