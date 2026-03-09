'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useParams } from 'next/navigation'

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&q=80&w=300&h=400'

type ThemeType = 'light' | 'sepia' | 'dark'
type WidthType = 'narrow' | 'medium' | 'wide'

export default function TextOnlyReaderPage() {
  const params = useParams()
  const novelId = params?.id as string

  const [novel, setNovel] = useState<any>(null)
  const [chapters, setChapters] = useState<any[]>([])
  const [currentChapter, setCurrentChapter] = useState<any>(null)
  const [paragraphs, setParagraphs] = useState<string[]>([])
  const [isLoadingText, setIsLoadingText] = useState(false)

  const [showIndex, setShowIndex] = useState(false)
  const [showInfo, setShowInfo] = useState(true)
  const [fontSize, setFontSize] = useState(20)
  const [lineHeight, setLineHeight] = useState(2.1)
  const [theme, setTheme] = useState<ThemeType>('dark')
  const [contentWidth, setContentWidth] = useState<WidthType>('medium')

  useEffect(() => {
    if (!novelId || novelId === 'undefined') return
    fetchNovelData(novelId)
  }, [novelId])

  const fetchNovelData = async (id: string) => {
    const { data: nData } = await supabase.from('novels').select('*').eq('id', id).single()
    if (nData) setNovel(nData)

    const { data: caps } = await supabase
      .from('chapters')
      .select('*')
      .eq('novel_id', id)
      .order('chapter_number', { ascending: true })

    if (caps && caps.length > 0) {
      setChapters(caps)

      const savedChapterId = localStorage.getItem(`reading_history_${id}`)
      const targetChapter = savedChapterId ? caps.find((c) => c.id === savedChapterId) || caps[0] : caps[0]
      loadChapter(targetChapter)
    }
  }

  const loadChapter = async (chapter: any) => {
    setCurrentChapter(chapter)
    setShowIndex(false)
    localStorage.setItem(`reading_history_${novelId}`, chapter.id)

    if (!chapter.text_url) {
      setParagraphs(['Chương này hiện chưa có nội dung văn bản. Vui lòng quay lại sau.'])
      return
    }

    setIsLoadingText(true)

    try {
      const fetchUrl = chapter.text_url.startsWith('tg://')
        ? `/api/telegram-file?fileId=${chapter.text_url.replace('tg://', '')}&type=text`
        : chapter.text_url

      const res = await fetch(fetchUrl)
      if (!res.ok) throw new Error('Lỗi khi tải file')
      const text = await res.text()

      setParagraphs(
        text
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
      )
    } catch (e) {
      console.error(e)
      setParagraphs(['Lỗi: Không thể tải nội dung văn bản. Vui lòng thử lại sau.'])
    } finally {
      setIsLoadingText(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const currentIndex = chapters.findIndex((c) => c.id === currentChapter?.id)
  const handlePrev = () => {
    if (currentIndex > 0) loadChapter(chapters[currentIndex - 1])
  }
  const handleNext = () => {
    if (currentIndex < chapters.length - 1) loadChapter(chapters[currentIndex + 1])
  }

  const getThemeStyles = () => {
    switch (theme) {
      case 'light':
        return 'bg-[#f7f8fa] text-[#22303c]'
      case 'sepia':
        return 'bg-[#f5ecd9] text-[#5c4635]'
      case 'dark':
      default:
        return 'bg-[#0b0d12] text-zinc-300'
    }
  }

  const getHeaderStyles = () => {
    switch (theme) {
      case 'light':
        return 'bg-white/90 border-black/10'
      case 'sepia':
        return 'bg-[#f5ecd9]/90 border-[#5c4635]/10'
      case 'dark':
      default:
        return 'bg-[#0b0d12]/85 border-white/5'
    }
  }

  const getPanelStyles = () => {
    switch (theme) {
      case 'light':
        return 'bg-white border-black/10 shadow-[0_12px_30px_rgba(0,0,0,0.06)]'
      case 'sepia':
        return 'bg-[#efe2c8] border-[#5c4635]/10 shadow-[0_12px_30px_rgba(92,70,53,0.08)]'
      case 'dark':
      default:
        return 'bg-white/[0.03] border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.25)]'
    }
  }

  const getButtonStyles = () => {
    switch (theme) {
      case 'light':
        return 'bg-white border-black/10 hover:bg-[#22303c] hover:text-white'
      case 'sepia':
        return 'bg-[#e7d7ba] border-[#5c4635]/15 hover:bg-[#5c4635] hover:text-[#f5ecd9]'
      case 'dark':
      default:
        return 'bg-zinc-900 border-zinc-800 hover:bg-cyan-500 hover:text-black hover:border-cyan-500'
    }
  }

  const getContentMaxWidth = () => {
    switch (contentWidth) {
      case 'narrow':
        return 'max-w-2xl'
      case 'wide':
        return 'max-w-5xl'
      case 'medium':
      default:
        return 'max-w-3xl'
    }
  }

  if (!novelId || novelId === 'undefined') {
    return (
      <div className="min-h-screen bg-[#0b0d12] flex items-center justify-center text-red-500">
        Lỗi đường dẫn. Không tìm thấy ID truyện.
      </div>
    )
  }

  if (!novel || !currentChapter) {
    return (
      <div className="min-h-screen bg-[#0b0d12] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-4"></div>
        <p className="text-cyan-500 font-black tracking-widest text-xs uppercase">Đang tải truyện...</p>
      </div>
    )
  }

  return (
    <main className={`min-h-screen transition-colors duration-500 ${getThemeStyles()}`}>
      <header className={`sticky top-0 z-40 backdrop-blur-2xl border-b ${getHeaderStyles()}`}>
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Link
                  href="/truyen-chu"
                  className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] opacity-70 hover:opacity-100"
                >
                  <span>←</span> Thư viện
                </Link>

                <button
                  onClick={() => setShowIndex(!showIndex)}
                  className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-[0.14em] border transition-all ${getButtonStyles()}`}
                >
                  Mục lục
                </button>
              </div>

              <div className="hidden lg:block text-center flex-1 px-6 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.26em] opacity-50 font-black truncate">
                  {novel.title}
                </p>
                <h1 className="text-sm font-black truncate">
                  Chương {currentChapter.chapter_number}: {currentChapter.title}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => setTheme('light')}
                    className={`w-6 h-6 rounded-full border-2 ${theme === 'light' ? 'border-blue-500' : 'border-transparent'} bg-[#f8f9fa]`}
                  />
                  <button
                    onClick={() => setTheme('sepia')}
                    className={`w-6 h-6 rounded-full border-2 ${theme === 'sepia' ? 'border-blue-500' : 'border-transparent'} bg-[#e8d9bc]`}
                  />
                  <button
                    onClick={() => setTheme('dark')}
                    className={`w-6 h-6 rounded-full border-2 ${theme === 'dark' ? 'border-cyan-500' : 'border-transparent'} bg-[#111217]`}
                  />
                </div>

                <div className={`flex items-center gap-1.5 px-1.5 py-1 rounded-xl border ${getPanelStyles()}`}>
                  <button onClick={() => setFontSize((f) => Math.max(16, f - 2))} className="w-8 h-8 text-sm font-black opacity-70 hover:opacity-100">
                    A-
                  </button>
                  <button onClick={() => setFontSize((f) => Math.min(34, f + 2))} className="w-8 h-8 text-sm font-black opacity-70 hover:opacity-100">
                    A+
                  </button>
                </div>

                <div className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-xl border ${getPanelStyles()}`}>
                  <button onClick={() => setContentWidth('narrow')} className={`px-2 py-1 text-xs rounded-lg ${contentWidth === 'narrow' ? 'bg-cyan-500 text-black font-bold' : 'opacity-70'}`}>
                    Hẹp
                  </button>
                  <button onClick={() => setContentWidth('medium')} className={`px-2 py-1 text-xs rounded-lg ${contentWidth === 'medium' ? 'bg-cyan-500 text-black font-bold' : 'opacity-70'}`}>
                    Vừa
                  </button>
                  <button onClick={() => setContentWidth('wide')} className={`px-2 py-1 text-xs rounded-lg ${contentWidth === 'wide' ? 'bg-cyan-500 text-black font-bold' : 'opacity-70'}`}>
                    Rộng
                  </button>
                </div>

                <button
                  onClick={() => setShowInfo(!showInfo)}
                  className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-[0.14em] border transition-all ${getButtonStyles()}`}
                >
                  {showInfo ? 'Ẩn info' : 'Hiện info'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="relative">
        {showInfo && (
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-6">
            <div className={`rounded-[28px] border p-5 sm:p-6 ${getPanelStyles()}`}>
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="shrink-0">
                  <img
                    src={novel.cover_url || FALLBACK_COVER}
                    alt={novel.title}
                    className="w-36 h-52 object-cover rounded-2xl border border-white/10 shadow-lg"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                        novel.status === 'Hoàn thành'
                          ? 'bg-emerald-400 text-zinc-950'
                          : 'bg-cyan-400 text-zinc-950'
                      }`}
                    >
                      {novel.status || 'Đang ra'}
                    </span>
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold border border-current/10 opacity-80">
                      {novel.perspective || 'Chưa phân loại'}
                    </span>
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold border border-current/10 opacity-80">
                      {chapters.length} chương
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black leading-tight">
                    {novel.title}
                  </h2>

                  <p className="mt-2 text-sm opacity-75">✍️ {novel.author || 'Ẩn danh'}</p>

                  <div className="mt-5">
                    <p className="text-[11px] uppercase tracking-[0.2em] font-black opacity-50 mb-2">
                      Giới thiệu
                    </p>
                    <p className="text-sm sm:text-[15px] leading-7 opacity-85 whitespace-pre-line">
                      {novel.description || 'Hiện chưa có mô tả cho bộ truyện này.'}
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      onClick={() => loadChapter(chapters[0])}
                      className={`px-5 py-3 rounded-2xl border font-black text-sm transition-all ${getButtonStyles()}`}
                    >
                      Đọc từ đầu
                    </button>
                    {currentChapter && (
                      <button
                        onClick={() => loadChapter(currentChapter)}
                        className={`px-5 py-3 rounded-2xl border font-black text-sm transition-all ${getButtonStyles()}`}
                      >
                        Đọc tiếp chương {currentChapter.chapter_number}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showIndex && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
            <div className="absolute right-0 top-0 h-full w-full sm:w-[420px]">
              <div className={`h-full border-l p-5 ${getPanelStyles()}`}>
                <div className="flex items-center justify-between pb-4 border-b border-current/10">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-black opacity-50">Mục lục</p>
                    <h3 className="mt-1 text-lg font-black">{novel.title}</h3>
                  </div>
                  <button
                    onClick={() => setShowIndex(false)}
                    className="w-10 h-10 rounded-full border border-current/10 text-lg opacity-70 hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-4 space-y-2 overflow-y-auto max-h-[calc(100vh-120px)] pr-1">
                  {chapters.map((chap, idx) => {
                    const isActive = currentIndex === idx
                    return (
                      <button
                        key={chap.id}
                        onClick={() => loadChapter(chap)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all ${
                          isActive
                            ? 'bg-cyan-500 text-black border-cyan-500 font-black'
                            : 'border-current/10 hover:bg-black/5'
                        }`}
                      >
                        <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">
                          Chương {chap.chapter_number}
                        </p>
                        <p className="mt-1 text-sm line-clamp-2">{chap.title}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className={`${getContentMaxWidth()} mx-auto px-6 py-12 sm:py-16`}>
        <div className="text-center mb-12">
          <p className="text-[10px] uppercase tracking-[0.26em] font-black opacity-50">
            Chương {currentChapter.chapter_number}
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-black leading-tight">
            {currentChapter.title}
          </h2>
        </div>

        {isLoadingText ? (
          <div className="space-y-6 animate-pulse opacity-40">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-4 rounded-full w-full bg-current"></div>
            ))}
          </div>
        ) : (
          <article
            className="font-serif text-justify"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight,
              fontFamily: "'Lora', 'Merriweather', serif",
            }}
          >
            <div className="space-y-7">
              {paragraphs.map((para, idx) => (
                <p key={idx} className="leading-[inherit]">
                  {para}
                </p>
              ))}
            </div>
          </article>
        )}

        <div className="mt-14 rounded-[28px] border p-5 sm:p-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between ${getPanelStyles()}">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-black opacity-50">Điều chỉnh nhanh</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[1.9, 2.1, 2.3].map((lh) => (
                <button
                  key={lh}
                  onClick={() => setLineHeight(lh)}
                  className={`px-3 py-2 rounded-xl text-xs font-black border transition-all ${
                    lineHeight === lh ? 'bg-cyan-500 text-black border-cyan-500' : getButtonStyles()
                  }`}
                >
                  Giãn dòng {lh}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className={`px-5 py-3 rounded-2xl font-black text-sm border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${getButtonStyles()}`}
            >
              ← Chương trước
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex === chapters.length - 1}
              className={`px-5 py-3 rounded-2xl font-black text-sm border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${getButtonStyles()}`}
            >
              Chương sau →
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}