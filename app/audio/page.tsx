'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const FALLBACK_COVER = "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&q=80&w=300&h=400"

export default function Home() {
  const [novels, setNovels] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  const [activeTab, setActiveTab] = useState<'all' | 'chuthu' | 'chucong' | 'favorites' | 'history'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
  
  const [favorites, setFavorites] = useState<string[]>([])
  const [history, setHistory] = useState<Record<string, any>>({})

  useEffect(() => {
    fetchNovels()
    const savedFavs = JSON.parse(localStorage.getItem('novel_favorites') || '[]')
    const savedHistory = JSON.parse(localStorage.getItem('novel_history') || '{}')
    setFavorites(savedFavs)
    setHistory(savedHistory)
  }, [])

  const fetchNovels = async () => {
    setIsLoading(true)
    const { data } = await supabase.from('novels').select(`*, chapters:chapters(count)`).order('created_at', { ascending: false })
    if (data) setNovels(data)
    setIsLoading(false)
  }

  const toggleFavorite = (e: React.MouseEvent, novelId: string) => {
    e.preventDefault()
    let newFavs = [...favorites]
    if (newFavs.includes(novelId)) newFavs = newFavs.filter(id => id !== novelId)
    else newFavs.push(novelId)
    setFavorites(newFavs)
    localStorage.setItem('novel_favorites', JSON.stringify(newFavs))
  }

  const allGenres = Array.from(new Set(novels.flatMap(n => (n.genres || '').split(',').map((g: string) => g.trim())).filter(Boolean))).sort()
  const removeAccents = (str: string) => str?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() || ''
  
  const filteredNovels = novels.filter(n => {
    if (activeTab === 'chuthu' && n.perspective !== 'Chủ thụ') return false
    if (activeTab === 'chucong' && n.perspective !== 'Chủ công') return false
    if (activeTab === 'favorites' && !favorites.includes(n.id)) return false
    if (activeTab === 'history' && !history[n.id]) return false
    if (selectedGenre && !(n.genres || '').includes(selectedGenre)) return false
    if (searchTerm) {
      const searchNorm = removeAccents(searchTerm)
      if (!removeAccents(n.title).includes(searchNorm) && !removeAccents(n.author).includes(searchNorm)) return false
    }
    return true
  }).sort((a, b) => activeTab === 'history' ? (history[b.id]?.timestamp || 0) - (history[a.id]?.timestamp || 0) : 0)

  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-100 font-sans selection:bg-amber-500/30 pb-32">
      
      {/* ================================== */}
      {/* HEADER NỔI BẬT & TÌM KIẾM */}
      {/* ================================== */}
      <header className="sticky top-0 z-40 bg-[#0a0a0c]/80 backdrop-blur-2xl border-b border-white/5 shadow-2xl">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center w-full md:w-auto justify-between md:justify-start gap-8">
            <Link href="/" className="text-2xl font-black tracking-tighter flex items-center gap-2 group">
              <span className="bg-gradient-to-br from-amber-400 to-orange-600 w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-[0_0_20px_rgba(245,158,11,0.4)] group-hover:scale-105 transition-transform">🎧</span>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">HOIAMDAMMY</span>
            </Link>
            
            {/* Tabs cho Desktop */}
            <nav className="hidden lg:flex items-center bg-zinc-900/80 p-1 rounded-xl border border-white/5">
              {[
                { id: 'all', label: 'Khám phá' },
                { id: 'chuthu', label: 'Chủ thụ' },
                { id: 'chucong', label: 'Chủ công' },
              ].map(tab => (
                <button 
                  key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                  className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Khung tìm kiếm */}
            <div className="relative flex-1 md:w-[320px] group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-amber-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input 
                type="text" placeholder="Tìm tên truyện, tác giả..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-900/50 border border-white/10 focus:border-amber-500/50 focus:bg-zinc-900 pl-10 pr-4 py-2.5 rounded-xl outline-none transition-all text-xs sm:text-sm font-medium placeholder:text-zinc-600"
              />
            </div>
            
            <button 
              onClick={() => setActiveTab('favorites')} 
              className={`p-2.5 rounded-xl border transition-all flex items-center justify-center ${activeTab === 'favorites' ? 'bg-red-500/10 border-red-500/50 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-zinc-900/80 border-white/5 text-zinc-400 hover:text-white'}`}
              title="Tủ truyện yêu thích"
            >
              <svg className="w-5 h-5" fill={activeTab === 'favorites' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
            </button>

            <button 
              onClick={() => setActiveTab('history')} 
              className={`p-2.5 rounded-xl border transition-all flex items-center justify-center ${activeTab === 'history' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-zinc-900/80 border-white/5 text-zinc-400 hover:text-white'}`}
              title="Lịch sử nghe"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
          </div>
        </div>

        {/* Tabs cho Mobile (Hiển thị dưới search bar) */}
        <nav className="flex lg:hidden overflow-x-auto custom-scrollbar px-4 pb-3 gap-2">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'chuthu', label: 'Chủ thụ' },
            { id: 'chucong', label: 'Chủ công' },
          ].map(tab => (
            <button 
              key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border ${activeTab === tab.id ? 'bg-amber-500 border-amber-500 text-black' : 'bg-zinc-900/50 border-white/5 text-zinc-400'}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* ================================== */}
      {/* KHU VỰC THỂ LOẠI (TAGS) */}
      {/* ================================== */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
        <div className="mb-10">
          <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-4 flex items-center gap-3">
            <span className="w-8 h-[2px] bg-gradient-to-r from-amber-500 to-transparent"></span> 
            Khám phá theo thể loại
          </h2>
          <div className="flex flex-wrap gap-2.5">
            <button 
              onClick={() => setSelectedGenre(null)} 
              className={`px-5 py-2 rounded-full text-xs font-black transition-all border ${!selectedGenre ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-white hover:border-white/20'}`}
            >
              TẤT CẢ
            </button>
            {allGenres.map((genre: string, i) => (
              <button 
                key={i} onClick={() => setSelectedGenre(genre)} 
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${selectedGenre === genre ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'bg-[#111113] border-white/5 text-zinc-400 hover:bg-zinc-800'}`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        {/* ================================== */}
        {/* LƯỚI TRUYỆN (GRID) */}
        {/* ================================== */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
              <div key={i} className="aspect-[2/3] bg-zinc-900/50 rounded-2xl animate-pulse border border-white/5"></div>
            ))}
          </div>
        ) : filteredNovels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center text-4xl mb-6 shadow-inner">📭</div>
            <h3 className="font-black text-xl text-white mb-2">Không tìm thấy truyện</h3>
            <p className="text-zinc-500 text-sm max-w-xs">Hãy thử đổi từ khóa tìm kiếm hoặc chọn thể loại khác xem sao.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-12">
            {filteredNovels.map(novel => (
              <Link href={`/truyen/${novel.id}`} key={novel.id} className="group flex flex-col">
                {/* ẢNH BÌA & BADGES */}
                <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900 mb-4 border border-white/5 shadow-xl transition-all duration-500 group-hover:shadow-[0_15px_40px_rgba(245,158,11,0.15)] group-hover:-translate-y-2">
                  <img 
                    src={novel.cover_url || FALLBACK_COVER} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                    alt={novel.title} 
                  />
                  
                  {/* Gradient tối dưới đáy ảnh để nổi chữ */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-black/40 to-transparent opacity-80 group-hover:opacity-60 transition-opacity"></div>
                  
                  {/* Trạng thái (Hoàn thành / Đang ra) */}
                  <div className="absolute top-3 left-3">
                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-md shadow-lg ${novel.status === 'Hoàn thành' ? 'bg-emerald-500 text-zinc-950' : 'bg-blue-500 text-zinc-950'}`}>
                      {novel.status.toUpperCase()}
                    </span>
                  </div>
                  
                  {/* Nút yêu thích thả nổi */}
                  <button 
                    onClick={(e) => toggleFavorite(e, novel.id)} 
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/80 transition-colors z-10"
                  >
                    {favorites.includes(novel.id) ? (
                      <svg className="w-4 h-4 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>
                    ) : (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                    )}
                  </button>

                  {/* Thanh tiến trình nếu đang nghe dở */}
                  {history[novel.id] && (
                    <div className="absolute bottom-12 left-3 right-3 bg-black/60 backdrop-blur-md p-2 rounded-lg border border-white/10">
                      <p className="text-[9px] font-bold text-amber-400 mb-1.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                        Đang nghe Tập {history[novel.id].chapter_number}
                      </p>
                      <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500" style={{ width: `${history[novel.id].progress_percent || 100}%` }}></div>
                      </div>
                    </div>
                  )}

                  {/* Thông số bên dưới ảnh bìa */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] font-bold">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> {novel.views || 0}</span>
                      <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                      <span className="flex items-center gap-1"><svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg> {novel.likes || 0}</span>
                    </div>
                    <span className="bg-zinc-800/80 backdrop-blur-md text-amber-500 px-2 py-1 rounded-md border border-white/10">{novel.chapters?.[0]?.count || 0} Tập</span>
                  </div>
                </div>

                {/* THÔNG TIN VĂN BẢN */}
                <div className="px-1 flex flex-col flex-1">
                  <h3 className="font-black text-sm sm:text-base leading-snug mb-1.5 group-hover:text-amber-400 transition-colors line-clamp-2" title={novel.title}>
                    {novel.title}
                  </h3>
                  <div className="mt-auto">
                    <p className="text-[11px] text-zinc-500 font-medium flex items-center gap-1.5">
                      <span className="w-2 h-[2px] bg-zinc-700 rounded-full"></span> 
                      {novel.author}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Global CSS cho Scrollbar thanh thể loại */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
      `}</style>
    </main>
  )
}