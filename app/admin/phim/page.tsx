'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast, { Toaster } from 'react-hot-toast'

const TELEGRAM_PUBLIC_CHANNEL = 'khohoiam'
const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&q=80&w=300&h=400'

type VideoServer = {
  name: string
  url: string
}

type Movie = {
  id: string
  title: string
  cover_url?: string | null
  description?: string | null
  status?: string | null
  country?: string | null
  genres?: string | null
  director?: string | null
  main_cast?: string | null
  release_year?: number | null
  rating?: number | null
  created_at?: string | null
}

type Episode = {
  id: string
  movie_id: string
  episode_number: number
  title?: string | null
  video_url?: string | null // Giữ lại làm fallback cho code cũ
  servers?: VideoServer[] | null // Cột JSONB mới thêm
  created_at?: string | null
}

type MovieForm = {
  title: string
  cover_url: string
  description: string
  status: string
  country: string
  genres: string
  director: string
  main_cast: string
  release_year: string
  rating: string
}

type EpisodeForm = {
  episode_number: string
  title: string
  servers: VideoServer[]
}

const emptyMovieForm: MovieForm = {
  title: '',
  cover_url: '',
  description: '',
  status: 'Đang ra',
  country: 'Thái Lan',
  genres: '',
  director: '',
  main_cast: '',
  release_year: String(new Date().getFullYear()),
  rating: '',
}

const emptyEpisodeForm: EpisodeForm = {
  episode_number: '',
  title: '',
  servers: [{ name: 'Server 1', url: '' }],
}

const removeAccents = (str: string) =>
  str?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() || ''

function parseTelegramUrl(input: string) {
  const clean = input.trim()
  const publicMatch = clean.match(
    /(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(?:s\/)?([A-Za-z0-9_]+)\/(\d+)(?:\?.*)?$/i
  )
  if (publicMatch) {
    return `https://t.me/${publicMatch[1]}/${publicMatch[2]}`
  }
  const internalMatch = clean.match(
    /(?:https?:\/\/)?(?:t\.me|telegram\.me)\/c\/\d+\/(\d+)(?:\?.*)?$/i
  )
  if (internalMatch) {
    return `https://t.me/${TELEGRAM_PUBLIC_CHANNEL}/${internalMatch[1]}`
  }
  return null
}

function processEmbedUrl(input: string) {
  if (!input) return ''
  let processedUrl = input.trim()

  const tgUrl = parseTelegramUrl(processedUrl)
  if (tgUrl) return tgUrl

  if (processedUrl.includes('<iframe') && processedUrl.includes('src=')) {
    const srcMatch = processedUrl.match(/src=["'](.*?)["']/)
    if (srcMatch?.[1]) {
      processedUrl = srcMatch[1]
    }
  }

  if (processedUrl.startsWith('//')) {
    processedUrl = 'https:' + processedUrl
  }

  if (processedUrl.includes('ok.ru/videoembed')) {
    if (!processedUrl.includes('autoplay=')) {
      processedUrl += processedUrl.includes('?') ? '&autoplay=0' : '?autoplay=0'
    }
  }

  if (processedUrl.includes('player.bilibili.com')) {
    if (!processedUrl.includes('high_quality=1')) processedUrl += '&high_quality=1'
    if (!processedUrl.includes('danmaku=0')) processedUrl += '&danmaku=0'
  }

  if (processedUrl.includes('drive.google.com/file/d/')) {
    processedUrl = processedUrl.replace('/view?usp=sharing', '/preview')
  }

  return processedUrl
}

function formatDate(date?: string | null) {
  if (!date) return '---'
  try {
    return new Date(date).toLocaleDateString('vi-VN')
  } catch {
    return '---'
  }
}

export default function MovieAdmin() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [episodes, setEpisodes] = useState<Episode[]>([])

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMovieId, setSelectedMovieId] = useState('')
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null)

  const [movieForm, setMovieForm] = useState<MovieForm>(emptyMovieForm)
  const [episodeForm, setEpisodeForm] = useState<EpisodeForm>(emptyEpisodeForm)

  const [editingMovieId, setEditingMovieId] = useState<string | null>(null)
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null)

  const [isLoadingMovies, setIsLoadingMovies] = useState(true)
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false)
  const [isSavingMovie, setIsSavingMovie] = useState(false)
  const [isSavingEpisode, setIsSavingEpisode] = useState(false)

  const fetchMovies = useCallback(async () => {
    setIsLoadingMovies(true)
    const { data, error } = await supabase
      .from('movies')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Không tải được danh sách phim')
      setIsLoadingMovies(false)
      return
    }

    const list = (data || []) as Movie[]
    setMovies(list)

    if (!selectedMovieId && list.length > 0) {
      setSelectedMovieId(list[0].id)
      setSelectedMovie(list[0])
    } else if (selectedMovieId) {
      const matched = list.find((m) => m.id === selectedMovieId) || null
      setSelectedMovie(matched)
    }

    setIsLoadingMovies(false)
  }, [selectedMovieId])

  const fetchEpisodes = useCallback(async (movieId: string) => {
    if (!movieId) {
      setEpisodes([])
      return
    }

    setIsLoadingEpisodes(true)
    const { data, error } = await supabase
      .from('episodes')
      .select('*')
      .eq('movie_id', movieId)
      .order('episode_number', { ascending: true })

    if (error) {
      toast.error('Không tải được danh sách tập')
      setEpisodes([])
      setIsLoadingEpisodes(false)
      return
    }

    setEpisodes((data || []) as Episode[])
    setIsLoadingEpisodes(false)
  }, [])

  useEffect(() => {
    fetchMovies()
  }, [fetchMovies])

  useEffect(() => {
    if (!selectedMovieId) return
    const movie = movies.find((m) => m.id === selectedMovieId) || null
    setSelectedMovie(movie)
    fetchEpisodes(selectedMovieId)
  }, [selectedMovieId, movies, fetchEpisodes])

  const filteredMovies = useMemo(() => {
    return movies.filter((m) => removeAccents(m.title).includes(removeAccents(searchTerm)))
  }, [movies, searchTerm])

  const resetMovieForm = () => {
    setEditingMovieId(null)
    setMovieForm(emptyMovieForm)
  }

  const resetEpisodeForm = () => {
    const nextNumber =
      episodes.length > 0 ? String(Math.max(...episodes.map((e) => e.episode_number)) + 1) : '1'

    setEditingEpisodeId(null)
    setEpisodeForm({
      episode_number: nextNumber,
      title: '',
      servers: [{ name: 'Server 1', url: '' }],
    })
  }

  const handleSelectMovie = (movie: Movie) => {
    setSelectedMovieId(movie.id)
    setSelectedMovie(movie)
    resetEpisodeForm()
  }

  const handleEditMovie = (movie: Movie) => {
    setSelectedMovieId(movie.id)
    setSelectedMovie(movie)
    setEditingMovieId(movie.id)
    setMovieForm({
      title: movie.title || '',
      cover_url: movie.cover_url || '',
      description: movie.description || '',
      status: movie.status || 'Đang ra',
      country: movie.country || 'Thái Lan',
      genres: movie.genres || '',
      director: movie.director || '',
      main_cast: movie.main_cast || '',
      release_year: movie.release_year ? String(movie.release_year) : String(new Date().getFullYear()),
      rating: movie.rating ? String(movie.rating) : '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSaveMovie = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!movieForm.title.trim()) {
      toast.error('Tên phim không được để trống')
      return
    }

    setIsSavingMovie(true)
    const loadingToast = toast.loading(editingMovieId ? 'Đang cập nhật phim...' : 'Đang thêm phim...')

    const payload = {
      title: movieForm.title.trim(),
      cover_url: movieForm.cover_url.trim() || null,
      description: movieForm.description.trim() || null,
      status: movieForm.status,
      country: movieForm.country.trim() || null,
      genres: movieForm.genres.trim() || null,
      director: movieForm.director.trim() || null,
      main_cast: movieForm.main_cast.trim() || null,
      release_year: movieForm.release_year ? Number(movieForm.release_year) : null,
      rating: movieForm.rating ? Number(movieForm.rating) : null,
    }

    if (editingMovieId) {
      const { error } = await supabase.from('movies').update(payload).eq('id', editingMovieId)
      if (error) {
        toast.error(error.message, { id: loadingToast })
        setIsSavingMovie(false)
        return
      }
      toast.success('Cập nhật phim thành công', { id: loadingToast })
    } else {
      const { data, error } = await supabase.from('movies').insert([payload]).select('*').single()
      if (error) {
        toast.error(error.message, { id: loadingToast })
        setIsSavingMovie(false)
        return
      }
      toast.success('Thêm phim thành công', { id: loadingToast })
      if (data?.id) {
        setSelectedMovieId(data.id)
      }
    }

    resetMovieForm()
    await fetchMovies()
    setIsSavingMovie(false)
  }

  const handleDeleteMovie = async (movie: Movie) => {
    const ok = window.confirm(`Bạn có chắc muốn xóa phim "${movie.title}" và toàn bộ tập?`)
    if (!ok) return

    const loadingToast = toast.loading('Đang xóa phim...')

    const { error: epError } = await supabase.from('episodes').delete().eq('movie_id', movie.id)
    if (epError) {
      toast.error(epError.message, { id: loadingToast })
      return
    }

    const { error } = await supabase.from('movies').delete().eq('id', movie.id)
    if (error) {
      toast.error(error.message, { id: loadingToast })
      return
    }

    toast.success('Đã xóa phim', { id: loadingToast })

    if (selectedMovieId === movie.id) {
      setSelectedMovieId('')
      setSelectedMovie(null)
      setEpisodes([])
      resetEpisodeForm()
      resetMovieForm()
    }

    await fetchMovies()
  }

  const handleEditEpisode = (episode: Episode) => {
    setEditingEpisodeId(episode.id)

    // Nếu tập cũ chưa có servers (dữ liệu cũ), tự tạo 1 mảng từ video_url
    let currentServers = episode.servers || []
    if (currentServers.length === 0 && episode.video_url) {
        currentServers = [{ name: 'Mặc định', url: episode.video_url }]
    }
    if (currentServers.length === 0) {
        currentServers = [{ name: 'Server 1', url: '' }]
    }

    setEpisodeForm({
      episode_number: String(episode.episode_number),
      title: episode.title || '',
      servers: currentServers,
    })
  }

  const handleAddServer = () => {
      setEpisodeForm(prev => ({
          ...prev,
          servers: [...prev.servers, { name: `Server ${prev.servers.length + 1}`, url: '' }]
      }))
  }

  const handleRemoveServer = (index: number) => {
      setEpisodeForm(prev => ({
          ...prev,
          servers: prev.servers.filter((_, i) => i !== index)
      }))
  }

  const handleServerChange = (index: number, field: 'name' | 'url', value: string) => {
      setEpisodeForm(prev => {
          const newServers = [...prev.servers]
          newServers[index][field] = value
          return { ...prev, servers: newServers }
      })
  }

  const handleSaveEpisode = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedMovieId) {
      toast.error('Hãy chọn phim trước')
      return
    }

    if (!episodeForm.episode_number) {
      toast.error('Vui lòng nhập số tập')
      return
    }

    // Lọc ra các server hợp lệ (có url) và xử lý nhúng URL
    const validServers = episodeForm.servers
        .filter(s => s.url.trim() !== '')
        .map(s => ({
            name: s.name.trim() || 'Server',
            url: processEmbedUrl(s.url)
        }))

    if (validServers.length === 0) {
        toast.error('Vui lòng nhập ít nhất 1 link video hợp lệ')
        return
    }

    // Check link Telegram /c/
    const hasInvalidTelegram = validServers.some(s => s.url.includes('/c/'))
    if (hasInvalidTelegram) {
      toast.error('Link Telegram /c/... không dùng được. Hãy dùng link public.')
      return
    }

    const duplicate = episodes.find(
      (ep) =>
        ep.episode_number === Number(episodeForm.episode_number) &&
        ep.id !== editingEpisodeId
    )

    if (duplicate) {
      toast.error(`Tập ${episodeForm.episode_number} đã tồn tại`)
      return
    }

    setIsSavingEpisode(true)
    const loadingToast = toast.loading(editingEpisodeId ? 'Đang cập nhật tập...' : 'Đang thêm tập...')

    const payload = {
      movie_id: selectedMovieId,
      episode_number: Number(episodeForm.episode_number),
      title: episodeForm.title.trim(),
      servers: validServers,
      // Lưu link đầu tiên vào video_url để tương thích ngược với code cũ nếu cần
      video_url: validServers[0].url
    }

    if (editingEpisodeId) {
      const { error } = await supabase.from('episodes').update(payload).eq('id', editingEpisodeId)
      if (error) {
        toast.error(error.message, { id: loadingToast })
        setIsSavingEpisode(false)
        return
      }
      toast.success('Cập nhật tập thành công', { id: loadingToast })
    } else {
      const { error } = await supabase.from('episodes').insert([payload])
      if (error) {
        toast.error(error.message, { id: loadingToast })
        setIsSavingEpisode(false)
        return
      }
      toast.success('Thêm tập thành công', { id: loadingToast })
    }

    await fetchEpisodes(selectedMovieId)
    resetEpisodeForm()
    setIsSavingEpisode(false)
  }

  const handleDeleteEpisode = async (episode: Episode) => {
    const ok = window.confirm(`Xóa tập ${episode.episode_number}?`)
    if (!ok) return

    const loadingToast = toast.loading('Đang xóa tập...')

    const { error } = await supabase.from('episodes').delete().eq('id', episode.id)
    if (error) {
      toast.error(error.message, { id: loadingToast })
      return
    }

    toast.success('Đã xóa tập', { id: loadingToast })
    await fetchEpisodes(selectedMovieId)
    resetEpisodeForm()
  }

  useEffect(() => {
    if (!editingEpisodeId && selectedMovieId) {
      const nextNumber =
        episodes.length > 0 ? String(Math.max(...episodes.map((e) => e.episode_number)) + 1) : '1'
      setEpisodeForm((prev) => ({
        ...prev,
        episode_number: prev.episode_number || nextNumber,
      }))
    }
  }, [episodes, editingEpisodeId, selectedMovieId])

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-300 font-sans text-sm selection:bg-red-500/30">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#18181b',
            color: '#e4e4e7',
            border: '1px solid #27272a',
            fontSize: '13px',
          },
        }}
      />

      <nav className="sticky top-0 z-40 border-b border-zinc-900 bg-zinc-950 px-4 py-3 shadow-xl md:px-6">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
          <h1 className="flex items-center gap-2 text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-rose-400">
            🎬 ADMIN PHIM ĐAM MỸ
          </h1>
          <div className="text-[11px] text-zinc-500">
            Telegram public channel: <span className="font-bold text-red-400">@{TELEGRAM_PUBLIC_CHANNEL}</span>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-[1500px] p-4 md:p-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_1fr_1.1fr]">
          {/* SIDEBAR PHIM */}
          <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-4 shadow-lg">
            <div className="mb-4">
              <h2 className="text-sm font-black text-white">Kho phim</h2>
              <p className="mt-1 text-[11px] text-zinc-500">Chọn phim để quản lý tập</p>
            </div>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Tìm tên phim..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-200 outline-none focus:border-red-500"
              />
            </div>

            <div className="mb-4 flex gap-2">
              <button
                onClick={resetMovieForm}
                className="flex-1 rounded-xl bg-white px-3 py-2 text-xs font-bold text-black transition hover:bg-zinc-200"
              >
                + Thêm phim
              </button>
              <button
                onClick={() => selectedMovie && handleEditMovie(selectedMovie)}
                disabled={!selectedMovie}
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-40"
              >
                Sửa phim
              </button>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto custom-scrollbar pr-1">
              {isLoadingMovies ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-800/40" />
                ))
              ) : filteredMovies.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-6 text-center text-xs text-zinc-500">
                  Không có phim nào
                </div>
              ) : (
                filteredMovies.map((movie) => {
                  const isActive = selectedMovieId === movie.id
                  return (
                    <div
                      key={movie.id}
                      className={`rounded-2xl border p-3 transition ${
                        isActive
                          ? 'border-red-500/30 bg-red-500/10'
                          : 'border-zinc-800/70 bg-zinc-950/50 hover:border-zinc-700'
                      }`}
                    >
                      <button
                        onClick={() => handleSelectMovie(movie)}
                        className="w-full text-left"
                      >
                        <div className="flex gap-3">
                          <img
                            src={movie.cover_url || FALLBACK_COVER}
                            className="h-20 w-14 shrink-0 rounded-lg object-cover border border-zinc-700"
                            alt={movie.title}
                            onError={(e) => {
                              e.currentTarget.src = FALLBACK_COVER
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <h3 className="line-clamp-2 text-[13px] font-bold text-zinc-100">
                              {movie.title}
                            </h3>
                            <p className="mt-1 truncate text-[10px] text-zinc-500">
                              CP: {movie.main_cast || 'Chưa cập nhật'}
                            </p>
                            <p className="mt-1 text-[10px] text-zinc-500">
                              🌎 {movie.country || '---'}
                            </p>
                            <p className="mt-1 text-[10px] text-zinc-500">
                              📅 {movie.release_year || '---'}
                            </p>
                          </div>
                        </div>
                      </button>

                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-800/60 pt-3">
                        <span
                          className={`rounded-md px-2 py-1 text-[10px] font-black uppercase ${
                            movie.status === 'Hoàn thành'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-red-500/15 text-red-400'
                          }`}
                        >
                          {movie.status || 'Đang ra'}
                        </span>

                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleEditMovie(movie)}
                            className="rounded-md bg-zinc-800 px-2.5 py-1 text-[10px] font-bold text-zinc-200 hover:bg-zinc-700"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDeleteMovie(movie)}
                            className="rounded-md bg-red-500/10 px-2.5 py-1 text-[10px] font-bold text-red-400 hover:bg-red-500 hover:text-white"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>

          {/* FORM PHIM */}
          <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-4 shadow-lg">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-zinc-800 pb-3">
              <div>
                <h2 className="text-sm font-black text-white">
                  {editingMovieId ? 'Chỉnh sửa phim' : 'Thêm phim mới'}
                </h2>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Nhập thông tin phim bên trái, chọn phim để sửa
                </p>
              </div>
              {editingMovieId && (
                <button
                  onClick={resetMovieForm}
                  className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-[11px] font-bold text-zinc-200 hover:bg-zinc-800"
                >
                  Hủy sửa
                </button>
              )}
            </div>

            <form onSubmit={handleSaveMovie} className="space-y-4 text-xs">
              <div>
                <label className="mb-1 block font-medium text-zinc-400">Tên phim</label>
                <input
                  required
                  value={movieForm.title}
                  onChange={(e) => setMovieForm({ ...movieForm, title: e.target.value })}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-zinc-400">Ảnh bìa</label>
                <div className="flex gap-3">
                  <div className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950">
                    {movieForm.cover_url ? (
                      <img
                        src={movieForm.cover_url}
                        className="h-full w-full object-cover"
                        alt="preview"
                        onError={(e) => {
                          e.currentTarget.src = FALLBACK_COVER
                        }}
                      />
                    ) : (
                      <span className="text-[10px] text-zinc-600">Trống</span>
                    )}
                  </div>
                  <input
                    value={movieForm.cover_url}
                    onChange={(e) => setMovieForm({ ...movieForm, cover_url: e.target.value })}
                    className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
                    placeholder="Dán link ảnh..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-zinc-400">Diễn viên</label>
                  <input
                    value={movieForm.main_cast}
                    onChange={(e) => setMovieForm({ ...movieForm, main_cast: e.target.value })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-zinc-400">Đạo diễn</label>
                  <input
                    value={movieForm.director}
                    onChange={(e) => setMovieForm({ ...movieForm, director: e.target.value })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-zinc-400">Quốc gia</label>
                  <select
                    value={movieForm.country}
                    onChange={(e) => setMovieForm({ ...movieForm, country: e.target.value })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100"
                  >
                    <option value="Thái Lan">Thái Lan</option>
                    <option value="Trung Quốc">Trung Quốc</option>
                    <option value="Đài Loan">Đài Loan</option>
                    <option value="Hàn Quốc">Hàn Quốc</option>
                    <option value="Nhật Bản">Nhật Bản</option>
                    <option value="Việt Nam">Việt Nam</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-medium text-zinc-400">Năm</label>
                  <input
                    type="number"
                    value={movieForm.release_year}
                    onChange={(e) => setMovieForm({ ...movieForm, release_year: e.target.value })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-medium text-zinc-400">Tình trạng</label>
                  <select
                    value={movieForm.status}
                    onChange={(e) => setMovieForm({ ...movieForm, status: e.target.value })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100"
                  >
                    <option value="Đang ra">Đang ra</option>
                    <option value="Hoàn thành">Hoàn thành</option>
                    <option value="Sắp chiếu">Sắp chiếu</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-zinc-400">Thể loại</label>
                  <input
                    value={movieForm.genres}
                    onChange={(e) => setMovieForm({ ...movieForm, genres: e.target.value })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
                    placeholder="Boy Love, học đường..."
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-zinc-400">Rating</label>
                  <input
                    value={movieForm.rating}
                    onChange={(e) => setMovieForm({ ...movieForm, rating: e.target.value })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
                    placeholder="4.8"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium text-zinc-400">Mô tả</label>
                <textarea
                  rows={6}
                  value={movieForm.description}
                  onChange={(e) => setMovieForm({ ...movieForm, description: e.target.value })}
                  className="custom-scrollbar w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSavingMovie}
                  className="flex-1 rounded-xl bg-white py-3 text-sm font-bold text-black transition hover:bg-zinc-200 disabled:opacity-60"
                >
                  {isSavingMovie
                    ? 'Đang lưu...'
                    : editingMovieId
                    ? 'Lưu thay đổi'
                    : 'Thêm phim mới'}
                </button>
                <button
                  type="button"
                  onClick={resetMovieForm}
                  className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-bold text-zinc-200 transition hover:bg-zinc-800"
                >
                  Reset
                </button>
              </div>
            </form>
          </section>

          {/* QUẢN LÝ TẬP */}
          <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-4 shadow-lg">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-zinc-800 pb-3">
              <div>
                <h2 className="text-sm font-black text-white">Quản lý tập phim</h2>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {selectedMovie ? `Đang chọn: ${selectedMovie.title}` : 'Hãy chọn phim bên trái'}
                </p>
              </div>
              {editingEpisodeId && (
                <button
                  onClick={resetEpisodeForm}
                  className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-[11px] font-bold text-zinc-200 hover:bg-zinc-800"
                >
                  Hủy sửa tập
                </button>
              )}
            </div>

            {!selectedMovie ? (
              <div className="flex h-[500px] items-center justify-center text-center text-zinc-500">
                Chọn một phim để thêm hoặc chỉnh sửa tập
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_1fr]">
                <form onSubmit={handleSaveEpisode} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block font-medium text-zinc-400">Số tập</label>
                      <input
                        type="number"
                        value={episodeForm.episode_number}
                        onChange={(e) =>
                          setEpisodeForm({ ...episodeForm, episode_number: e.target.value })
                        }
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block font-medium text-zinc-400">Tên hiển thị</label>
                      <input
                        value={episodeForm.title}
                        onChange={(e) =>
                          setEpisodeForm({ ...episodeForm, title: e.target.value })
                        }
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
                        placeholder="VD: Tập 1"
                      />
                    </div>
                  </div>

                  {/* KHU VỰC QUẢN LÝ NHIỀU SERVER */}
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                    <div className="mb-3 flex items-center justify-between border-b border-zinc-800/60 pb-2">
                      <label className="font-bold text-zinc-300">Danh sách Link Video</label>
                      <button
                        type="button"
                        onClick={handleAddServer}
                        className="rounded-lg bg-zinc-800 px-2 py-1 text-[10px] font-bold text-zinc-200 hover:bg-zinc-700"
                      >
                        + Thêm Server
                      </button>
                    </div>

                    <div className="space-y-3">
                      {episodeForm.servers.map((server, index) => (
                        <div key={index} className="flex flex-col gap-1 rounded-lg border border-zinc-800/50 bg-zinc-900/50 p-2">
                          <div className="flex items-center justify-between mb-1">
                             <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Server {index + 1}</span>
                             {episodeForm.servers.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveServer(index)}
                                  className="text-[10px] text-red-500 hover:text-red-400 font-bold"
                                >
                                  Xóa bỏ
                                </button>
                             )}
                          </div>
                          <div className="flex gap-2">
                            <input
                              value={server.name}
                              onChange={(e) => handleServerChange(index, 'name', e.target.value)}
                              className="w-[100px] rounded-md border border-zinc-700 bg-zinc-950 p-2 text-xs outline-none text-zinc-100 focus:border-red-500"
                              placeholder="Ok.ru, Bilibili..."
                            />
                            <input
                              value={server.url}
                              onChange={(e) => handleServerChange(index, 'url', e.target.value)}
                              className="flex-1 rounded-md border border-zinc-700 bg-zinc-950 p-2 text-xs font-mono outline-none text-blue-400 focus:border-red-500"
                              placeholder="Dán link hoặc iframe..."
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={isSavingEpisode}
                      className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-60"
                    >
                      {isSavingEpisode
                        ? 'Đang lưu...'
                        : editingEpisodeId
                        ? 'Lưu tập'
                        : 'Thêm tập'}
                    </button>
                    <button
                      type="button"
                      onClick={resetEpisodeForm}
                      className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-bold text-zinc-200 transition hover:bg-zinc-800"
                    >
                      Reset
                    </button>
                  </div>
                </form>

                <div className="min-h-[420px] rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3">
                  <div className="mb-3 flex items-center justify-between border-b border-zinc-800 pb-3">
                    <h3 className="text-sm font-bold text-zinc-200">
                      Danh sách tập ({episodes.length})
                    </h3>
                    <span className="text-[11px] text-zinc-500">
                      Cập nhật: {selectedMovie ? formatDate(selectedMovie.created_at) : '---'}
                    </span>
                  </div>

                  <div className="max-h-[620px] space-y-2 overflow-y-auto custom-scrollbar pr-1">
                    {isLoadingEpisodes ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-20 animate-pulse rounded-xl bg-zinc-800/40" />
                      ))
                    ) : episodes.length === 0 ? (
                      <div className="flex h-[260px] items-center justify-center text-center text-xs italic text-zinc-500">
                        Phim này chưa có tập nào
                      </div>
                    ) : (
                      episodes.map((ep) => {
                        // Hỗ trợ hiển thị cho cả data cũ và mới
                        const currentServers = ep.servers || (ep.video_url ? [{ name: 'Mặc định', url: ep.video_url }] : [])

                        return (
                          <div
                            key={ep.id}
                            className={`rounded-xl border p-3 transition ${
                              editingEpisodeId === ep.id
                                ? 'border-red-500/30 bg-red-500/10'
                                : 'border-zinc-800 bg-zinc-900/30'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="mb-2 flex items-center gap-2">
                                  <span className="rounded-lg bg-zinc-800 px-2.5 py-1 text-[10px] font-black text-red-400">
                                    Tập {ep.episode_number}
                                  </span>
                                  <h4 className="truncate text-xs font-bold text-zinc-100">
                                    {ep.title || `Tập ${ep.episode_number}`}
                                  </h4>
                                </div>

                                {/* Hiển thị danh sách badge server */}
                                <div className="mb-2 flex flex-wrap gap-1">
                                  {currentServers.map((s, i) => (
                                     <span key={i} className="rounded border border-zinc-700 bg-zinc-800/50 px-1.5 py-0.5 text-[9px] text-zinc-400">
                                       {s.name}
                                     </span>
                                  ))}
                                </div>

                                <p className="text-[10px] text-zinc-500">
                                  Tạo ngày: {formatDate(ep.created_at)}
                                </p>
                              </div>

                              <div className="flex shrink-0 flex-col gap-1.5">
                                <button
                                  onClick={() => handleEditEpisode(ep)}
                                  className="rounded-md bg-zinc-800 px-2.5 py-1 text-[10px] font-bold text-zinc-200 hover:bg-zinc-700"
                                >
                                  Sửa
                                </button>
                                <button
                                  onClick={() => handleDeleteEpisode(ep)}
                                  className="rounded-md bg-red-500/10 px-2.5 py-1 text-[10px] font-bold text-red-400 hover:bg-red-500 hover:text-white"
                                >
                                  Xóa
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 4px; }
          `,
        }}
      />
    </main>
  )
}