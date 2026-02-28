'use client'

import { useAudioStore } from '@/store/useAudioStore'
import PlayGroupButton from './PlayGroupButton'

export default function NovelActions({ novel, chapters }: any) {
  const { novelProgress, playChapter } = useAudioStore()
  
  // Lấy tiến độ cũ của bộ truyện này từ Store
  const savedProgress = novelProgress[novel.id]

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const handleResume = () => {
    if (!savedProgress) return

    // Tìm chương đã nghe dở
    const targetChapter = chapters.find((c: any) => c.id === savedProgress.chapterId)
    
    if (targetChapter) {
      playChapter(
        {
          ...targetChapter,
          novelId: novel.id,
          novelTitle: novel.title,
          coverUrl: novel.cover_url
        }, 
        chapters, 
        savedProgress.time // Nhảy đến đúng số giây 10:11
      )
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 mt-auto">
      {/* NÚT NGHE TỪ ĐẦU */}
      <PlayGroupButton 
        chaptersToPlay={chapters} 
        novel={novel} 
        label="NGHE TỪ ĐẦU" 
        isPrimary={true} 
      />

      {/* NÚT NGHE TIẾP (Chỉ hiện nếu có lịch sử) */}
      {savedProgress && (
        <button 
          onClick={handleResume}
          className="flex-1 bg-zinc-100 hover:bg-white text-zinc-950 px-6 py-3 rounded-xl font-black transition-all flex flex-col items-center justify-center leading-none shadow-xl border border-white/20"
        >
          <span className="text-[10px] uppercase tracking-[0.2em] mb-1 opacity-60">Tiếp tục tập {savedProgress.chapterNumber}</span>
          <span className="text-sm">NGHE TIẾP ({formatTime(savedProgress.time)})</span>
        </button>
      )}
    </div>
  )
}