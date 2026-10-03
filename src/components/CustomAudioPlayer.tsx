import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';
import { Howl } from 'howler';

interface CustomAudioPlayerProps {
  src: string;
  autoPreload?: boolean;
  onPlay?: () => void;
}

export default function CustomAudioPlayer({ src, autoPreload = false, onPlay }: CustomAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  const soundRef = useRef<Howl | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Determine format to help Howler parse raw blobs
    let format = ['mp3'];
    if (src.startsWith('blob:')) {
      format = ['aac', 'm4a', 'webm', 'mp3']; // Fallbacks for blob
    } else {
      const ext = src.split('.').pop()?.split('?')[0];
      if (ext) format = [ext];
    }

    soundRef.current = new Howl({
      src: [src],
      format: format,
      html5: true, // Use HTML5 Audio to avoid Web Audio API decodeAudioData errors
      preload: autoPreload,
      onload: () => {
        setIsLoading(false);
        setDuration(soundRef.current?.duration() || 0);
      },
      onplay: () => {
        setIsPlaying(true);
        setIsLoading(false);
        startTimer();
        if (onPlay) onPlay();
      },
      onpause: () => {
        setIsPlaying(false);
        stopTimer();
      },
      onstop: () => {
        setIsPlaying(false);
        stopTimer();
        setCurrentTime(0);
        setProgress(0);
      },
      onend: () => {
        setIsPlaying(false);
        stopTimer();
        setCurrentTime(0);
        setProgress(0);
      },
      onloaderror: (id, err) => {
        console.error('Howler load error:', err);
        setIsLoading(false);
        setIsPlaying(false);
      },
      onplayerror: (id, err) => {
        console.error('Howler play error:', err);
        soundRef.current?.once('unlock', () => {
          soundRef.current?.play();
        });
      }
    });

    return () => {
      stopTimer();
      if (soundRef.current) {
        soundRef.current.unload();
      }
    };
  }, [src, autoPreload]);

  const startTimer = () => {
    stopTimer();
    timerRef.current = setInterval(() => {
      if (soundRef.current && soundRef.current.playing()) {
        const seek = soundRef.current.seek() as number;
        setCurrentTime(seek);
        const dur = soundRef.current.duration();
        if (dur) {
          setProgress((seek / dur) * 100);
        }
      }
    }, 100);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const togglePlay = () => {
    if (!soundRef.current) return;

    if (isPlaying) {
      soundRef.current.pause();
    } else {
      if (soundRef.current.state() === 'unloaded') {
        setIsLoading(true);
        soundRef.current.load();
      }
      setIsLoading(true); // Will be set to false in onplay or onload
      soundRef.current.play();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (soundRef.current) {
      const percent = parseFloat(e.target.value);
      const dur = soundRef.current.duration();
      if (dur) {
        const newTime = (percent / 100) * dur;
        soundRef.current.seek(newTime);
        setCurrentTime(newTime);
        setProgress(percent);
      }
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
