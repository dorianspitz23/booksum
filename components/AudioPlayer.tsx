
import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, RotateCw, X, Volume2, VolumeX, Maximize2 } from 'lucide-react';

export interface AudioTrack {
  src: string; // Blob URL or remote URL
  title: string;
  author: string;
  coverUrl: string;
}

interface AudioPlayerProps {
  track: AudioTrack;
  onClose: () => void;
  autoPlay?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ track, onClose, autoPlay = true }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  useEffect(() => {
    if (autoPlay && audioRef.current) {
      audioRef.current.play().catch(e => console.error("Autoplay failed", e));
    }
  }, [track.src, autoPlay]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  const skip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime += seconds;
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
    if (newVolume === 0) {
      setIsMuted(true);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] px-2 pb-2 sm:px-6 sm:pb-6 animate-in slide-in-from-bottom-10 duration-500">
      <div className="bg-gray-900/95 backdrop-blur-xl text-white rounded-2xl p-4 shadow-2xl border border-white/10 flex flex-col md:flex-row items-center gap-4 sm:gap-6 relative">
        {/* Background Blur Effect - Wrapped to prevent overflow clipping of the main container affecting popups */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/20 blur-[80px] -mr-16 -mt-16" />
        </div>

        <audio
          ref={audioRef}
          src={track.src}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Track Info */}
        <div className="flex items-center gap-4 w-full md:w-auto min-w-[200px] relative z-10">
          <div className="relative group">
            <img 
              src={track.coverUrl} 
              alt={track.title} 
              className="w-12 h-12 rounded-lg object-cover shadow-md border border-white/10"
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
               <Maximize2 size={16} className="text-white" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-sm truncate leading-tight">{track.title}</h4>
            <p className="text-xs text-gray-400 truncate">{track.author}</p>
          </div>
        </div>

        {/* Controls & Progress */}
        <div className="flex-1 w-full flex flex-col gap-2 relative z-10">
           <div className="flex items-center justify-center gap-4 sm:gap-6">
             {/* Speed Control */}
             <div className="relative">
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="text-xs font-bold text-gray-400 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10"
                  title="Playback Speed"
                >
                  {playbackRate}x
                </button>
                {showSpeedMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSpeedMenu(false)} />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden flex flex-col min-w-[80px] z-50 animate-in slide-in-from-bottom-2 duration-200">
                      {[1, 1.25, 1.5, 1.75, 2].map((rate) => (
                        <button
                          key={rate}
                          onClick={() => {
                            setPlaybackRate(rate);
                            setShowSpeedMenu(false);
                          }}
                          className={`px-4 py-2.5 text-xs font-bold text-left transition-colors hover:bg-gray-700 flex items-center justify-between ${
                            playbackRate === rate ? 'text-orange-500 bg-gray-700/50' : 'text-gray-300'
                          }`}
                        >
                          {rate}x
                          {playbackRate === rate && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
             </div>

             <button 
                onClick={() => skip(-15)} 
                className="relative flex items-center justify-center text-gray-400 hover:text-white transition-colors active:scale-95 w-12 h-12"
                aria-label="Rewind 15 seconds"
             >
               <RotateCcw size={22} strokeWidth={1.5} />
               <span className="absolute text-[9px] font-bold mt-[1px]">15</span>
             </button>
             
             <button 
                onClick={togglePlay}
                className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/20"
             >
                {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="ml-0.5" />}
             </button>

             <button 
                onClick={() => skip(15)} 
                className="relative flex items-center justify-center text-gray-400 hover:text-white transition-colors active:scale-95 w-12 h-12"
                aria-label="Forward 15 seconds"
             >
               <RotateCw size={22} strokeWidth={1.5} />
               <span className="absolute text-[9px] font-bold mt-[1px]">15</span>
             </button>
           </div>
           
           <div className="flex items-center gap-3 text-xs font-medium text-gray-400">
             <span className="min-w-[40px] text-right">{formatTime(progress)}</span>
             <input
                type="range"
                min="0"
                max={duration || 100}
                value={progress}
                onChange={handleSeek}
                className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
             />
             <span className="min-w-[40px]">{formatTime(duration)}</span>
           </div>
        </div>

        {/* Actions - Volume & Close */}
        <div className="flex items-center gap-4 hidden sm:flex relative z-10">
           <div className="flex items-center gap-2">
             <button 
                onClick={toggleMute}
                className="text-gray-400 hover:text-white transition-colors"
                title={isMuted ? "Unmute" : "Mute"}
             >
               {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
             </button>
             
             <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
                aria-label="Volume"
             />
           </div>
           
           <div className="w-px h-6 bg-white/10" />

           <button 
             onClick={onClose}
             className="p-2 hover:bg-white/10 rounded-full transition-colors"
           >
             <X size={20} className="text-gray-400 hover:text-white" />
           </button>
        </div>
        
        {/* Mobile Close Button (Absolute) */}
        <button 
           onClick={onClose}
           className="absolute top-2 right-2 sm:hidden p-1 text-gray-500 z-10"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
