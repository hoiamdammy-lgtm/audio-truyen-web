'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&q=80&w=300&h=420'

export default function TruyenChuDetailPage() {
  const params = useParams()
  const router = useRouter()
  const novelId = params?.id as string

  const [novel, setNovel] = useState<any>(null)
  const [chapters, setChapters] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchChapter, setSearchChapter] = useState('')

  useEffect(() => {
    if (!novelId || novelId === 'undefined') return
    fetchData()
  }, [novelId])

  const fetchData = async () => {
    setIsLoading(true)

    const { data: novelData } = await supabase
      .from('novels')
      .select('*')
      .eq('id', novelId)
      .single()

    const { data: chapterData } = await supabase
      .from('chapters')
      .select('*')
      .eq('novel_id', novelId)
      .order('chapter_number', { ascending: true })

    if (novelData) setNovel(novelData)
    if (chapterData) setChapters(chapterData)

    setIsLoading(false)
  }

  const lastReadChapterId =
    typeof window !== 'undefined'
      ? localStorage.getItem(`reading_history_${novelId}`)
      : null

  const continueChapter = useMemo(() => {
    if (!lastReadChapterId) return chapters[0] || null
    return chapters.find((c) => c.id === lastReadChapterId) || chapters[0] || null
  }, [chapters, lastReadChapterId])

  const filteredChapters = useMemo(() => {
    if (!searchChapter.trim()) return chapters
    const q = searchChapter.toLowerCase()
    return chapters.filter(
      (c) =>
        String(c.chapter_number).includes(q) ||
        (c.title || '').toLowerCase().includes(q)
    )
  }, [chapters, searchChapter])

  const handleReadFirst = () => {
    if (!chapters.length) return
    router.push(`/truyen-chu/${novelId}/${chapters[0].id}`)
  }

  const handleContinueRead = () => {
    if (!continueChapter) return
    router.push(`/truyen-chu/${novelId}/${continueChapter.id}`)
  }

  if (!novelId || novelId === 'undefined') {
    return (
      <div className="min-h-screen bg-[#0b0b10] flex items-center justify-center text-red-500 px-4 text-center">
        Lỗi đường dẫn truyện.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0b0b10] flex flex-col items-center justify-center px-4">
        <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin mb-4"></div>
        <p className="text-sky-500 font-black tracking-widest text-xs uppercase text-center">
          Đang tải truyện...
        </p>
      </div>
    )
  }

  if (!novel) {
    return (
      <div className="min-h-screen bg-[#0b0b10] flex items-center justify-center text-zinc-400 px-4 text-center">
        Không tìm thấy truyện.
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#0b0b10] text-zinc-100 selection:bg-sky-500/20">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0b0b10]/85 backdrop-blur-2xl">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <Link
            href="/truyen-chu"
            className="inline-flex items-center gap-2 text-[10px] sm:text-xs font-black uppercase tracking-[0.14em] sm:tracking-[0.18em] text-zinc-400 hover:text-white transition-colors"
          >
            <span>←</span> Thư viện
          </Link>

          <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-black hidden md:block">
            Trang chi tiết truyện
          </p>
        </div>
      </header>

      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5 sm:py-8 lg:py-10">
        <div className="rounded-[24px] sm:rounded-[30px] lg:rounded-[34px] border border-white/8 bg-gradient-to-br from-sky-500/10 via-zinc-900 to-[#12131a] overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
          <div className="p-4 sm:p-6 lg:p-10 flex flex-col md:flex-row gap-5 sm:gap-6 lg:gap-8">
            <div className="shrink-0 mx-auto md:mx-0">
              <img
                src={novel.cover_url || FALLBACK_COVER}
                alt={novel.title}
                className="w-32 sm:w-40 md:w-44 lg:w-56 aspect-[2/3] object-cover rounded-[20px] sm:rounded-[24px] lg:rounded-[28px] border border-white/10 shadow-2xl"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2 mb-4 justify-center md:justify-start">
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                    novel.status === 'Hoàn thành'
                      ? 'bg-emerald-400 text-zinc-950'
                      : 'bg-sky-400 text-zinc-950'
                  }`}
                >
                  {novel.status || 'Đang ra'}
                </span>

                {novel.perspective && (
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-zinc-300">
                    {novel.perspective}
                  </span>
                )}

                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-zinc-300">
                  {chapters.length} chương
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-5xl font-black leading-tight text-white text-center md:text-left break-words">
                {novel.title}
              </h1>

              <p className="mt-3 text-sm sm:text-base text-zinc-400 font-medium text-center md:text-left">
                ✍️ {novel.author || 'Ẩn danh'}
              </p>

              <div className="mt-5 sm:mt-6">
                <p className="text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.24em] text-zinc-500 font-black mb-3 text-center md:text-left">
                  Giới thiệu
                </p>
                <p className="text-sm sm:text-[15px] leading-6 sm:leading-7 text-zinc-300/90 whitespace-pre-line text-left">
                  {novel.description || 'Hiện chưa có mô tả cho bộ truyện này.'}
                </p>
              </div>

              <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleReadFirst}
                  className="w-full px-5 py-3 rounded-2xl bg-sky-500 text-black font-black text-sm shadow-[0_12px_30px_rgba(56,189,248,0.28)] hover:translate-y-[-1px] transition-all"
                >
                  Đọc từ đầu
                </button>

                {continueChapter && (
                  <button
                    onClick={handleContinueRead}
                    className="w-full px-5 py-3 rounded-2xl border border-white/10 bg-white/5 text-white font-black text-sm hover:border-sky-500/30 hover:text-sky-400 transition-all"
                  >
                    Đọc tiếp {continueChapter.chapter_number ? `chương ${continueChapter.chapter_number}` : ''}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <section className="mt-6 sm:mt-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] sm:tracking-[0.3em] text-zinc-500 font-black">
                Danh sách chương
              </p>
              <h2 className="mt-2 text-xl sm:text-2xl lg:text-3xl font-black text-white">
                Chọn chương để đọc
              </h2>
            </div>

            <div className="relative w-full lg:w-[360px]">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">🔎</span>
              <input
                type="text"
                value={searchChapter}
                onChange={(e) => setSearchChapter(e.target.value)}
                placeholder="Tìm số chương hoặc tên chương..."
                className="w-full rounded-2xl border border-white/10 bg-zinc-900/60 pl-11 pr-4 py-3 text-sm outline-none transition-all focus:border-sky-500/50 focus:bg-zinc-900 placeholder:text-zinc-600"
              />
            </div>
          </div>

          {filteredChapters.length === 0 ? (
            <div className="rounded-[24px] sm:rounded-[28px] border border-white/5 bg-white/[0.02] py-16 text-center text-zinc-500 px-4">
              Không tìm thấy chương phù hợp.
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {filteredChapters.map((chapter) => {
                const isLastRead = lastReadChapterId === chapter.id

                return (
                  <button
                    key={chapter.id}
                    onClick={() => router.push(`/truyen-chu/${novelId}/${chapter.id}`)}
                    className="w-full text-left rounded-[20px] sm:rounded-[24px] border border-white/5 bg-gradient-to-br from-white/[0.04] to-white/[0.02] p-4 sm:p-5 transition-all hover:-translate-y-0.5 hover:border-sky-500/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-2 mb-2">
                          <span className="px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-black uppercase">
                            Chương {chapter.chapter_number}
                          </span>

                          {isLastRead && (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase">
                              Đọc dở
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm sm:text-base lg:text-lg font-black text-white line-clamp-2 break-words">
                          {chapter.title || `Chương ${chapter.chapter_number}`}
                        </h3>
                      </div>

                      <span className="text-zinc-500 font-black shrink-0">→</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  )
}