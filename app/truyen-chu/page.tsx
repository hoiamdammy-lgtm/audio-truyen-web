'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&q=80&w=300&h=420'

type ViewMode = 'grid' | 'list'

export default function TruyenChuPage() {
  const [novels, setNovels] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  useEffect(() => {
    fetchNovels()
  }, [])

  const fetchNovels = async () => {
    setIsLoading(true)

    const { data } = await supabase
      .from('novels')
      .select('*, chapters:chapters(count)')
      .in('type', ['audio', 'truyen-chu'])
      .order('created_at', { ascending: false })

    if (data) setNovels(data)
    setIsLoading(false)
  }

  const removeAccents = (str: string) =>
    str?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() || ''

  const allGenres = useMemo(() => {
    return Array.from(
      new Set(
        novels
          .flatMap((n) => (n.genres || '').split(',').map((g: string) => g.trim()))
          .filter(Boolean)
      )
    ).sort()
  }, [novels])

  const filteredNovels = useMemo(() => {
    return novels.filter((n) => {
      if (selectedGenre && !(n.genres || '').includes(selectedGenre)) return false

      if (searchTerm) {
        const keyword = removeAccents(searchTerm)
        const title = removeAccents(n.title)
        const author = removeAccents(n.author || '')
        const desc = removeAccents(n.description || '')
        if (!title.includes(keyword) && !author.includes(keyword) && !desc.includes(keyword)) return false
      }

      return true
    })
  }, [novels, searchTerm, selectedGenre])

  return (
    <main className="min-h-screen bg-[#0b0b10] text-zinc-100 selection:bg-sky-500/20">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0b0b10]/80 backdrop-blur-2xl">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-3">
                <Link href="/" className="group flex items-center gap-3">
                  <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-[0_0_28px_rgba(56,189,248,0.28)] group-hover:scale-105 transition-transform">
                    📖
                  </span>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                      Tàng Kinh Các
                    </h1>
                    <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-bold">
                      Chọn truyện để bắt đầu đọc
                    </p>
                  </div>
                </Link>
              </div>

              <div className="flex gap-3 items-center w-full lg:w-auto">
                <div className="relative flex-1 lg:w-[420px]">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">🔎</span>
                  <input
                    type="text"
                    placeholder="Tìm tên truyện, tác giả, mô tả..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-zinc-900/60 pl-11 pr-4 py-3 text-sm outline-none transition-all focus:border-sky-500/50 focus:bg-zinc-900 placeholder:text-zinc-600"
                  />
                </div>

                <div className="flex items-center rounded-2xl border border-white/10 bg-zinc-900/60 p-1">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${
                      viewMode === 'list' ? 'bg-sky-500 text-black' : 'text-zinc-400'
                    }`}
                  >
                    List
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${
                      viewMode === 'grid' ? 'bg-sky-500 text-black' : 'text-zinc-400'
                    }`}
                  >
                    Grid
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedGenre(null)}
                className={`px-4 py-2 rounded-full text-xs font-black transition-all border ${
                  !selectedGenre
                    ? 'bg-white text-black border-white'
                    : 'bg-zinc-900/70 border-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                TẤT CẢ
              </button>

              {allGenres.map((genre) => (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(genre)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                    selectedGenre === genre
                      ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                      : 'bg-zinc-900/70 border-white/5 text-zinc-400 hover:text-white'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-black">
            Thư viện truyện chữ
          </p>
          <h2 className="mt-2 text-2xl sm:text-3xl font-black text-white">
            {filteredNovels.length} truyện phù hợp
          </h2>
        </div>

        {isLoading ? (
          viewMode === 'list' ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-44 rounded-[28px] bg-zinc-900/50 animate-pulse border border-white/5" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4 sm:gap-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-3xl bg-zinc-900/50 animate-pulse border border-white/5" />
              ))}
            </div>
          )
        ) : filteredNovels.length === 0 ? (
          <div className="rounded-[32px] border border-white/5 bg-white/[0.02] py-24 text-center">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-2xl font-black text-white">Không có truyện phù hợp</h3>
            <p className="mt-2 text-sm text-zinc-500">Thử đổi từ khóa hoặc thể loại.</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-4">
            {filteredNovels.map((novel) => (
              <Link href={`/truyen-chu/${novel.id}`} key={novel.id} className="group block">
                <article className="rounded-[28px] border border-white/5 bg-gradient-to-br from-white/[0.04] to-white/[0.02] p-4 sm:p-5 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-sky-500/30">
                  <div className="flex gap-4 sm:gap-5">
                    <div className="relative shrink-0">
                      <img
                        src={novel.cover_url || FALLBACK_COVER}
                        alt={novel.title}
                        className="w-24 sm:w-28 h-36 sm:h-40 object-cover rounded-2xl border border-white/10 shadow-lg"
                      />
                      <span
                        className={`absolute top-2 left-2 px-2 py-1 rounded-lg text-[9px] font-black uppercase ${
                          novel.status === 'Hoàn thành'
                            ? 'bg-emerald-400 text-zinc-950'
                            : 'bg-sky-400 text-zinc-950'
                        }`}
                      >
                        {novel.status || 'Đang ra'}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 flex flex-col">
                      <div className="flex flex-wrap gap-2 mb-2">
                        {novel.perspective && (
                          <span className="px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-bold">
                            {novel.perspective}
                          </span>
                        )}
                        <span className="px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-bold">
                          {novel.chapters?.[0]?.count || 0} chương
                        </span>
                      </div>

                      <h3 className="text-lg sm:text-xl font-black text-white group-hover:text-sky-400 transition-colors line-clamp-2">
                        {novel.title}
                      </h3>

                      <p className="mt-2 text-sm text-zinc-400">✍️ {novel.author || 'Ẩn danh'}</p>

                      <p className="mt-3 text-sm leading-6 text-zinc-400 line-clamp-3 sm:line-clamp-4">
                        {novel.description || 'Chưa có mô tả cho bộ truyện này.'}
                      </p>

                      <div className="mt-auto pt-4 flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-600 font-black">
                          Xem chi tiết truyện
                        </span>
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-black group-hover:bg-sky-500 group-hover:text-black transition-all">
                          Mở <span>→</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10">
            {filteredNovels.map((novel) => (
              <Link href={`/truyen-chu/${novel.id}`} key={novel.id} className="group flex flex-col">
                <div className="relative aspect-[2/3] overflow-hidden rounded-[26px] border border-white/5 bg-zinc-900 shadow-xl transition-all duration-300 group-hover:-translate-y-2 group-hover:border-sky-500/30">
                  <img
                    src={novel.cover_url || FALLBACK_COVER}
                    alt={novel.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b10] via-black/25 to-transparent"></div>

                  <div className="absolute top-3 left-3">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${
                        novel.status === 'Hoàn thành'
                          ? 'bg-emerald-400 text-zinc-950'
                          : 'bg-sky-400 text-zinc-950'
                      }`}
                    >
                      {novel.status || 'Đang ra'}
                    </span>
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 text-[10px] font-bold text-zinc-200">
                      {novel.chapters?.[0]?.count || 0} chương
                    </span>
                  </div>
                </div>

                <div className="pt-4 px-1 flex flex-col flex-1">
                  <h4 className="text-sm sm:text-[15px] font-black leading-snug text-white group-hover:text-sky-400 transition-colors line-clamp-2">
                    {novel.title}
                  </h4>
                  <p className="mt-1 text-[12px] text-zinc-500 font-medium truncate">
                    {novel.author || 'Ẩn danh'}
                  </p>
                  <p className="mt-2 text-[12px] leading-5 text-zinc-400 line-clamp-3">
                    {novel.description || 'Chưa có mô tả cho bộ truyện này.'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}