import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';

interface CustomAudioPlayerProps {
  src: string;
  autoPreload?: boolean;
}

export default function CustomAudioPlayer({ src, autoPreload = false }: CustomAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(autoPreload);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current && autoPreload) {
      audioRef.current.load();
    }
  }, [autoPreload]);

  const togglePlay = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (!hasLoaded) {
        setIsLoading(true);
        audioRef.current.load();
        
        // Wait for enough data to play
        await new Promise((resolve) => {
          if (!audioRef.current) return resolve(false);
          const handleCanPlay = () => {
            audioRef.current?.removeEventListener('canplay', handleCanPlay);
            resolve(true);
          };
          audioRef.current.addEventListener('canplay', handleCanPlay);
        });
        setHasLoaded(true);
        setIsLoading(false);
      }
      
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err: any) {
        console.error('Error playing audio:', err);
        if (err.name === 'NotSupportedError') {
          alert('This voice note was recorded in an unsupported format and cannot be played on your current browser.');
        }
        setIsPlaying(false);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100 || 0);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const newTime = (parseFloat(e.target.value) / 100) * audioRef.current.duration;
      audioRef.current.currentTime = newTime;
      setProgress(parseFloat(e.target.value));
    }
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Ensure we request an MP3 from Cloudinary for universal browser/webview support
  const getPlayableSrc = (url: string) => {
    if (!url) return url;
    if (url.includes('cloudinary.com') && url.includes('/upload/')) {
      // Replace the extension with .mp3 to trigger Cloudinary on-the-fly transcoding
      return url.replace(/\.[^/.]+$/, '.mp3');
    }
    return url;
  };

  const playableSrc = getPlayableSrc(src);

  return (
    <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 p-2 rounded-2xl w-[240px]">
      <audio
        ref={audioRef}
        src={playableSrc}
        preload={autoPreload ? 'auto' : 'none'}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlaying={() => setIsLoading(false)}
        onWaiting={() => setIsLoading(true)}
      />
      
      <button
        onClick={togglePlay}
        disabled={isLoading && !isPlaying}
        className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors"
      >
        {isLoading && !isPlaying ? (
          <Loader2 size={20} className="animate-spin" />
        ) : isPlaying ? (
          <Pause size={20} fill="currentColor" />
        ) : (
          <Play size={20} fill="currentColor" className="ml-0.5" />
        )}
      </button>

      <div className="flex-1 flex flex-col justify-center">
        <input
          type="range"
          min="0"
          max="100"
          value={progress}
          onChange={handleSeek}
          className="w-full h-1.5 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between mt-1 px-1">
          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
            {formatTime(currentTime)}
          </span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
