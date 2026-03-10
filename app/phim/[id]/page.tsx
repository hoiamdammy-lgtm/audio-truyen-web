'use client'

import {
  memo,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const STORAGE_PLAYER_STATE = 'movie-player-state-v3'
const STORAGE_PROGRESS = 'movie-progress-v2'
const STORAGE_FAVORITES = 'movie-favorites-v1'
const STORAGE_AUTO_NEXT = 'movie-auto-next-v1'
const STORAGE_PLAYER_PREFS = 'movie-player-prefs-v1'

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&q=80&w=1200&h=1600'

const INTRO_SKIP_SECONDS = 85
const SEEK_STEP = 10

type Episode = {
  id: string
  movie_id: string
  title?: string | null
  episode_number: number
  created_at?: string | null
}

type EpisodeServer = {
  id: string
  episode_id: string
  name: string
  provider?: string | null
  url: string
  embed_url?: string | null
  source_type?: string | null
  sort_order: number
  is_active: boolean
  is_primary: boolean
  note?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type Movie = {
  id: string
  title: string
  cover_url?: string | null
  status?: string | null
  rating?: number | null
  country?: string | null
  release_year?: number | string | null
  description?: string | null
  main_cast?: string | null
  director?: string | null
  genres?: string | null
  views?: number | null
}

type WatchState = {
  movieId: string
  episodeId: string
  episodeNumber: number
  currentTime?: number
  duration?: number
  updatedAt: string
}

type ProgressItem = {
  movieId: string
  title?: string
  cover_url?: string | null
  currentEpisode?: number
  totalEpisodes?: number
  percent?: number
  currentTime?: number
  duration?: number
  updatedAt?: string
}

type PlayerPrefs = {
  playbackRate: number
  volume: number
  muted: boolean
}

type SourceType = 'telegram' | 'iframe' | 'hls' | 'mp4'

type SourceOption = {
  id: string
  key: SourceType
  label: string
  url: string
  available: boolean
  provider?: string | null
  isPrimary?: boolean
  sortOrder?: number
}

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function safeWrite(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

function normalizeText(str?: string | null) {
  return (
    str
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim() || ''
  )
}

function formatViews(value?: number | null) {
  return new Intl.NumberFormat('vi-VN').format(value || 0)
}

function parseTelegramPost(url?: string | null) {
  if (!url) return null
  const match = url.match(
    /(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(?:s\/)?([A-Za-z0-9_]+)\/(\d+)(?:\?.*)?$/i
  )
  if (!match) return null
  return {
    channel: match[1],
    postId: match[2],
    widgetValue: `${match[1]}/${match[2]}`,
    normalizedUrl: `https://t.me/${match[1]}/${match[2]}`,
  }
}

function isTelegramUrl(url?: string | null) {
  return !!parseTelegramPost(url)
}

function detectSourceType(url?: string | null, provider?: string | null): SourceType {
  const value = url?.toLowerCase() || ''
  const p = provider?.toLowerCase() || ''

  if (p === 'telegram' || isTelegramUrl(value)) return 'telegram'
  if (value.includes('.m3u8')) return 'hls'
  if (value.endsWith('.mp4') || value.includes('.mp4?')) return 'mp4'
  return 'iframe'
}

function getSourceOptions(servers: EpisodeServer[]): SourceOption[] {
  return [...servers]
    .filter((server) => server.is_active && !!server.url)
    .sort((a, b) => {
      if (a.is_primary === b.is_primary) return a.sort_order - b.sort_order
      return a.is_primary ? -1 : 1
    })
    .map((server) => {
      const type = detectSourceType(server.embed_url || server.url, server.provider)
      const finalUrl =
        type === 'telegram'
          ? parseTelegramPost(server.embed_url || server.url)?.normalizedUrl ||
            server.embed_url ||
            server.url
          : server.embed_url || server.url

      return {
        id: server.id,
        key: type,
        label: server.name || 'Server',
        url: finalUrl,
        available: true,
        provider: server.provider,
        isPrimary: server.is_primary,
        sortOrder: server.sort_order,
      }
    })
}

function normalizeProgressData(
  raw: Record<string, ProgressItem> | ProgressItem[] | unknown
): Record<string, ProgressItem> {
  if (!raw) return {}
  if (Array.isArray(raw)) {
    return raw.reduce<Record<string, ProgressItem>>((acc, item) => {
      if (item?.movieId) acc[item.movieId] = item
      return acc
    }, {})
  }
  if (typeof raw === 'object') {
    return raw as Record<string, ProgressItem>
  }
  return {}
}

function getEpisodeProgressMap(movieId: string) {
  return safeRead<Record<string, number>>(`${STORAGE_PROGRESS}:${movieId}`, {})
}

function setEpisodeProgressMap(movieId: string, value: Record<string, number>) {
  safeWrite(`${STORAGE_PROGRESS}:${movieId}`, value)
}

const TelegramPostEmbed = memo(function TelegramPostEmbed({ url }: { url: string }) {
  const telegram = useMemo(() => parseTelegramPost(url), [url])
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!telegram || !containerRef.current) return
    const container = containerRef.current
    container.innerHTML = ''

    const script = document.createElement('script')
    script.async = true
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-post', telegram.widgetValue)
    script.setAttribute('data-width', '100%')
    script.setAttribute('data-userpic', 'false')
    script.setAttribute('data-dark', '1')
    container.appendChild(script)

    return () => {
      container.innerHTML = ''
    }
  }, [telegram?.widgetValue])

  if (!telegram) return null

  return (
    <div className="flex h-full w-full items-center justify-center overflow-auto bg-[#0a0a0a] p-4 md:p-6">
      <div
        ref={containerRef}
        className="w-full max-w-[600px] overflow-hidden rounded-2xl shadow-2xl"
      />
    </div>
  )
})

const EpisodeGrid = memo(function EpisodeGrid({
  episodes,
  currentEpisodeId,
  onSelect,
  progressMap,
  isTheaterMode,
}: {
  episodes: Episode[]
  currentEpisodeId?: string
  onSelect: (episode: Episode) => void
  progressMap: Record<string, number>
  isTheaterMode: boolean
}) {
  return (
    <div
      className={`grid gap-3 ${
        isTheaterMode
          ? 'grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10'
          : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5'
      }`}
    >
      {episodes.map((ep) => {
        const isPlaying = currentEpisodeId === ep.id
        const progress = progressMap[ep.id] || 0

        return (
          <button
            key={ep.id}
            type="button"
            onClick={() => onSelect(ep)}
            title={ep.title || `Tập ${ep.episode_number}`}
            className={`group relative flex flex-col items-center justify-center overflow-hidden rounded-xl px-2 py-3 transition-all duration-300 ${
              isPlaying
                ? 'z-10 scale-105 bg-red-600 shadow-[0_4px_20px_-4px_rgba(220,38,38,0.5)] ring-2 ring-red-500 ring-offset-2 ring-offset-[#0d0d0f]'
                : 'border border-white/10 bg-white/[0.03] hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08]'
            }`}
          >
            <div className="relative z-10 flex flex-col items-center gap-1 text-center">
              <span
                className={`text-[10px] font-medium uppercase tracking-widest ${
                  isPlaying ? 'text-red-100' : 'text-zinc-500 group-hover:text-zinc-400'
                }`}
              >
                Tập {ep.episode_number}
              </span>

              {!!ep.title?.trim() && ep.title.trim() !== `Tập ${ep.episode_number}` && (
                <span
                  className={`line-clamp-2 text-[11px] font-semibold leading-4 ${
                    isPlaying ? 'text-white' : 'text-zinc-300'
                  }`}
                >
                  {ep.title.trim()}
                </span>
              )}
            </div>

            {progress > 0 && (
              <div className="absolute bottom-0 left-0 h-1 w-full bg-white/10">
                <div
                  className={`h-full ${isPlaying ? 'bg-white' : 'bg-red-500'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
})

const ShortcutModal = memo(function ShortcutModal({
  onClose,
}: {
  onClose: () => void
}) {
  const items = [
    ['Space', 'Phát / tạm dừng'],
    ['← / →', 'Tua 10 giây'],
    ['I', 'Bỏ qua intro'],
    ['N / P', 'Tập sau / trước'],
    ['F', 'Fullscreen'],
    ['T', 'Rạp phim'],
    ['L', 'Tắt / bật đèn'],
    ['M', 'Tắt tiếng'],
    ['?', 'Mở / đóng trợ giúp'],
  ]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 backdrop-blur-md transition-opacity duration-300">
      <div className="animate-in fade-in zoom-in-95 w-full max-w-md scale-100 rounded-3xl border border-white/10 bg-[#121214] p-6 shadow-2xl duration-200">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Phím tắt</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map(([key, value]) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-xl border border-white/5 bg-black/40 px-4 py-3"
            >
              <span className="rounded bg-white/10 px-2 py-1 text-xs font-bold text-white">{key}</span>
              <span className="text-sm font-medium text-zinc-400">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

export default function PhimPlayerPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const unwrappedParams = params instanceof Promise ? use(params) : params
  const movieId = unwrappedParams?.id

  const [movie, setMovie] = useState<Movie | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [episodeServersMap, setEpisodeServersMap] = useState<Record<string, EpisodeServer[]>>({})
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null)
  const [activeServerId, setActiveServerId] = useState<string>('')

  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [playerError, setPlayerError] = useState('')

  const [episodeSearch, setEpisodeSearch] = useState('')
  const [showDescription, setShowDescription] = useState(false)

  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [reported, setReported] = useState(false)

  const [isLightsOut, setIsLightsOut] = useState(false)
  const [isTheaterMode, setIsTheaterMode] = useState(false)
  const [isAutoNext, setIsAutoNext] = useState(true)

  const [playbackRate, setPlaybackRate] = useState(1)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)

  const [isClientMounted, setIsClientMounted] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const playerContainerRef = useRef<HTMLDivElement | null>(null)
  const lastProgressSavedRef = useRef(0)
  const restoreDoneRef = useRef<string | null>(null)

  useEffect(() => {
    setIsClientMounted(true)
    setFavoriteIds(safeRead<string[]>(STORAGE_FAVORITES, []))
    setIsAutoNext(safeRead<boolean>(STORAGE_AUTO_NEXT, true))

    const prefs = safeRead<PlayerPrefs>(STORAGE_PLAYER_PREFS, {
      playbackRate: 1,
      volume: 1,
      muted: false,
    })

    setPlaybackRate(prefs.playbackRate || 1)
    setVolume(typeof prefs.volume === 'number' ? prefs.volume : 1)
    setMuted(!!prefs.muted)
  }, [])

  useEffect(() => {
    if (!isClientMounted) return
    safeWrite(STORAGE_PLAYER_PREFS, { playbackRate, volume, muted })
  }, [playbackRate, volume, muted, isClientMounted])

  const persistWatchState = useCallback(
    (episode: Episode, percent?: number, currentTime?: number, duration?: number) => {
      const now = new Date().toISOString()

      const watchState = safeRead<Record<string, WatchState>>(STORAGE_PLAYER_STATE, {})
      watchState[episode.movie_id] = {
        movieId: episode.movie_id,
        episodeId: episode.id,
        episodeNumber: episode.episode_number,
        currentTime,
        duration,
        updatedAt: now,
      }
      safeWrite(STORAGE_PLAYER_STATE, watchState)

      const rawProgress = safeRead<Record<string, ProgressItem> | ProgressItem[]>(
        STORAGE_PROGRESS,
        {}
      )
      const progressMap = normalizeProgressData(rawProgress)
      const prev = progressMap[episode.movie_id] || {}

      progressMap[episode.movie_id] = {
        movieId: episode.movie_id,
        title: movie?.title || prev.title || '',
        cover_url: movie?.cover_url || prev.cover_url || '',
        currentEpisode: episode.episode_number,
        totalEpisodes: episodes.length || prev.totalEpisodes || 0,
        percent:
          typeof percent === 'number'
            ? Math.max(0, Math.min(100, Math.round(percent)))
            : prev.currentEpisode === episode.episode_number
              ? prev.percent
              : 0,
        currentTime,
        duration,
        updatedAt: now,
      }
      safeWrite(STORAGE_PROGRESS, progressMap)

      if (typeof percent === 'number') {
        const perEpisode = getEpisodeProgressMap(episode.movie_id)
        perEpisode[episode.id] = Math.max(0, Math.min(100, Math.round(percent)))
        setEpisodeProgressMap(episode.movie_id, perEpisode)
      }
    },
    [movie, episodes.length]
  )

  const fetchMovieData = useCallback(async (id: string) => {
    setIsLoading(true)
    setFetchError('')
    setPlayerError('')

    const [movieRes, episodeRes] = await Promise.all([
      supabase.from('movies').select('*').eq('id', id).single(),
      supabase
        .from('episodes')
        .select('id, movie_id, title, episode_number, created_at')
        .eq('movie_id', id)
        .order('episode_number', { ascending: true }),
    ])

    if (movieRes.error || !movieRes.data) {
      setFetchError('Lỗi kết nối máy chủ hoặc phim không tồn tại.')
      setIsLoading(false)
      return
    }

    const movieData = movieRes.data as Movie
    const episodeData = (episodeRes.data as Episode[]) || []

    setMovie(movieData)
    setEpisodes(episodeData)

    if (episodeData.length === 0) {
      setCurrentEpisode(null)
      setEpisodeServersMap({})
      setIsLoading(false)
      return
    }

    const episodeIds = episodeData.map((ep) => ep.id)

    const serverRes = await supabase
      .from('episode_servers')
      .select('*')
      .in('episode_id', episodeIds)
      .eq('is_active', true)
      .order('episode_id', { ascending: true })
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true })

    const serverList = (serverRes.data as EpisodeServer[]) || []
    const groupedServers = serverList.reduce<Record<string, EpisodeServer[]>>((acc, item) => {
      if (!acc[item.episode_id]) acc[item.episode_id] = []
      acc[item.episode_id].push(item)
      return acc
    }, {})

    setEpisodeServersMap(groupedServers)

    const stored = safeRead<Record<string, WatchState>>(STORAGE_PLAYER_STATE, {})
    const last = stored[id]

    const matchedEpisode =
      episodeData.find((ep) => ep.id === last?.episodeId) ||
      episodeData.find((ep) => ep.episode_number === last?.episodeNumber) ||
      episodeData[0]

    setCurrentEpisode(matchedEpisode)

    const matchedEpisodeServers = groupedServers[matchedEpisode.id] || []
    const sourceOptions = getSourceOptions(matchedEpisodeServers)
    setActiveServerId(sourceOptions[0]?.id || '')
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (!movieId) return
    fetchMovieData(movieId)
  }, [movieId, fetchMovieData])

  const currentEpisodeServers = useMemo(() => {
    if (!currentEpisode) return []
    return episodeServersMap[currentEpisode.id] || []
  }, [episodeServersMap, currentEpisode])

  const sourceOptions = useMemo(() => {
    return getSourceOptions(currentEpisodeServers)
  }, [currentEpisodeServers])

  const activeSource = useMemo(() => {
    return sourceOptions.find((s) => s.id === activeServerId) || sourceOptions[0]
  }, [sourceOptions, activeServerId])

  const playableUrl = activeSource?.url || ''
  const sourceType = activeSource?.key || 'iframe'

  useEffect(() => {
    if (!currentEpisode) return
    setPlayerError('')
    persistWatchState(currentEpisode)
  }, [currentEpisode, persistWatchState])

  useEffect(() => {
    if (!currentEpisode) return
    const options = getSourceOptions(episodeServersMap[currentEpisode.id] || [])
    setActiveServerId((prev) => {
      if (prev && options.some((item) => item.id === prev)) return prev
      return options[0]?.id || ''
    })
  }, [currentEpisode, episodeServersMap])

  const filteredEpisodes = useMemo(() => {
    const keyword = normalizeText(episodeSearch)
    if (!keyword) return episodes
    return episodes.filter((ep) => {
      const byTitle = normalizeText(ep.title).includes(keyword)
      const byNumber = String(ep.episode_number).includes(keyword)
      return byTitle || byNumber
    })
  }, [episodes, episodeSearch])

  const currentIndex = useMemo(() => {
    if (!currentEpisode) return -1
    return episodes.findIndex((ep) => ep.id === currentEpisode.id)
  }, [episodes, currentEpisode])

  const prevEpisode = currentIndex > 0 ? episodes[currentIndex - 1] : null
  const nextEpisode =
    currentIndex >= 0 && currentIndex < episodes.length - 1
      ? episodes[currentIndex + 1]
      : null

  const episodeProgressMap = useMemo(() => {
    return movie?.id ? getEpisodeProgressMap(movie.id) : {}
  }, [movie?.id, currentEpisode?.id])

  const isFavorite = movie ? favoriteIds.includes(movie.id) : false
  const isTelegramSource = sourceType === 'telegram'
  const canUseNativeVideo = sourceType === 'hls' || sourceType === 'mp4'

  const handleChangeEpisode = useCallback(
    (episode: Episode) => {
      setCurrentEpisode(episode)
      restoreDoneRef.current = null
      setPlayerError('')

      const nextOptions = getSourceOptions(episodeServersMap[episode.id] || [])
      setActiveServerId(nextOptions[0]?.id || '')

      if (!isTheaterMode && window.innerWidth >= 1024) {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    },
    [episodeServersMap, isTheaterMode]
  )

  const toggleAutoNext = useCallback(() => {
    setIsAutoNext((prev) => {
      const next = !prev
      safeWrite(STORAGE_AUTO_NEXT, next)
      return next
    })
  }, [])

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]
      safeWrite(STORAGE_FAVORITES, next)
      return next
    })
  }, [])

  const handleSkip = useCallback((seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime + seconds)
    }
  }, [])

  const cyclePlaybackRate = useCallback(() => {
    const rates = [0.75, 1, 1.25, 1.5, 1.75, 2]
    const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length
    const newRate = rates[nextIndex]
    setPlaybackRate(newRate)
    if (videoRef.current) videoRef.current.playbackRate = newRate
  }, [playbackRate])

  const handleReport = useCallback(() => {
    setReported(true)
    setTimeout(() => setReported(false), 2500)
  }, [])

  const handleCopyPageLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }, [])

  const handleVideoLoadedMetadata = useCallback(() => {
    const video = videoRef.current
    if (!video || !currentEpisode || restoreDoneRef.current === currentEpisode.id) return

    video.playbackRate = playbackRate
    video.volume = volume
    video.muted = muted

    const stored = safeRead<Record<string, WatchState>>(STORAGE_PLAYER_STATE, {})
    const last = stored[currentEpisode.movie_id]

    if (
      last?.episodeId === currentEpisode.id &&
      typeof last.currentTime === 'number' &&
      last.currentTime > 5 &&
      video.duration > 0 &&
      last.currentTime < video.duration - 5
    ) {
      video.currentTime = last.currentTime
    }

    persistWatchState(currentEpisode, undefined, video.currentTime, video.duration)
    restoreDoneRef.current = currentEpisode.id
  }, [currentEpisode, persistWatchState, playbackRate, volume, muted])

  const handleVideoTimeUpdate = useCallback(() => {
    const video = videoRef.current
    if (!video || !currentEpisode || !video.duration || Number.isNaN(video.duration)) return

    const now = Date.now()
    if (now - lastProgressSavedRef.current < 2500) return
    lastProgressSavedRef.current = now

    const percent = (video.currentTime / video.duration) * 100
    persistWatchState(currentEpisode, percent, video.currentTime, video.duration)
  }, [currentEpisode, persistWatchState])

  const handleVideoEnded = useCallback(() => {
    if (!currentEpisode) return

    const duration = videoRef.current?.duration || 0
    persistWatchState(currentEpisode, 100, duration, duration)

    if (isAutoNext && nextEpisode) {
      handleChangeEpisode(nextEpisode)
    }
  }, [currentEpisode, persistWatchState, isAutoNext, nextEpisode, handleChangeEpisode])

  const handleTogglePiP = useCallback(async () => {
    try {
      if (videoRef.current && document.pictureInPictureEnabled) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture()
        } else {
          await videoRef.current.requestPictureInPicture()
        }
      }
    } catch {}
  }, [])

  const handleToggleFullscreen = useCallback(async () => {
    try {
      const el = playerContainerRef.current
      if (!el) return

      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await el.requestFullscreen()
      }
    } catch {}
  }, [])

  const tryNextSource = useCallback(() => {
    if (!currentEpisode || sourceOptions.length <= 1) {
      setPlayerError('Không có nguồn phát khả dụng vào lúc này.')
      return
    }

    const currentIdx = sourceOptions.findIndex((item) => item.id === activeServerId)
    const next =
      currentIdx >= 0 && currentIdx < sourceOptions.length - 1
        ? sourceOptions[currentIdx + 1]
        : sourceOptions[0]

    if (next && next.id !== activeServerId) {
      setActiveServerId(next.id)
      setPlayerError(`Nguồn phát lỗi. Tự động chuyển qua ${next.label}.`)
    } else {
      setPlayerError('Không có nguồn phát khả dụng vào lúc này.')
    }
  }, [currentEpisode, sourceOptions, activeServerId])

  useEffect(() => {
    const handleBeforeUnload = () => {
      const video = videoRef.current
      if (!video || !currentEpisode || !video.duration || Number.isNaN(video.duration)) return
      const percent = (video.currentTime / video.duration) * 100
      persistWatchState(currentEpisode, percent, video.currentTime, video.duration)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [currentEpisode, persistWatchState])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const isTyping = tag === 'input' || tag === 'textarea' || target?.isContentEditable
      if (isTyping) return

      if (e.key === 'Escape' && isLightsOut) setIsLightsOut(false)
      if (e.key === '?') setShowShortcuts((v) => !v)
      if (e.key.toLowerCase() === 'l') setIsLightsOut((v) => !v)
      if (e.key.toLowerCase() === 't') setIsTheaterMode((v) => !v)
      if (e.key.toLowerCase() === 'n' && nextEpisode) handleChangeEpisode(nextEpisode)
      if (e.key.toLowerCase() === 'p' && prevEpisode) handleChangeEpisode(prevEpisode)

      if (canUseNativeVideo) {
        if (e.key === 'ArrowLeft') handleSkip(-SEEK_STEP)
        if (e.key === 'ArrowRight') handleSkip(SEEK_STEP)
        if (e.key.toLowerCase() === 'i') handleSkip(INTRO_SKIP_SECONDS)
        if (e.key.toLowerCase() === 'f') void handleToggleFullscreen()

        if (e.key.toLowerCase() === 'm' && videoRef.current) {
          const nextMuted = !videoRef.current.muted
          videoRef.current.muted = nextMuted
          setMuted(nextMuted)
        }

        if (e.key === ' ' && videoRef.current) {
          e.preventDefault()
          if (videoRef.current.paused) {
            void videoRef.current.play()
          } else {
            videoRef.current.pause()
          }
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    isLightsOut,
    nextEpisode,
    prevEpisode,
    canUseNativeVideo,
    handleChangeEpisode,
    handleSkip,
    handleToggleFullscreen,
  ])

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 font-bold text-red-500">
        <div className="mb-6 h-14 w-14 animate-spin rounded-full border-4 border-red-500/20 border-t-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]" />
        <span className="animate-pulse tracking-widest">ĐANG TẢI DỮ LIỆU...</span>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-center">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#121214] p-10 shadow-2xl">
          <div className="mb-6 text-6xl">⚠️</div>
          <h2 className="text-xl font-bold leading-relaxed text-white">{fetchError}</h2>
          <button
            type="button"
            onClick={() => movieId && fetchMovieData(movieId)}
            className="mt-8 h-12 w-full rounded-xl bg-red-600 font-bold text-white transition hover:bg-red-500 hover:shadow-lg hover:shadow-red-600/20"
          >
            Tải lại trang
          </button>
        </div>
      </div>
    )
  }

  if (!movie) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-lg font-medium text-zinc-500">
        Không tìm thấy dữ liệu phim.
      </div>
    )
  }

  return (
    <main className="relative min-h-screen bg-zinc-950 pb-24 font-sans text-zinc-200 selection:bg-red-500/30">
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.1),transparent_50%),linear-gradient(to_bottom,#09090b,#09090b)]" />

      {movie.cover_url && (
        <div
          className="pointer-events-none fixed inset-0 -z-30 opacity-10 blur-[100px]"
          style={{
            backgroundImage: `url(${movie.cover_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}

      {isLightsOut && (
        <div
          className="fixed inset-0 z-40 bg-black/95 backdrop-blur-md transition-opacity duration-500"
          onClick={() => setIsLightsOut(false)}
        />
      )}

      {showShortcuts && <ShortcutModal onClose={() => setShowShortcuts(false)} />}

      <header
        className={`sticky top-0 z-30 border-b border-white/5 bg-zinc-950/70 backdrop-blur-xl transition-all duration-300 ${
          isLightsOut ? 'pointer-events-none -translate-y-full opacity-0' : 'translate-y-0 opacity-100'
        }`}
      >
        <div className="mx-auto flex w-full max-w-[1800px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/phim"
            className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:-translate-x-0.5"><path d="m15 18-6-6 6-6"/></svg>
          </Link>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-white sm:text-lg">
              {movie.title}
            </h1>
            {currentEpisode && (
              <p className="truncate text-xs font-medium text-red-400 sm:text-sm">
                Đang phát: Tập {currentEpisode.episode_number}
                {currentEpisode.title ? ` · ${currentEpisode.title}` : ''}
              </p>
            )}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <button
              type="button"
              onClick={() => setShowShortcuts(true)}
              className="flex h-10 items-center gap-2 rounded-xl bg-white/5 px-4 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
              Phím tắt
            </button>

            <button
              type="button"
              onClick={() => toggleFavorite(movie.id)}
              className={`flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold transition-all ${
                isFavorite
                  ? 'bg-pink-500/10 text-pink-400 ring-1 ring-pink-500/30'
                  : 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
              {isFavorite ? 'Đã lưu' : 'Yêu thích'}
            </button>
          </div>
        </div>
      </header>

      <div className={`mx-auto w-full px-4 py-6 transition-all duration-500 sm:px-6 lg:px-8 ${isTheaterMode ? 'max-w-[2000px]' : 'max-w-[1800px]'}`}>
        <div className={`flex flex-col gap-6 lg:gap-8 ${isTheaterMode ? '' : 'lg:flex-row'}`}>
          <div className={`flex flex-col transition-all duration-500 ${isLightsOut ? 'z-50' : 'z-10'} ${isTheaterMode ? 'w-full' : 'w-full shrink-0 lg:w-[65%] xl:w-[70%]'}`}>
            <section className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0f] shadow-2xl ring-1 ring-white/5">
              <div
                ref={playerContainerRef}
                onDoubleClick={() => {
                  if (canUseNativeVideo) void handleToggleFullscreen()
                }}
                className={`relative w-full flex-shrink-0 bg-black transition-all duration-500 ${
                  isTelegramSource
                    ? 'h-[40vh] min-h-[350px] sm:h-[50vh] lg:h-[65vh]'
                    : isTheaterMode
                      ? 'aspect-video max-h-[85vh]'
                      : 'aspect-video'
                }`}
              >
                {currentEpisode && playableUrl ? (
                  sourceType === 'telegram' ? (
                    <div className="absolute inset-0 overflow-hidden bg-[#0a0a0a]">
                      <TelegramPostEmbed url={playableUrl} />
                    </div>
                  ) : sourceType === 'iframe' ? (
                    <iframe
                      key={`${currentEpisode.id}-${activeServerId}`}
                      src={playableUrl}
                      className="absolute inset-0 h-full w-full"
                      frameBorder="0"
                      allowFullScreen
                      allow="autoplay; fullscreen; picture-in-picture"
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  ) : (
                    <video
                      key={`${currentEpisode.id}-${activeServerId}`}
                      ref={videoRef}
                      src={playableUrl}
                      controls
                      playsInline
                      preload="metadata"
                      poster={movie.cover_url || FALLBACK_COVER}
                      className="absolute inset-0 h-full w-full bg-black outline-none"
                      onLoadedMetadata={handleVideoLoadedMetadata}
                      onTimeUpdate={handleVideoTimeUpdate}
                      onEnded={handleVideoEnded}
                      onError={() => tryNextSource()}
                      onPause={() => {
                        const video = videoRef.current
                        if (!video || !currentEpisode || !video.duration || Number.isNaN(video.duration)) return
                        const percent = (video.currentTime / video.duration) * 100
                        persistWatchState(currentEpisode, percent, video.currentTime, video.duration)
                      }}
                      onVolumeChange={() => {
                        if (!videoRef.current) return
                        setVolume(videoRef.current.volume)
                        setMuted(videoRef.current.muted)
                      }}
                    />
                  )
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                    <span className="animate-pulse text-5xl opacity-30">🔌</span>
                    <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">
                      Phim chưa có nguồn phát
                    </p>
                  </div>
                )}

                <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/80 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />

                {playerError && (
                  <div className="absolute left-1/2 top-6 z-20 -translate-x-1/2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-5 py-3 text-sm font-medium text-amber-200 backdrop-blur-md">
                    {playerError}
                  </div>
                )}

                {currentEpisode && (
                  <div className="absolute right-4 top-4 z-20 hidden items-center gap-2 sm:flex">
                    <span className="rounded-lg border border-white/10 bg-black/50 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
                      Tập {currentEpisode.episode_number}
                    </span>
                    {activeSource && (
                      <span className="rounded-lg border border-red-500/50 bg-red-600/80 px-3 py-1.5 text-xs font-bold uppercase text-white backdrop-blur-md">
                        {activeSource.label}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-white/5 bg-[#121214] p-4 sm:px-6">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!prevEpisode}
                        onClick={() => prevEpisode && handleChangeEpisode(prevEpisode)}
                        className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-white/5 text-sm font-semibold text-zinc-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 sm:flex-none sm:px-4"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                        <span className="hidden sm:inline">Tập trước</span>
                      </button>

                      <button
                        type="button"
                        disabled={!nextEpisode}
                        onClick={() => nextEpisode && handleChangeEpisode(nextEpisode)}
                        className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-bold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-30 sm:flex-none sm:px-5"
                      >
                        <span className="hidden sm:inline">Tập tiếp</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                      </button>
                    </div>

                    <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                      {canUseNativeVideo && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSkip(-SEEK_STEP)}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                            title="Tua lại 10 giây"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSkip(SEEK_STEP)}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                            title="Tua tới 10 giây"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M12 7v5l-4 2"/></svg>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSkip(INTRO_SKIP_SECONDS)}
                            className="flex h-10 shrink-0 items-center justify-center rounded-xl bg-white/5 px-4 text-xs font-bold text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            Bỏ qua Intro
                          </button>
                        </>
                      )}

                      <label className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-white/5 px-4 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/10">
                        <input
                          type="checkbox"
                          checked={isAutoNext}
                          onChange={toggleAutoNext}
                          className="h-4 w-4 rounded border-white/20 bg-black/50 text-red-600 focus:ring-red-600 focus:ring-offset-0"
                        />
                        Tự chuyển tập
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between gap-4 border-t border-white/5 pt-4 xl:flex-row xl:items-center">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mr-1 hidden text-xs font-medium text-zinc-500 sm:block">
                        Nguồn phát:
                      </span>
                      {sourceOptions.filter((i) => i.available).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setPlayerError('')
                            setActiveServerId(item.id)
                          }}
                          className={`flex h-8 items-center justify-center rounded-lg px-3 text-xs font-bold transition-all ${
                            activeServerId === item.id
                              ? 'bg-red-500/10 text-red-500 ring-1 ring-red-500/50'
                              : 'bg-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                          }`}
                        >
                          {item.label}
                          {item.isPrimary ? ' • Chính' : ''}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {canUseNativeVideo && (
                        <>
                          <button
                            type="button"
                            onClick={cyclePlaybackRate}
                            className="flex h-8 items-center justify-center rounded-lg bg-white/5 px-3 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/10"
                          >
                            {playbackRate}x
                          </button>

                          <button
                            type="button"
                            onClick={handleTogglePiP}
                            className="flex h-8 items-center justify-center rounded-lg bg-white/5 px-3 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/10"
                          >
                            PiP
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleToggleFullscreen()}
                            className="flex h-8 items-center justify-center rounded-lg bg-white/5 px-3 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/10"
                          >
                            Full
                          </button>

                          <div className="hidden h-8 items-center gap-2 rounded-lg bg-white/5 px-3 sm:flex">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.05}
                              value={muted ? 0 : volume}
                              onChange={(e) => {
                                const next = Number(e.target.value)
                                setVolume(next)
                                setMuted(next === 0)
                                if (videoRef.current) {
                                  videoRef.current.volume = next
                                  videoRef.current.muted = next === 0
                                }
                              }}
                              className="w-16 cursor-pointer accent-red-500"
                            />
                          </div>
                        </>
                      )}

                      <div className="mx-1 hidden h-4 w-px bg-white/10 sm:block" />

                      <button
                        type="button"
                        onClick={() => setIsTheaterMode((v) => !v)}
                        className={`flex h-8 items-center justify-center rounded-lg px-3 text-xs font-semibold transition-all ${
                          isTheaterMode
                            ? 'bg-white/20 text-white'
                            : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                        }`}
                      >
                        {isTheaterMode ? 'Thu nhỏ' : 'Rạp phim'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsLightsOut((v) => !v)}
                        className={`flex h-8 items-center justify-center rounded-lg px-3 text-xs font-semibold transition-all ${
                          isLightsOut
                            ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/50'
                            : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                        }`}
                      >
                        {isLightsOut ? 'Bật đèn' : 'Tắt đèn'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section
              className={`mt-6 overflow-hidden rounded-2xl border border-white/5 bg-[#121214]/50 backdrop-blur-sm transition-all duration-500 ${
                isLightsOut ? 'mt-0 h-0 border-none opacity-0' : 'opacity-100'
              }`}
            >
              <div className="flex flex-col justify-between gap-4 border-b border-white/5 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                <div>
                  <h2 className="text-xl font-black text-white md:text-2xl">{movie.title}</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {movie.status || 'Đang cập nhật'} • {movie.release_year || 'N/A'} • {movie.country || 'N/A'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCopyPageLink}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white/5 px-3 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/10"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
                    {copied ? 'Đã copy' : 'Chia sẻ'}
                  </button>

                  <button
                    type="button"
                    onClick={handleReport}
                    className={`flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all ${
                      reported
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-white/5 text-zinc-300 hover:bg-red-500/10 hover:text-red-400'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
                    {reported ? 'Đã báo cáo' : 'Báo lỗi'}
                  </button>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
                  <div className="space-y-4">
                    <p
                      className={`text-sm leading-relaxed text-zinc-400 transition-all duration-300 ${
                        showDescription ? '' : 'line-clamp-4'
                      }`}
                    >
                      {movie.description || 'Chưa có thông tin mô tả nội dung.'}
                    </p>

                    {(movie.description?.length || 0) > 250 && (
                      <button
                        type="button"
                        onClick={() => setShowDescription((v) => !v)}
                        className="text-xs font-bold text-red-500 transition-colors hover:text-red-400"
                      >
                        {showDescription ? 'Thu gọn' : 'Đọc thêm'}
                      </button>
                    )}
                  </div>

                  <div className="rounded-xl border border-white/5 bg-black/20 p-5 text-sm">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <span className="text-zinc-500">Đánh giá</span>
                        <span className="flex items-center gap-1 font-bold text-yellow-500">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          {movie.rating || 'N/A'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <span className="text-zinc-500">Lượt xem</span>
                        <span className="font-semibold text-zinc-300">{formatViews(movie.views)}</span>
                      </div>

                      <div className="flex flex-col gap-1 border-b border-white/5 pb-3">
                        <span className="text-zinc-500">Đạo diễn</span>
                        <span className="font-medium text-zinc-300">{movie.director || 'Đang cập nhật'}</span>
                      </div>

                      <div className="flex flex-col gap-1 border-b border-white/5 pb-3">
                        <span className="text-zinc-500">Diễn viên</span>
                        <span className="line-clamp-2 font-medium text-zinc-300">{movie.main_cast || 'Đang cập nhật'}</span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-zinc-500">Thể loại</span>
                        <span className="line-clamp-2 font-medium text-zinc-300">{movie.genres || 'Đang cập nhật'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside
            className={`flex flex-col gap-6 transition-all duration-500 ${
              isLightsOut ? 'h-0 overflow-hidden opacity-0' : 'opacity-100'
            } ${isTheaterMode ? 'w-full' : 'w-full shrink-0 lg:w-[35%] xl:w-[30%]'}`}
          >
            <div
              className={`flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121214] shadow-xl ${
                isTheaterMode
                  ? 'h-auto max-h-[600px]'
                  : 'h-auto max-h-[calc(100vh-6rem)] lg:sticky lg:top-20'
              }`}
            >
              <div className="border-b border-white/5 bg-[#0d0d0f] p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2.5 text-base font-bold text-white">
                    <span className="flex h-6 w-1.5 rounded-full bg-red-600" />
                    Danh sách tập
                  </h3>
                  <span className="rounded-lg border border-white/5 bg-white/5 px-2.5 py-1 text-xs font-semibold text-zinc-400">
                    {episodes.length} tập
                  </span>
                </div>

                {episodes.length > 8 && (
                  <div className="relative">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    <input
                      type="text"
                      placeholder="Tìm tập (VD: 12)..."
                      value={episodeSearch}
                      onChange={(e) => setEpisodeSearch(e.target.value)}
                      className="h-10 w-full rounded-xl border border-white/10 bg-black/50 pl-10 pr-4 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-red-500/50 focus:bg-black"
                    />
                  </div>
                )}
              </div>

              {episodes.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
                  <span className="mb-4 block text-4xl opacity-20">🎞️</span>
                  <p className="text-sm font-medium text-zinc-500">Phim đang cập nhật tập mới</p>
                </div>
              ) : (
                <div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 flex-1 overflow-y-auto p-4 sm:p-5">
                  <EpisodeGrid
                    episodes={filteredEpisodes}
                    currentEpisodeId={currentEpisode?.id}
                    onSelect={handleChangeEpisode}
                    progressMap={episodeProgressMap}
                    isTheaterMode={isTheaterMode}
                  />
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {!isLightsOut && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/90 px-4 py-3 backdrop-blur-lg lg:hidden">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <button
              type="button"
              disabled={!prevEpisode}
              onClick={() => prevEpisode && handleChangeEpisode(prevEpisode)}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-white/5 text-sm font-semibold text-zinc-300 transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-30"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              Trước
            </button>

            <button
              type="button"
              onClick={() => setIsLightsOut((v) => !v)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5 text-zinc-300 transition-colors hover:bg-white/10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
            </button>

            <button
              type="button"
              disabled={!nextEpisode}
              onClick={() => nextEpisode && handleChangeEpisode(nextEpisode)}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-bold text-white transition-colors hover:bg-red-500 disabled:pointer-events-none disabled:opacity-30"
            >
              Sau
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          </div>
        </div>
      )}
    </main>
  )
}