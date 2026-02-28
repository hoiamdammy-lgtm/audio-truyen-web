'use client'

import { useAudioStore } from '@/store/useAudioStore'

export default function PlayButton({ chapter, novelTitle, coverUrl }: any) {
  const { currentChapter, isPlaying, playChapter } = useAudioStore()
  
  // Kiểm tra xem tập truyện này có đang được phát không
  const isCurrentPlaying = currentChapter?.id === chapter.id && isPlaying

  return (
    <button 
      onClick={() => playChapter({
        id: chapter.id,
        title: chapter.title,
        audio_url: chapter.audio_url,
        novelTitle: novelTitle,
        coverUrl: coverUrl
      })}
      className={`${isCurrentPlaying ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-500'} text-white px-4 py-2 rounded text-sm transition`}
    >
      {isCurrentPlaying ? 'Đang phát...' : 'Nghe'}
    </button>
  )
}