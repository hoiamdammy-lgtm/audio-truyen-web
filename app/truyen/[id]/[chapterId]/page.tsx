'use client'

import { useState, useEffect, use, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAudioStore } from '@/store/useAudioStore'

export default function TextReaderPage({ params }: { params: Promise<{ id: string, chapterId: string }> }) {
  const { id: novelId, chapterId } = use(params)
  const router = useRouter()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // State dữ liệu
  const [novel, setNovel] = useState<any>(null)
  const [chapter, setChapter] = useState<any>(null)
  const [paragraphs, setParagraphs] = useState<string[]>([])
  const [fontSize, setFontSize] = useState(20)
  const [isLoadingText, setIsLoadingText] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [audioProgress, setAudioProgress] = useState(0)

  // Lấy dữ liệu từ Store
  const { 
    currentChapter, 
    isPlaying, 
    playChapter, 
    showText, 
    setShowText,
    playbackRate 
  } = useAudioStore()

  // --- THUẬT TOÁN ĐỒNG BỘ CHÍNH XÁC (Character Weight) ---
  const syncData = useMemo(() => {
    let totalChars = 0;
    const offsets = paragraphs.map(p => {
      totalChars += p.length;
      return totalChars;
    });
    return { totalChars, offsets };
  }, [paragraphs]);

  // 1. ĐỒNG BỘ CHƯƠNG (Audio nhảy -> Chữ nhảy)
  useEffect(() => {
    if (currentChapter && currentChapter.id !== chapterId && currentChapter.novel_id === novelId) {
      router.replace(`/truyen/${novelId}/${currentChapter.id}`);
    }
  }, [currentChapter?.id, chapterId, novelId]);

  // 2. NẠP DỮ LIỆU TRUYỆN & CHƯƠNG
  useEffect(() => {
    const fetchData = async () => {
      const { data: nData } = await supabase.from('novels').select('*').eq('id', novelId).single()
      setNovel(nData)
      
      const { data: caps } = await supabase.from('chapters')
        .select('*')
        .eq('novel_id', novelId)
        .order('chapter_number', { ascending: true })
      
      if (caps) {
        const cur = caps.find(c => c.id === chapterId)
        if (cur) {
          setChapter(cur)
          // Nếu bài đang phát khác với URL, ra lệnh phát bài này
          if (cur.audio_url && currentChapter?.id !== cur.id) {
            playChapter(cur, caps);
          }
          // Nạp Text (Dù là Resume hay nghe mới đều nạp)
          if (cur.text_url) fetchTextContent(cur.text_url);
        }
      }
    }
    fetchData()
  }, [novelId, chapterId]);

  const fetchTextContent = async (url: string) => {
    setIsLoadingText(true)
    try {
      const fetchUrl = url.startsWith('tg://') 
        ? `/api/telegram-file?fileId=${url.replace('tg://', '')}&type=text` 
        : url;
      const res = await fetch(fetchUrl);
      const text = await res.text();
      // Làm sạch văn bản: bỏ dòng trống và dòng quá ngắn (thường là rác)
      setParagraphs(text.split('\n').map(l => l.trim()).filter(l => l.length > 5));
    } catch (e) {
      setParagraphs(['Hệ thống đang nạp lại văn bản, vui lòng chờ trong giây lát...']);
    }
    setIsLoadingText(false)
  }

  // 3. ĐỒNG BỘ THANH TIẾN TRÌNH & HIGHLIGHT
  useEffect(() => {
    if (!isPlaying || paragraphs.length === 0) return;

    const interval = setInterval(() => {
      const audio = document.querySelector('audio');
      if (audio && audio.duration) {
        const progress = audio.currentTime / audio.duration;
        setAudioProgress(progress * 100);

        const currentPos = progress * syncData.totalChars;
        const index = syncData.offsets.findIndex(o => o >= currentPos);
        const safeIndex = index === -1 ? paragraphs.length - 1 : index;

        if (safeIndex !== activeIndex) {
          setActiveIndex(safeIndex);
          // Tự động cuộn mượt mà
          const element = document.getElementById(`para-${safeIndex}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    }, 400); // Tần suất quét nhanh hơn để mượt mà
    return () => clearInterval(interval);
  }, [isPlaying, paragraphs, activeIndex, syncData]);

  if (!novel || !chapter) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4"></div>
        <p className="text-amber-500 font-black tracking-widest text-xs">ĐANG ĐỒNG BỘ KHÔNG GIAN ĐỌC...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 font-sans pb-40 transition-colors duration-500">
      
      {/* HEADER CAO CẤP */}
      <header className="sticky top-0 z-40 bg-[#0a0a0c]/80 backdrop-blur-xl border-b border-white/5 shadow-2xl">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href={`/truyen/${novelId}`} className="group flex items-center gap-2 text-zinc-500 hover:text-amber-500 transition-all font-bold text-xs uppercase tracking-tighter">
            <span className="group-hover:-translate-x-1 transition-transform">←</span> Mục lục
          </Link>

          <div className="text-center flex-1 px-6 truncate">
            <h1 className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-black mb-0.5">{novel.title}</h1>
            <p className="text-sm text-zinc-100 font-black truncate">Tập {chapter.chapter_number}: {chapter.title}</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Nút Ẩn/Hiện chữ */}
            <button 
              onClick={() => setShowText(!showText)}
              className={`p-2 rounded-xl border transition-all ${showText ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}
              title={showText ? "Ẩn văn bản" : "Hiện văn bản"}
            >
              {showText ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88L1.39 1.39m7.957 7.957l.07.07m4.243 4.243l8.903 8.903m-8.903-8.903l.07.07" /></svg>
              )}
            </button>
            <div className="flex gap-1.5 bg-zinc-900 p-1 rounded-xl border border-white/5">
              <button onClick={() => setFontSize(f => Math.max(14, f - 2))} className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white font-bold transition-colors">A-</button>
              <button onClick={() => setFontSize(f => Math.min(36, f + 2))} className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white font-bold transition-colors">A+</button>
            </div>
          </div>
        </div>
        {/* Thanh tiến trình Audio mini */}
        <div className="h-[2px] w-full bg-white/5">
          <div 
            className="h-full bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)] transition-all duration-300"
            style={{ width: `${audioProgress}%` }}
          ></div>
        </div>
      </header>

      {/* KHÔNG GIAN NỘI DUNG */}
      <div className="max-w-2xl mx-auto px-6 py-16" ref={scrollContainerRef}>
        <h2 className="text-3xl sm:text-4xl font-black text-center mb-20 text-white leading-tight drop-shadow-2xl">
          {chapter.title}
        </h2>

        {showText ? (
          isLoadingText ? (
            <div className="space-y-8 animate-pulse">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-4 bg-zinc-900 rounded-full w-full"></div>
              ))}
            </div>
          ) : (
            <div 
              className="font-serif leading-[2.2] space-y-12 transition-all duration-500" 
              style={{ 
                fontSize: `${fontSize}px`,
                fontFamily: "'Lora', 'Inter', serif",
                letterSpacing: "-0.01em" 
              }}
            >
              {paragraphs.map((para, idx) => (
                <p 
                  key={idx} 
                  id={`para-${idx}`}
                  className={`transition-all duration-700 transform origin-left relative ${
                    idx === activeIndex 
                    ? 'text-amber-400 scale-[1.03] opacity-100 font-medium drop-shadow-[0_0_20px_rgba(245,158,11,0.2)]' 
                    : 'opacity-20 grayscale blur-[0.8px] scale-95'
                  }`}
                >
                  {/* Hiệu ứng vạch vàng bên cạnh đoạn đang đọc */}
                  {idx === activeIndex && (
                    <span className="absolute -left-6 top-1/2 -translate-y-1/2 w-1 h-8 bg-amber-500 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.6)] animate-pulse"></span>
                  )}
                  {para}
                </p>
              ))}
            </div>
          )
        ) : (
          <div className="py-40 flex flex-col items-center justify-center text-center">
            <div className="relative mb-8">
              <div className="w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center animate-ping absolute inset-0"></div>
              <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center text-4xl relative z-10 border border-white/5">📻</div>
            </div>
            <h3 className="text-xl font-black text-zinc-100 mb-2">Chế độ rảnh tay</h3>
            <p className="text-zinc-500 text-sm max-w-xs leading-relaxed italic">
              Văn bản đã được ẩn để bạn tập trung lắng nghe. Âm thanh vẫn đang phát ở tốc độ <span className="text-amber-500 font-bold">{playbackRate}x</span>.
            </p>
            <button 
              onClick={() => setShowText(true)}
              className="mt-8 text-amber-500 font-bold text-xs uppercase tracking-[0.2em] hover:underline"
            >
              Hiện văn bản
            </button>
          </div>
        )}

        {/* FOOTER KẾT THÚC TẬP */}
        <div className="mt-32 pt-12 border-t border-white/5 text-center">
           <div className="inline-block px-4 py-1 bg-zinc-900 rounded-full border border-white/5 text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-4">
              Hết tập {chapter.chapter_number}
           </div>
           <p className="text-xs text-zinc-500 italic max-w-xs mx-auto">
             Tự động chuyển tập tiếp theo khi audio kết thúc. Chúc bạn nghe truyện vui vẻ!
           </p>
        </div>
      </div>
    </main>
  )
}