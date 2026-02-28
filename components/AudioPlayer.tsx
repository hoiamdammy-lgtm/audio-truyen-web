'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useAudioStore } from '@/store/useAudioStore'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'

const FALLBACK_COVER = "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&q=80&w=300&h=300"

const formatTime = (time: number) => {
  if (isNaN(time)) return '00:00'
  const h = Math.floor(time / 3600)
  const m = Math.floor((time % 3600) / 60)
  const s = Math.floor(time % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function AudioPlayer() {
  const router = useRouter()
  
  // ==========================================
  // REFS (Trạng thái ngầm)
  // ==========================================
  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const animationRef = useRef<number>()
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null) // MỚI: Tách Analyser ra để giữ kết nối
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const sleepTimerRef = useRef<NodeJS.Timeout>()
  const preloadedRef = useRef<boolean>(false) 
  
  // ==========================================
  // STORE
  // ==========================================
  const { 
    currentChapter, isPlaying, currentTime, playbackRate, playlist, showText,
    setPlaybackRate, setCurrentTime, saveProgress, togglePlay, playNext, playPrev, setShowText 
  } = useAudioStore()
  
  // ==========================================
  // STATE CỤC BỘ
  // ==========================================
  const [progress, setProgress] = useState(0)
  const [displayCurrentTime, setDisplayCurrentTime] = useState('00:00')
  const [duration, setDuration] = useState('00:00')
  const [isMinimized, setIsMinimized] = useState(false)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [sleepTimeRemaining, setSleepTimeRemaining] = useState<number | null>(null)
  const [isVisualizerActive, setIsVisualizerActive] = useState(true)

  const safeNovelId = currentChapter?.novel_id || currentChapter?.novelId;
  const safeCover = currentChapter?.coverUrl || currentChapter?.cover_url || FALLBACK_COVER;
  const safeNovelTitle = currentChapter?.novelTitle || currentChapter?.novel_title || 'Truyện Audio';

  const getPlayableUrl = (url: string) => {
    if (!url) return '';
    return url.startsWith('tg://') ? `/api/telegram-file?fileId=${url.replace('tg://', '')}&type=audio` : url;
  }

  // ==========================================
  // 1. FIX LỖI: HỆ THỐNG VẼ SÓNG NHẠC THÔNG MINH
  // ==========================================
  useEffect(() => {
    if (!audioRef.current || !isVisualizerActive) return;

    try {
      // BƯỚC 1: KHỞI TẠO MẠCH ÂM THANH (Chỉ làm 1 lần duy nhất)
      if (!audioContextRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContext();
      }
      
      const audioCtx = audioContextRef.current;

      if (!analyserRef.current) {
        analyserRef.current = audioCtx.createAnalyser();
        analyserRef.current.fftSize = 64; 
      }

      const analyser = analyserRef.current;

      // Đảm bảo Node kết nối ra loa KHÔNG BAO GIỜ BỊ NGẮT
      if (!sourceNodeRef.current) {
        sourceNodeRef.current = audioCtx.createMediaElementSource(audioRef.current);
        sourceNodeRef.current.connect(analyser);
        analyser.connect(audioCtx.destination);
      }

      if (audioCtx.state === 'suspended' && isPlaying) {
        audioCtx.resume();
      }

      // BƯỚC 2: KIỂM TRA UI ĐỂ VẼ (Nếu thu nhỏ thì DỪNG VẼ, NHƯNG KHÔNG NGẮT NHẠC)
      if (isMinimized || !canvasRef.current) {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        return; 
      }

      // BƯỚC 3: LOGIC VẼ CANVAS
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const ctx = canvasRef.current.getContext('2d')!;

      const draw = () => {
        animationRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
        
        const barWidth = (canvasRef.current!.width / bufferLength) * 2.2;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvasRef.current!.height;
          ctx.fillStyle = `rgba(245, 158, 11, ${(dataArray[i] / 255) + 0.2})`;
          ctx.fillRect(x, canvasRef.current!.height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      }

      draw();
      
      // Cleanup chỉ hủy hàm vẽ hình, KHÔNG ngắt nguồn âm thanh
      return () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
      }
    } catch (e) {
      console.warn("Visualizer bị chặn do CORS/Chính sách", e);
      setIsVisualizerActive(false); 
    }
  }, [currentChapter?.id, isMinimized, isPlaying, isVisualizerActive]);

  // ==========================================
  // 2. ĐỒNG BỘ PLAYBACK & ĐIỀU KHIỂN
  // ==========================================
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [currentChapter?.id, playbackRate, volume, isMuted]);

  useEffect(() => {
    if (isPlaying) {
      setIsError(false);
      const playTimeout = setTimeout(() => {
        audioRef.current?.play().catch(() => { if (isPlaying) togglePlay(); });
      }, 150);
      return () => clearTimeout(playTimeout);
    } else {
      audioRef.current?.pause();
    }
  }, [isPlaying, currentChapter?.id]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const cur = audioRef.current.currentTime;
      const dur = audioRef.current.duration;
      if (dur > 0) {
        setProgress((cur / dur) * 100);
        setDisplayCurrentTime(formatTime(cur));
        setDuration(formatTime(dur));
      }
      setCurrentTime(cur);
      
      if (Math.floor(cur) % 5 === 0 && cur > 0) saveProgress();

      if (dur - cur < 15 && !preloadedRef.current) {
        const nextTrack = playlist[playlist.findIndex(c => c.id === currentChapter.id) + 1];
        if (nextTrack?.audio_url) {
          const p = new Audio();
          p.src = getPlayableUrl(nextTrack.audio_url);
          p.preload = "auto";
          preloadedRef.current = true;
        }
      }
    }
  }

  useEffect(() => { preloadedRef.current = false; }, [currentChapter?.id]);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audioRef.current && audioRef.current.duration) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickPos = (e.clientX - rect.left) / rect.width;
      audioRef.current.currentTime = clickPos * audioRef.current.duration;
      setCurrentTime(audioRef.current.currentTime);
    }
  }

  const changeSpeed = () => {
    const rates = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5];
    const nextRate = rates[(rates.indexOf(playbackRate ?? 1) + 1) % rates.length];
    setPlaybackRate(nextRate);
    toast.success(`Tốc độ: ${nextRate}x`, { position: 'bottom-center', duration: 1500 });
  }

  const skipTime = (amount: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime += amount;
      setCurrentTime(audioRef.current.currentTime);
    }
  }

  const handleNavigateToText = () => {
    if (safeNovelId) {
      router.push(`/truyen/${safeNovelId}/${currentChapter.id}`);
    } else {
      toast.error("Đang đồng bộ dữ liệu...");
    }
  }

  const startSleepTimer = (minutes: number) => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    let seconds = minutes * 60;
    setSleepTimeRemaining(seconds);
    setShowSettings(false);
    toast.success(`Nhạc sẽ tắt sau ${minutes} phút`);

    sleepTimerRef.current = setInterval(() => {
      seconds -= 1;
      setSleepTimeRemaining(seconds);
      if (seconds <= 0) {
        if (useAudioStore.getState().isPlaying) useAudioStore.getState().togglePlay();
        clearInterval(sleepTimerRef.current);
        setSleepTimeRemaining(null);
        toast("😴 Đã tạm dừng nhạc.", { duration: 5000 });
      }
    }, 1000);
  }

  const cancelSleepTimer = () => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    setSleepTimeRemaining(null);
    toast("Đã hủy hẹn giờ");
  }

  useEffect(() => {
    if ('mediaSession' in navigator && currentChapter) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `Tập ${currentChapter.chapter_number || ''}: ${currentChapter.title}`,
        artist: safeNovelTitle,
        artwork: [{ src: safeCover, sizes: '512x512', type: 'image/png' }]
      })
      navigator.mediaSession.setActionHandler('play', togglePlay)
      navigator.mediaSession.setActionHandler('pause', togglePlay)
      navigator.mediaSession.setActionHandler('nexttrack', playNext)
      navigator.mediaSession.setActionHandler('previoustrack', playPrev)
      navigator.mediaSession.setActionHandler('seekbackward', () => skipTime(-15))
      navigator.mediaSession.setActionHandler('seekforward', () => skipTime(15))
    }
  }, [currentChapter, togglePlay, playNext, playPrev, safeCover, safeNovelTitle]);

  if (!currentChapter) return null;

  return (
    <>
      <Toaster />
      
      {/* LÕI AUDIO BẤT TỬ */}
      <audio 
        ref={audioRef} crossOrigin="anonymous" 
        src={getPlayableUrl(currentChapter.audio_url)} 
        onTimeUpdate={handleTimeUpdate} 
        onLoadedMetadata={() => { 
          if(audioRef.current) {
            if(currentTime > 0) audioRef.current.currentTime = currentTime;
            audioRef.current.playbackRate = Number.isFinite(playbackRate) ? playbackRate : 1;
          }
        }} 
        onWaiting={() => setIsLoading(true)} onPlaying={() => setIsLoading(false)} onError={() => setIsError(true)} onEnded={playNext} 
      />

      {isMinimized ? (
        // UI THU NHỎ
        <div className="fixed bottom-6 right-6 z-[60] animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="relative group w-16 h-16 sm:w-20 sm:h-20 cursor-pointer" onClick={() => setIsMinimized(false)}>
            <svg className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none drop-shadow-xl">
              <circle cx="50%" cy="50%" r="46%" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-zinc-900" />
              <circle cx="50%" cy="50%" r="46%" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="289" strokeDashoffset={289 - (progress / 100) * 289} className="text-amber-500 transition-all duration-300" strokeLinecap="round" />
            </svg>
            <div className="absolute inset-1 bg-zinc-900 rounded-full flex items-center justify-center overflow-hidden border-2 border-zinc-800 group-hover:border-amber-500 transition-all shadow-2xl">
              <img src={safeCover} className={`w-full h-full object-cover opacity-50 ${isPlaying ? 'animate-[spin_10s_linear_infinite]' : ''}`} alt="cover" />
              <span className="absolute text-white font-black text-[9px] sm:text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">MỞ</span>
            </div>
            <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="absolute -top-1 -right-1 w-7 h-7 sm:w-8 sm:h-8 bg-amber-500 text-black rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-90 transition-transform z-10">
              {isPlaying ? <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
            </button>
          </div>
        </div>
      ) : (
        // UI MỞ RỘNG
        <div className="fixed bottom-0 left-0 right-0 z-[60] select-none pb-2 px-2 sm:px-4 sm:pb-4 animate-in slide-in-from-bottom duration-500">
          <div className="max-w-[1400px] mx-auto bg-[#0a0a0c]/95 backdrop-blur-3xl border border-zinc-800/80 rounded-2xl sm:rounded-[2rem] shadow-[0_-10px_60px_rgba(0,0,0,0.8)] flex flex-col relative">
            
            <div className="w-full h-1.5 sm:h-2 bg-zinc-900 group cursor-pointer relative overflow-hidden sm:rounded-t-[2rem]" onClick={handleProgressClick}>
              <div className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 transition-all duration-150 shadow-lg relative" style={{ width: `${progress}%` }}>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-[0_0_10px_rgba(255,255,255,0.8)]"></div>
              </div>
            </div>

            <div className="flex items-center justify-between px-3 py-3 sm:px-6 sm:py-4 gap-2 sm:gap-6">
              
              <div className="flex items-center gap-3 w-1/4 sm:w-1/3 min-w-0 cursor-pointer group" onClick={handleNavigateToText}>
                <div className="relative shrink-0 hidden xs:block">
                  <img src={safeCover} className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover shadow-2xl border border-zinc-800 ${isPlaying ? 'animate-[spin_15s_linear_infinite]' : ''}`} alt="" />
                  {isLoading && <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center"><div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div></div>}
                  {!isLoading && !isError && <div className="absolute inset-0 rounded-xl bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><span className="text-[9px] font-black text-white uppercase text-center">Đọc</span></div>}
                  {isError && <div className="absolute inset-0 bg-red-900/80 rounded-xl flex items-center justify-center text-xs">⚠️</div>}
                </div>
                <div className="flex flex-col min-w-0 flex-1 relative h-full justify-center">
                  <p className="text-[9px] sm:text-[10px] text-zinc-500 uppercase font-black truncate group-hover:text-amber-500 transition-colors">{safeNovelTitle}</p>
                  <p className="text-xs sm:text-sm font-bold text-zinc-100 truncate pb-0.5">Tập {currentChapter.chapter_number}: {currentChapter.title}</p>
                  <div className="h-3 sm:h-4 w-24 opacity-40 group-hover:opacity-100 transition-opacity flex items-end">
                    <canvas ref={canvasRef} width={96} height={16} className="w-full h-full" />
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center gap-1 flex-1 shrink-0">
                <div className="flex items-center gap-3 sm:gap-6">
                  <button onClick={() => skipTime(-15)} className="text-zinc-500 hover:text-amber-500 transition-all hidden md:block active:scale-90" title="Lùi 15s"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" /></svg></button>
                  <button onClick={playPrev} className="text-zinc-400 hover:text-white transition-transform hover:scale-110"><svg className="w-6 h-6 sm:w-7 sm:h-7" fill="currentColor" viewBox="0 0 20 20"><path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" /></svg></button>
                  <button onClick={togglePlay} className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all shadow-2xl active:scale-95 border-2 sm:border-4 ${isPlaying ? 'bg-zinc-900 border-zinc-800 text-amber-500 hover:border-amber-500' : 'bg-gradient-to-tr from-amber-500 to-yellow-400 border-transparent text-zinc-950 hover:scale-105'}`}>
                    {isLoading ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : isPlaying ? <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="w-6 h-6 sm:w-8 sm:h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
                  </button>
                  <button onClick={playNext} className="text-zinc-400 hover:text-white transition-transform hover:scale-110"><svg className="w-6 h-6 sm:w-7 sm:h-7" fill="currentColor" viewBox="0 0 20 20"><path d="M11.555 5.168A1 1 0 0010 6v2.798L4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4z" /></svg></button>
                  <button onClick={() => skipTime(15)} className="text-zinc-500 hover:text-amber-500 transition-all hidden md:block active:scale-90" title="Tới 15s"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.334-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" /></svg></button>
                </div>
                <div className="flex items-center gap-2 text-[9px] sm:text-[11px] font-mono text-zinc-500 mt-0.5"><span className="text-zinc-300">{displayCurrentTime}</span><span className="opacity-30">/</span><span>{duration}</span></div>
              </div>

              <div className="flex items-center justify-end gap-1.5 sm:gap-3 w-1/4 sm:w-1/3">
                <div className="hidden lg:flex items-center gap-2 bg-zinc-900/80 p-1.5 rounded-full border border-zinc-800 overflow-hidden w-28 hover:w-32 transition-all">
                  <button onClick={() => setIsMuted(!isMuted)} className="text-zinc-400 hover:text-amber-500 ml-1">{isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}</button>
                  <input type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} onChange={(e) => { setVolume(parseFloat(e.target.value)); setIsMuted(false); }} className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500" />
                </div>
                <button onClick={() => { setShowSettings(!showSettings); setShowPlaylist(false); }} className={`p-2 rounded-xl transition-all border relative ${showSettings ? 'bg-amber-500 text-black border-amber-400' : 'text-zinc-500 hover:text-white border-transparent'}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  {sleepTimeRemaining && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>}
                </button>
                <button onClick={() => { setShowPlaylist(!showPlaylist); setShowSettings(false); }} className={`p-2 rounded-xl transition-all border ${showPlaylist ? 'bg-amber-500 text-black border-amber-400' : 'text-zinc-500 hover:text-white border-transparent'}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                </button>
                <button onClick={() => setIsMinimized(true)} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>
            </div>

            {/* MODAL CÀI ĐẶT */}
            {showSettings && (
              <div className="absolute bottom-full right-4 sm:right-10 w-[280px] bg-zinc-950/98 backdrop-blur-3xl border border-zinc-800 rounded-3xl p-5 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] mb-4 animate-in slide-in-from-bottom-5 fade-in zoom-in-95 z-[70]">
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Tốc độ phát</p>
                    <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md">{playbackRate}x</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[0.75, 1, 1.25, 1.5, 1.75, 2, 2.5].map(rate => (
                      <button key={rate} onClick={() => setPlaybackRate(rate)} className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${playbackRate === rate ? 'bg-amber-500 text-black border-amber-400 shadow-md' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'}`}>{rate}x</button>
                    ))}
                  </div>
                </div>

                <div className="mb-5 pb-5 border-b border-zinc-800/80">
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Hẹn giờ ngủ</p>
                    {sleepTimeRemaining && <span className="text-xs text-red-400 font-mono animate-pulse bg-red-500/10 px-2 py-0.5 rounded-md">{formatTime(sleepTimeRemaining)}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[15, 30, 45, 60].map(m => (
                      <button key={m} onClick={() => startSleepTimer(m)} className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 py-2.5 rounded-xl text-xs font-bold transition-all border border-zinc-800">{m} Phút</button>
                    ))}
                    {sleepTimeRemaining && (
                      <button onClick={cancelSleepTimer} className="col-span-2 bg-red-500 text-white py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-red-500/30 mt-1">HỦY HẸN GIỜ</button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-zinc-100 flex items-center gap-2"><span className="text-amber-500">👁️</span> Đồng bộ văn bản</p>
                    <p className="text-[9px] text-zinc-600 mt-1">Sáng chữ theo giọng đọc</p>
                  </div>
                  <button onClick={() => setShowText(!showText)} className={`w-12 h-6 rounded-full transition-colors relative border ${showText ? 'bg-amber-500 border-amber-400' : 'bg-zinc-900 border-zinc-700'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow-md ${showText ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>
              </div>
            )}

            {/* MODAL PLAYLIST */}
            {showPlaylist && (
              <div className="absolute bottom-full right-2 sm:right-10 w-[95vw] sm:w-[420px] bg-[#0a0a0c]/98 backdrop-blur-3xl border border-zinc-800 rounded-[2rem] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] mb-4 flex flex-col animate-in slide-in-from-bottom-5 fade-in zoom-in-95 max-h-[60vh] z-[70]">
                <div className="flex justify-between items-center p-5 border-b border-zinc-800/50">
                  <div>
                    <h4 className="font-black text-white text-sm">DANH SÁCH TẬP</h4>
                    <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest mt-0.5">{playlist.length} Tập Sẵn Sàng</p>
                  </div>
                  <button onClick={() => setShowPlaylist(false)} className="w-8 h-8 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-500 hover:bg-red-500 hover:text-white transition-all">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
                  {playlist.map(chap => (
                    <button key={chap.id} onClick={() => { useAudioStore.getState().playChapter(chap, playlist); setShowPlaylist(false); }} className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left border transition-all ${chap.id === currentChapter.id ? 'bg-amber-500/10 border-amber-500/30 shadow-inner ring-1 ring-amber-500/20' : 'bg-transparent border-transparent hover:bg-zinc-900/50'}`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono text-xs font-black shrink-0 ${chap.id === currentChapter.id ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-zinc-900 border border-zinc-800 text-zinc-500'}`}>{chap.chapter_number}</div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate leading-tight ${chap.id === currentChapter.id ? 'text-amber-400' : 'text-zinc-300'}`}>{chap.title}</p>
                        {chap.id === currentChapter.id ? (
                           <p className="text-[9px] text-amber-500/80 uppercase font-black tracking-widest mt-1 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></span> Đang phát</p>
                        ) : (
                           <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest mt-1">Sẵn sàng nghe</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Style Cho Cuộn (Scrollbar) */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #fbbf24; }
      `}</style>
    </>
  )
}