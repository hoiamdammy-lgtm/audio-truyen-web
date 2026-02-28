'use client'

import { useAudioStore } from '@/store/useAudioStore'
import { useRouter } from 'next/navigation'

export default function PlayGroupButton({ chaptersToPlay, novel, label, isPrimary = false }: any) {
  const { playChapter } = useAudioStore()
  const router = useRouter()

  const handlePlayGroup = () => {
    // Lọc ra những chương có audio
    const playableChapters = chaptersToPlay.filter((cap: any) => cap.audio_url);
    
    if (!playableChapters || playableChapters.length === 0) {
      alert("Phần này chưa có Audio!");
      return;
    }
    
    const firstChapter = playableChapters[0];

    // Phát tập đầu và nạp TOÀN BỘ list vào Playlist để tự động Next
    playChapter({
      id: firstChapter.id,
      title: firstChapter.title,
      chapter_number: firstChapter.chapter_number,
      audio_url: firstChapter.audio_url,
      novelId: novel.id,
      novelTitle: novel.title,
      coverUrl: novel.cover_url
    }, playableChapters);

    // Tự động chuyển hướng người dùng vào phòng Đọc chữ & Nghe nền
    router.push(`/truyen/${novel.id}/${firstChapter.id}`)
  }

  return (
    <button 
      onClick={handlePlayGroup}
      className={`px-6 py-3 rounded-xl font-black transition-all flex items-center justify-center gap-2 shadow-lg hover:scale-105 active:scale-95 ${
        isPrimary 
          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 shadow-amber-500/20 w-full sm:w-auto' 
          : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-amber-400 border border-zinc-700 text-sm'
      }`}
    >
      <span className={isPrimary ? "text-xl" : "text-base"}>▶</span> {label}
    </button>
  )
}