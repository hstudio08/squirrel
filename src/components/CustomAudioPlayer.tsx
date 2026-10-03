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
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getAudioUrl = (url: string) => {
    if (!url) return url;
    if (url.includes('cloudinary.com')) {
      // Remove any existing f_mp3,q_auto if it was already added by mistake in DB
      let cleanUrl = url.replace('/upload/f_mp3,q_auto/', '/upload/');
      cleanUrl = cleanUrl.replace('/upload/f_mp3/', '/upload/');
      
      // Replace the extension with .mp3 to force audio-only container
      // This prevents Android MediaPlayer from detecting it as a video
      // and triggering Smart Stay (front camera polling).
      try {
        const urlObj = new URL(cleanUrl);
        const pathParts = urlObj.pathname.split('.');
        if (pathParts.length > 1) {
          pathParts.pop();
        }
        urlObj.pathname = pathParts.join('.') + '.mp3';
        return urlObj.toString();
      } catch (e) {
        return cleanUrl;
      }
    }
    return url;
  };
  
  const audioSrc = getAudioUrl(src);

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
      setIsLoading(true);
      try {
        // Must call play() synchronously in the event handler to bypass mobile autoplay restrictions
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
        setIsLoading(false);
        setIsPlaying(true);
      } catch (err: any) {
        console.error('Error playing audio:', err);
        setIsLoading(false);
        if (err.name === 'NotSupportedError') {
          console.error('Audio format unsupported, it might be transcoding...');
        } else if (err.name === 'NotAllowedError') {
          console.warn('Playback blocked by browser policy. Ensure user interaction.');
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

  return (
    <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 p-2 rounded-2xl w-[240px]">
      <audio
        ref={audioRef}
        src={audioSrc}
        preload={autoPreload ? 'auto' : 'metadata'}
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
