import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface ProgressData {
  chapterId: string;
  chapterNumber: number;
  time: number;
  lastUpdate: number;
}

interface AudioState {
  currentChapter: any | null;
  playlist: any[];
  isPlaying: boolean;
  currentTime: number;
  novelProgress: Record<string, ProgressData>;
  playbackRate: number; // Tốc độ phát (x1, x2...)
  showText: boolean; // Ẩn/hiện văn bản

  playChapter: (chapter: any, playlist?: any[], startTime?: number) => void;
  togglePlay: () => void;
  playNext: () => void;
  playPrev: () => void;
  setCurrentTime: (time: number) => void;
  saveProgress: () => void;
  setPlaybackRate: (rate: number) => void;
  setShowText: (show: boolean) => void;
}

export const useAudioStore = create<AudioState>()(
  persist(
    (set, get) => ({
      currentChapter: null,
      playlist: [],
      isPlaying: false,
      currentTime: 0,
      novelProgress: {},
      playbackRate: 1, // Mặc định là x1
      showText: true,

      playChapter: (chapter, playlist = [], startTime = 0) => {
        const validPlaylist = playlist.length > 0 
          ? playlist.filter(c => c.audio_url) 
          : get().playlist;
        set({ 
          currentChapter: chapter, 
          isPlaying: true, 
          playlist: validPlaylist,
          currentTime: startTime
        });
      },

      togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
      setCurrentTime: (time) => set({ currentTime: time }),
      
      // Sửa lỗi non-finite: Đảm bảo rate luôn là số hợp lệ
      setPlaybackRate: (rate) => {
        const safeRate = Number.isFinite(rate) ? rate : 1;
        set({ playbackRate: safeRate });
      },
      
      setShowText: (show) => set({ showText: show }),

      saveProgress: () => {
        const { currentChapter, currentTime } = get();
        if (currentChapter?.novel_id) {
          set((state) => ({
            novelProgress: {
              ...state.novelProgress,
              [currentChapter.novel_id]: {
                chapterId: currentChapter.id,
                chapterNumber: currentChapter.chapter_number,
                time: currentTime,
                lastUpdate: Date.now(),
              }
            }
          }));
        }
      },

      playNext: () => {
        const { currentChapter, playlist, saveProgress } = get();
        if (!currentChapter || playlist.length === 0) return;
        saveProgress();
        const currentIndex = playlist.findIndex(c => c.id === currentChapter.id);
        if (currentIndex !== -1 && currentIndex < playlist.length - 1) {
          set({ currentChapter: playlist[currentIndex + 1], isPlaying: true, currentTime: 0 });
        } else {
          set({ isPlaying: false });
        }
      },

      playPrev: () => {
        const { currentChapter, playlist, saveProgress } = get();
        if (!currentChapter || playlist.length === 0) return;
        saveProgress();
        const currentIndex = playlist.findIndex(c => c.id === currentChapter.id);
        if (currentIndex > 0) {
          set({ currentChapter: playlist[currentIndex - 1], isPlaying: true, currentTime: 0 });
        }
      },
    }),
    {
      name: 'audio-history-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        novelProgress: state.novelProgress,
        playbackRate: state.playbackRate,
        showText: state.showText,
        currentChapter: state.currentChapter,
        playlist: state.playlist,
        currentTime: state.currentTime
      }),
    }
  )
)