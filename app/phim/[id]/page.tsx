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
const STORAGE_PLAYER_UI = 'movie-player-ui-v2'

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&q=80&w=1200&h=1600'

const INTRO_SKIP_SECONDS = 85
const SEEK_STEP = 10
const AUTO_NEXT_COUNTDOWN = 5
const EPISODES_PER_WINDOW = 20

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

type PanelTab = 'episodes' | 'details' | 'settings'
type EpisodeLayout = 'grid' | 'list'
type EpisodeSort = 'asc' | 'desc'
type ToastType = 'success' | 'error' | 'info'

type PlayerUiState = {
  activeTab: PanelTab
  episodeLayout: EpisodeLayout
  episodeSort: EpisodeSort
}

type ToastItem = {
  id: number
  message: string
  type: ToastType
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

function formatTime(seconds?: number | null) {
  if (!seconds || Number.isNaN(seconds) || seconds < 0) return '00:00'
  const total = Math.floor(seconds)
  const hrs = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60

  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
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

function getEpisodeWindows(episodes: Episode[]) {
  if (!episodes.length) return [] as Array<{ key: string; label: string; min: number; max: number }>

  const sorted = [...episodes].sort((a, b) => a.episode_number - b.episode_number)
  const first = sorted[0].episode_number
  const last = sorted[sorted.length - 1].episode_number
  const windows: Array<{ key: string; label: string; min: number; max: number }> = []

  for (let start = first; start <= last; start += EPISODES_PER_WINDOW) {
    const end = Math.min(start + EPISODES_PER_WINDOW - 1, last)
    windows.push({
      key: `${start}-${end}`,
      label: `${start}-${end}`,
      min: start,
      max: end,
    })
  }

  return windows
}

function getInitials(title?: string | null) {
  const value = title?.trim() || 'MP'
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join('')
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

const ToastViewport = memo(function ToastViewport({
  items,
}: {
  items: ToastItem[]
}) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-[min(92vw,360px)] flex-col gap-3">
      {items.map((item) => {
        const tone =
          item.type === 'success'
            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100'
            : item.type === 'error'
              ? 'border-red-500/20 bg-red-500/10 text-red-100'
              : 'border-white/15 bg-zinc-900/90 text-zinc-100'

        return (
          <div
            key={item.id}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium shadow-2xl backdrop-blur-xl ${tone}`}
          >
            {item.message}
          </div>
        )
      })}
    </div>
  )
})

const ShortcutModal = memo(function ShortcutModal({ onClose }: { onClose: () => void }) {
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#121214] p-6 shadow-2xl">
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
              <span className="rounded bg-white/10 px-2 py-1 text-xs font-bold text-white">
                {key}
              </span>
              <span className="text-sm font-medium text-zinc-400">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

const TabButton = memo(function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
        active
          ? 'bg-white text-black shadow-lg'
          : 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
      }`}
    >
      {label}
    </button>
  )
})

const EpisodeExplorer = memo(function EpisodeExplorer({
  episodes,
  currentEpisodeId,
  onSelect,
  progressMap,
  episodeSearch,
  onSearchChange,
  episodeLayout,
  onChangeLayout,
  episodeSort,
  onChangeSort,
  selectedWindow,
  onSelectWindow,
  windows,
}: {
  episodes: Episode[]
  currentEpisodeId?: string
  onSelect: (episode: Episode) => void
  progressMap: Record<string, number>
  episodeSearch: string
  onSearchChange: (value: string) => void
  episodeLayout: EpisodeLayout
  onChangeLayout: (layout: EpisodeLayout) => void
  episodeSort: EpisodeSort
  onChangeSort: (sort: EpisodeSort) => void
  selectedWindow: string
  onSelectWindow: (value: string) => void
  windows: Array<{ key: string; label: string; min: number; max: number }>
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/5 bg-[#0d0d0f] p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white">Danh sách tập</h3>
            <p className="mt-1 text-xs text-zinc-500">Tìm nhanh, đổi layout và lọc theo dải tập</p>
          </div>
          <span className="rounded-lg border border-white/5 bg-white/5 px-2.5 py-1 text-xs font-semibold text-zinc-400">
            {episodes.length} tập
          </span>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Tìm tập hoặc tên tập..."
              value={episodeSearch}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-11 w-full rounded-2xl border border-white/10 bg-black/50 pl-10 pr-4 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-red-500/50 focus:bg-black"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onChangeSort(episodeSort === 'asc' ? 'desc' : 'asc')}
              className="rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              {episodeSort === 'asc' ? 'Tập tăng dần' : 'Tập giảm dần'}
            </button>

            <button
              type="button"
              onClick={() => onChangeLayout(episodeLayout === 'grid' ? 'list' : 'grid')}
              className="rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              {episodeLayout === 'grid' ? 'Layout lưới' : 'Layout danh sách'}
            </button>
          </div>

          {windows.length > 1 && (
            <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => onSelectWindow('all')}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  selectedWindow === 'all'
                    ? 'bg-red-500/15 text-red-400 ring-1 ring-red-500/40'
                    : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                Tất cả
              </button>

              {windows.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onSelectWindow(item.key)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    selectedWindow === item.key
                      ? 'bg-red-500/15 text-red-400 ring-1 ring-red-500/40'
                      : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 flex-1 overflow-y-auto p-4 sm:p-5">
        {episodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-10 text-center">
            <span className="mb-4 block text-4xl opacity-20">🎞️</span>
            <p className="text-sm font-medium text-zinc-500">Không tìm thấy tập phù hợp</p>
          </div>
        ) : episodeLayout === 'grid' ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5">
            {episodes.map((ep) => {
              const isPlaying = currentEpisodeId === ep.id
              const progress = progressMap[ep.id] || 0

              return (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => onSelect(ep)}
                  title={ep.title || `Tập ${ep.episode_number}`}
                  className={`group relative overflow-hidden rounded-2xl px-3 py-3 text-left transition-all ${
                    isPlaying
                      ? 'scale-[1.02] bg-red-600 text-white shadow-[0_10px_30px_-12px_rgba(220,38,38,0.9)] ring-1 ring-red-400'
                      : 'border border-white/10 bg-white/[0.03] text-zinc-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-[0.18em] ${isPlaying ? 'text-red-100' : 'text-zinc-500'}`}>
                      Tập
                    </span>
                    <span className={`text-lg font-black ${isPlaying ? 'text-white' : 'text-zinc-100'}`}>
                      {ep.episode_number}
                    </span>
                  </div>

                  <div className="mt-2 min-h-[32px] text-[11px] font-medium leading-4 text-zinc-300">
                    {ep.title?.trim() && ep.title.trim() !== `Tập ${ep.episode_number}`
                      ? ep.title.trim()
                      : 'Đang phát nội dung'}
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
        ) : (
          <div className="space-y-2">
            {episodes.map((ep) => {
              const isPlaying = currentEpisodeId === ep.id
              const progress = progressMap[ep.id] || 0

              return (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => onSelect(ep)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                    isPlaying
                      ? 'border-red-500/40 bg-red-500/10 text-white ring-1 ring-red-500/30'
                      : 'border-white/10 bg-white/[0.03] text-zinc-200 hover:border-white/20 hover:bg-white/[0.07]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${isPlaying ? 'bg-red-500/20 text-red-100' : 'bg-white/5 text-zinc-500'}`}>
                          Tập {ep.episode_number}
                        </span>
                        {progress > 0 && (
                          <span className="text-[11px] font-semibold text-zinc-400">
                            {progress}%
                          </span>
                        )}
                      </div>
                      <p className="mt-2 truncate text-sm font-semibold text-current">
                        {ep.title?.trim() || `Tập ${ep.episode_number}`}
                      </p>
                    </div>
                    {isPlaying && (
                      <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-bold text-red-300">
                        Đang phát
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
})

const DetailsPanel = memo(function DetailsPanel({
  movie,
  totalEpisodes,
  onCopy,
  onToggleFavorite,
  onReport,
  copied,
  isFavorite,
  reported,
  showDescription,
  onToggleDescription,
}: {
  movie: Movie
  totalEpisodes: number
  onCopy: () => void
  onToggleFavorite: () => void
  onReport: () => void
  copied: boolean
  isFavorite: boolean
  reported: boolean
  showDescription: boolean
  onToggleDescription: () => void
}) {
  return (
    <div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 h-full overflow-y-auto">
      <div className="p-4 sm:p-5">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.02]">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:p-6">
            <div className="relative mx-auto aspect-[3/4] w-[150px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/40 sm:mx-0">
              {movie.cover_url ? (
                <img
                  src={movie.cover_url}
                  alt={movie.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-black text-zinc-400">
                  {getInitials(movie.title)}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                  {movie.status || 'Đang cập nhật'}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300">
                  {movie.release_year || 'N/A'}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300">
                  {movie.country || 'N/A'}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300">
                  {totalEpisodes} tập
                </span>
              </div>

              <h2 className="mt-4 text-2xl font-black text-white">{movie.title}</h2>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[11px] uppercase tracking-widest text-zinc-500">Đánh giá</p>
                  <p className="mt-1 text-lg font-black text-yellow-400">{movie.rating || 'N/A'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[11px] uppercase tracking-widest text-zinc-500">Lượt xem</p>
                  <p className="mt-1 text-lg font-black text-white">{formatViews(movie.views)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[11px] uppercase tracking-widest text-zinc-500">Đạo diễn</p>
                  <p className="mt-1 truncate text-sm font-semibold text-zinc-200">{movie.director || 'Đang cập nhật'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[11px] uppercase tracking-widest text-zinc-500">Diễn viên</p>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-zinc-200">
                    {movie.main_cast || 'Đang cập nhật'}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onToggleFavorite}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                    isFavorite
                      ? 'bg-pink-500/15 text-pink-300 ring-1 ring-pink-500/30'
                      : 'bg-white/5 text-zinc-200 hover:bg-white/10'
                  }`}
                >
                  {isFavorite ? 'Đã lưu yêu thích' : 'Thêm vào yêu thích'}
                </button>

                <button
                  type="button"
                  onClick={onCopy}
                  className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
                >
                  {copied ? 'Đã sao chép link' : 'Chia sẻ phim'}
                </button>

                <button
                  type="button"
                  onClick={onReport}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    reported
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : 'bg-white/5 text-zinc-200 hover:bg-red-500/10 hover:text-red-300'
                  }`}
                >
                  {reported ? 'Đã ghi nhận lỗi' : 'Báo lỗi nguồn phát'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-white/10 bg-[#101012] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-white">Nội dung phim</h3>
            {(movie.description?.length || 0) > 280 && (
              <button
                type="button"
                onClick={onToggleDescription}
                className="text-xs font-bold text-red-400 transition hover:text-red-300"
              >
                {showDescription ? 'Thu gọn' : 'Đọc thêm'}
              </button>
            )}
          </div>

          <p className={`mt-4 text-sm leading-7 text-zinc-400 ${showDescription ? '' : 'line-clamp-5'}`}>
            {movie.description || 'Chưa có thông tin mô tả nội dung.'}
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Thể loại</p>
              <p className="mt-2 text-sm font-medium text-zinc-200">{movie.genres || 'Đang cập nhật'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Nguồn dữ liệu</p>
              <p className="mt-2 text-sm font-medium text-zinc-200">Supabase + local storage người dùng</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

const SettingsPanel = memo(function SettingsPanel({
  isAutoNext,
  onToggleAutoNext,
  playbackRate,
  onCyclePlaybackRate,
  volume,
  muted,
  onVolumeChange,
  onToggleTheater,
  onToggleLightsOut,
  isTheaterMode,
  isLightsOut,
  canUseNativeVideo,
}: {
  isAutoNext: boolean
  onToggleAutoNext: () => void
  playbackRate: number
  onCyclePlaybackRate: () => void
  volume: number
  muted: boolean
  onVolumeChange: (value: number) => void
  onToggleTheater: () => void
  onToggleLightsOut: () => void
  isTheaterMode: boolean
  isLightsOut: boolean
  canUseNativeVideo: boolean
}) {
  return (
    <div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 h-full overflow-y-auto p-4 sm:p-5">
      <div className="space-y-4">
        <div className="rounded-3xl border border-white/10 bg-[#101012] p-5">
          <h3 className="text-lg font-bold text-white">Tùy chỉnh xem phim</h3>
          <p className="mt-1 text-sm text-zinc-500">Những thiết lập này lưu trên trình duyệt của người xem.</p>

          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={onToggleAutoNext}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                isAutoNext
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                  : 'border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.05]'
              }`}
            >
              <div>
                <p className="font-semibold">Tự chuyển tập</p>
                <p className="mt-1 text-xs text-zinc-400">Tự chạy sang tập kế sau khi xem xong</p>
              </div>
              <span className="text-xs font-bold">{isAutoNext ? 'BẬT' : 'TẮT'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleTheater}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                isTheaterMode
                  ? 'border-white/20 bg-white/10 text-white'
                  : 'border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.05]'
              }`}
            >
              <div>
                <p className="font-semibold">Chế độ rạp phim</p>
                <p className="mt-1 text-xs text-zinc-400">Mở rộng player và tối ưu tập trung nội dung</p>
              </div>
              <span className="text-xs font-bold">{isTheaterMode ? 'ĐANG BẬT' : 'ĐANG TẮT'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleLightsOut}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                isLightsOut
                  ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-100'
                  : 'border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.05]'
              }`}
            >
              <div>
                <p className="font-semibold">Tắt đèn</p>
                <p className="mt-1 text-xs text-zinc-400">Làm mờ giao diện xung quanh player để đỡ rối mắt</p>
              </div>
              <span className="text-xs font-bold">{isLightsOut ? 'ĐANG BẬT' : 'ĐANG TẮT'}</span>
            </button>
          </div>
        </div>

        {canUseNativeVideo && (
          <div className="rounded-3xl border border-white/10 bg-[#101012] p-5">
            <h3 className="text-lg font-bold text-white">Điều khiển phát</h3>
            <div className="mt-5 space-y-4">
              <button
                type="button"
                onClick={onCyclePlaybackRate}
                className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-zinc-200 transition hover:bg-white/[0.05]"
              >
                <div>
                  <p className="font-semibold">Tốc độ phát</p>
                  <p className="mt-1 text-xs text-zinc-400">Đổi nhanh giữa các mức tốc độ phổ biến</p>
                </div>
                <span className="text-sm font-black text-white">{playbackRate}x</span>
              </button>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-zinc-200">Âm lượng</p>
                    <p className="mt-1 text-xs text-zinc-400">Kéo để tăng giảm âm thanh</p>
                  </div>
                  <span className="text-sm font-black text-white">{muted ? 0 : Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => onVolumeChange(Number(e.target.value))}
                  className="w-full cursor-pointer accent-red-500"
                />
              </div>
            </div>
          </div>
        )}

        {!canUseNativeVideo && (
          <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-100">
            Nguồn phát hiện tại là iframe hoặc Telegram nên một số điều khiển nâng cao như tua, tốc độ phát, PiP sẽ phụ thuộc vào server nguồn.
          </div>
        )}
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
  const [selectedWindow, setSelectedWindow] = useState('all')
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

  const [activeTab, setActiveTab] = useState<PanelTab>('episodes')
  const [episodeLayout, setEpisodeLayout] = useState<EpisodeLayout>('grid')
  const [episodeSort, setEpisodeSort] = useState<EpisodeSort>('asc')

  const [isClientMounted, setIsClientMounted] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showMobilePanel, setShowMobilePanel] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [resumeNotice, setResumeNotice] = useState('')
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const playerContainerRef = useRef<HTMLDivElement | null>(null)
  const lastProgressSavedRef = useRef(0)
  const restoreDoneRef = useRef<string | null>(null)
  const toastIdRef = useRef(1)

  const pushToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = toastIdRef.current++
    setToasts((prev) => [...prev, { id, message, type }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, 2500)
  }, [])

  useEffect(() => {
    setIsClientMounted(true)
    setFavoriteIds(safeRead<string[]>(STORAGE_FAVORITES, []))
    setIsAutoNext(safeRead<boolean>(STORAGE_AUTO_NEXT, true))

    const prefs = safeRead<PlayerPrefs>(STORAGE_PLAYER_PREFS, {
      playbackRate: 1,
      volume: 1,
      muted: false,
    })

    const ui = safeRead<PlayerUiState>(STORAGE_PLAYER_UI, {
      activeTab: 'episodes',
      episodeLayout: 'grid',
      episodeSort: 'asc',
    })

    setPlaybackRate(prefs.playbackRate || 1)
    setVolume(typeof prefs.volume === 'number' ? prefs.volume : 1)
    setMuted(!!prefs.muted)
    setActiveTab(ui.activeTab || 'episodes')
    setEpisodeLayout(ui.episodeLayout || 'grid')
    setEpisodeSort(ui.episodeSort || 'asc')
  }, [])

  useEffect(() => {
    if (!isClientMounted) return
    safeWrite(STORAGE_PLAYER_PREFS, { playbackRate, volume, muted })
  }, [playbackRate, volume, muted, isClientMounted])

  useEffect(() => {
    if (!isClientMounted) return
    safeWrite(STORAGE_PLAYER_UI, { activeTab, episodeLayout, episodeSort })
  }, [activeTab, episodeLayout, episodeSort, isClientMounted])

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

  const sourceOptions = useMemo(() => getSourceOptions(currentEpisodeServers), [currentEpisodeServers])

  const activeSource = useMemo(() => {
    return sourceOptions.find((s) => s.id === activeServerId) || sourceOptions[0]
  }, [sourceOptions, activeServerId])

  const playableUrl = activeSource?.url || ''
  const sourceType = activeSource?.key || 'iframe'
  const isTelegramSource = sourceType === 'telegram'
  const canUseNativeVideo = sourceType === 'hls' || sourceType === 'mp4'

  useEffect(() => {
    if (!currentEpisode) return
    setPlayerError('')
    setAutoNextCountdown(null)
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

  const episodeWindows = useMemo(() => getEpisodeWindows(episodes), [episodes])

  const filteredEpisodes = useMemo(() => {
    const keyword = normalizeText(episodeSearch)
    const windowMatch = episodeWindows.find((item) => item.key === selectedWindow)

    const base = episodes.filter((ep) => {
      const matchesKeyword =
        !keyword ||
        normalizeText(ep.title).includes(keyword) ||
        String(ep.episode_number).includes(keyword)

      const matchesWindow =
        !windowMatch ||
        (ep.episode_number >= windowMatch.min && ep.episode_number <= windowMatch.max)

      return matchesKeyword && matchesWindow
    })

    return [...base].sort((a, b) =>
      episodeSort === 'asc' ? a.episode_number - b.episode_number : b.episode_number - a.episode_number
    )
  }, [episodes, episodeSearch, selectedWindow, episodeWindows, episodeSort])

  const currentIndex = useMemo(() => {
    if (!currentEpisode) return -1
    return episodes.findIndex((ep) => ep.id === currentEpisode.id)
  }, [episodes, currentEpisode])

  const prevEpisode = currentIndex > 0 ? episodes[currentIndex - 1] : null
  const nextEpisode =
    currentIndex >= 0 && currentIndex < episodes.length - 1 ? episodes[currentIndex + 1] : null

  const episodeProgressMap = useMemo(() => {
    return movie?.id ? getEpisodeProgressMap(movie.id) : {}
  }, [movie?.id, currentEpisode?.id])

  const isFavorite = movie ? favoriteIds.includes(movie.id) : false

  const handleChangeEpisode = useCallback(
    (episode: Episode) => {
      setCurrentEpisode(episode)
      restoreDoneRef.current = null
      setPlayerError('')
      setResumeNotice('')
      setAutoNextCountdown(null)

      const nextOptions = getSourceOptions(episodeServersMap[episode.id] || [])
      setActiveServerId(nextOptions[0]?.id || '')
      setShowMobilePanel(false)

      if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    },
    [episodeServersMap]
  )

  const toggleAutoNext = useCallback(() => {
    setIsAutoNext((prev) => {
      const next = !prev
      safeWrite(STORAGE_AUTO_NEXT, next)
      pushToast(next ? 'Đã bật tự chuyển tập' : 'Đã tắt tự chuyển tập', 'info')
      return next
    })
  }, [pushToast])

  const toggleFavorite = useCallback(
    (id: string) => {
      setFavoriteIds((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]
        safeWrite(STORAGE_FAVORITES, next)
        pushToast(prev.includes(id) ? 'Đã bỏ khỏi yêu thích' : 'Đã thêm vào yêu thích', 'success')
        return next
      })
    },
    [pushToast]
  )

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
    pushToast(`Đã chuyển tốc độ phát sang ${newRate}x`, 'info')
  }, [playbackRate, pushToast])

  const handleReport = useCallback(() => {
    setReported(true)
    pushToast('Đã ghi nhận báo lỗi ở trình duyệt này', 'success')
    setTimeout(() => setReported(false), 2500)
  }, [pushToast])

  const handleShare = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: movie?.title || 'Xem phim',
          text: movie?.title || 'Xem phim',
          url: window.location.href,
        })
        pushToast('Đã mở chia sẻ hệ thống', 'success')
        return
      }

      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      pushToast('Đã sao chép link phim', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      pushToast('Không thể chia sẻ ở thiết bị này', 'error')
    }
  }, [movie?.title, pushToast])

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
      setResumeNotice(`Tiếp tục từ ${formatTime(last.currentTime)}`)
      pushToast(`Đã khôi phục tới ${formatTime(last.currentTime)}`, 'info')
    } else {
      setResumeNotice('')
    }

    persistWatchState(currentEpisode, undefined, video.currentTime, video.duration)
    restoreDoneRef.current = currentEpisode.id
  }, [currentEpisode, persistWatchState, playbackRate, volume, muted, pushToast])

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
      setAutoNextCountdown(AUTO_NEXT_COUNTDOWN)
      pushToast(`Sẽ tự chuyển sang tập ${nextEpisode.episode_number}`, 'info')
    }
  }, [currentEpisode, persistWatchState, isAutoNext, nextEpisode, pushToast])

  useEffect(() => {
    if (autoNextCountdown === null) return
    if (autoNextCountdown <= 0) {
      if (nextEpisode) handleChangeEpisode(nextEpisode)
      return
    }

    const timer = window.setTimeout(() => {
      setAutoNextCountdown((prev) => (prev === null ? null : prev - 1))
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [autoNextCountdown, nextEpisode, handleChangeEpisode])

  const handleTogglePiP = useCallback(async () => {
    try {
      if (videoRef.current && document.pictureInPictureEnabled) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture()
        } else {
          await videoRef.current.requestPictureInPicture()
        }
      }
    } catch {
      pushToast('Thiết bị hoặc trình duyệt không hỗ trợ PiP', 'error')
    }
  }, [pushToast])

  const handleToggleFullscreen = useCallback(async () => {
    try {
      const el = playerContainerRef.current
      if (!el) return

      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await el.requestFullscreen()
      }
    } catch {
      pushToast('Không thể bật toàn màn hình ở thiết bị này', 'error')
    }
  }, [pushToast])

  const tryNextSource = useCallback(() => {
    if (!currentEpisode || sourceOptions.length <= 1) {
      setPlayerError('Không có nguồn phát khả dụng vào lúc này.')
      pushToast('Không còn server dự phòng khả dụng', 'error')
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
      pushToast(`Đã chuyển sang ${next.label}`, 'info')
    } else {
      setPlayerError('Không có nguồn phát khả dụng vào lúc này.')
      pushToast('Không thể tự đổi server', 'error')
    }
  }, [currentEpisode, sourceOptions, activeServerId, pushToast])

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

      if (e.key === 'Escape') {
        if (showMobilePanel) setShowMobilePanel(false)
        if (isLightsOut) setIsLightsOut(false)
      }
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
    showMobilePanel,
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
    <main className="relative min-h-screen bg-[#09090b] pb-24 font-sans text-zinc-200 selection:bg-red-500/30 lg:pb-10">
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.12),transparent_45%),radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.03),transparent_35%),linear-gradient(to_bottom,#050507,#09090b)]" />

      {movie.cover_url && (
        <div
          className="pointer-events-none fixed inset-0 -z-30 opacity-15 blur-[100px]"
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

      {!!toasts.length && <ToastViewport items={toasts} />}
      {showShortcuts && <ShortcutModal onClose={() => setShowShortcuts(false)} />}

      {showMobilePanel && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm lg:hidden">
          <div className="absolute inset-x-0 bottom-0 h-[82vh] rounded-t-[28px] border border-white/10 bg-[#0d0d0f] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-4">
              <div>
                <p className="text-sm font-bold text-white">Bảng điều khiển phim</p>
                <p className="mt-1 text-xs text-zinc-500">Chọn tập, xem thông tin và chỉnh cài đặt</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMobilePanel(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="border-b border-white/5 px-4 py-3">
              <div className="flex gap-2 overflow-x-auto">
                <TabButton active={activeTab === 'episodes'} label="Tập phim" onClick={() => setActiveTab('episodes')} />
                <TabButton active={activeTab === 'details'} label="Thông tin" onClick={() => setActiveTab('details')} />
                <TabButton active={activeTab === 'settings'} label="Cài đặt" onClick={() => setActiveTab('settings')} />
              </div>
            </div>

            <div className="h-[calc(82vh-120px)]">
              {activeTab === 'episodes' ? (
                <EpisodeExplorer
                  episodes={filteredEpisodes}
                  currentEpisodeId={currentEpisode?.id}
                  onSelect={handleChangeEpisode}
                  progressMap={episodeProgressMap}
                  episodeSearch={episodeSearch}
                  onSearchChange={setEpisodeSearch}
                  episodeLayout={episodeLayout}
                  onChangeLayout={setEpisodeLayout}
                  episodeSort={episodeSort}
                  onChangeSort={setEpisodeSort}
                  selectedWindow={selectedWindow}
                  onSelectWindow={setSelectedWindow}
                  windows={episodeWindows}
                />
              ) : activeTab === 'details' ? (
                <DetailsPanel
                  movie={movie}
                  totalEpisodes={episodes.length}
                  onCopy={handleShare}
                  onToggleFavorite={() => toggleFavorite(movie.id)}
                  onReport={handleReport}
                  copied={copied}
                  isFavorite={isFavorite}
                  reported={reported}
                  showDescription={showDescription}
                  onToggleDescription={() => setShowDescription((v) => !v)}
                />
              ) : (
                <SettingsPanel
                  isAutoNext={isAutoNext}
                  onToggleAutoNext={toggleAutoNext}
                  playbackRate={playbackRate}
                  onCyclePlaybackRate={cyclePlaybackRate}
                  volume={volume}
                  muted={muted}
                  onVolumeChange={(value) => {
                    setVolume(value)
                    setMuted(value === 0)
                    if (videoRef.current) {
                      videoRef.current.volume = value
                      videoRef.current.muted = value === 0
                    }
                  }}
                  onToggleTheater={() => setIsTheaterMode((v) => !v)}
                  onToggleLightsOut={() => setIsLightsOut((v) => !v)}
                  isTheaterMode={isTheaterMode}
                  isLightsOut={isLightsOut}
                  canUseNativeVideo={canUseNativeVideo}
                />
              )}
            </div>
          </div>
        </div>
      )}

      <header
        className={`sticky top-0 z-30 border-b border-white/5 bg-zinc-950/75 backdrop-blur-xl transition-all duration-300 ${
          isLightsOut ? 'pointer-events-none -translate-y-full opacity-0' : 'translate-y-0 opacity-100'
        }`}
      >
        <div className="mx-auto flex w-full max-w-[1880px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/phim"
              className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform group-hover:-translate-x-0.5"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                <span>Trình phát nâng cấp</span>
                <span className="h-1 w-1 rounded-full bg-zinc-700" />
                <span>{movie.status || 'Đang cập nhật'}</span>
                <span className="h-1 w-1 rounded-full bg-zinc-700" />
                <span>{episodes.length} tập</span>
              </div>

              <h1 className="mt-1 truncate text-lg font-black text-white sm:text-2xl">{movie.title}</h1>

              {currentEpisode && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-400 sm:text-sm">
                  <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-red-300">
                    Đang phát tập {currentEpisode.episode_number}
                  </span>
                  {currentEpisode.title && (
                    <span className="truncate rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-300">
                      {currentEpisode.title}
                    </span>
                  )}
                  {resumeNotice && (
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-300">
                      {resumeNotice}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="hidden items-center gap-3 lg:flex">
              <button
                type="button"
                onClick={() => setShowShortcuts(true)}
                className="flex h-11 items-center gap-2 rounded-2xl bg-white/5 px-4 text-sm font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                Phím tắt
              </button>

              <button
                type="button"
                onClick={() => toggleFavorite(movie.id)}
                className={`flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-bold transition ${
                  isFavorite
                    ? 'bg-pink-500/10 text-pink-300 ring-1 ring-pink-500/30'
                    : 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
                {isFavorite ? 'Đã lưu' : 'Yêu thích'}
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="flex h-11 items-center gap-2 rounded-2xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-500"
              >
                Chia sẻ
              </button>
            </div>
          </div>

          <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1 lg:hidden">
            <TabButton active={activeTab === 'episodes'} label="Tập phim" onClick={() => setActiveTab('episodes')} />
            <TabButton active={activeTab === 'details'} label="Thông tin" onClick={() => setActiveTab('details')} />
            <TabButton active={activeTab === 'settings'} label="Cài đặt" onClick={() => setActiveTab('settings')} />
          </div>
        </div>
      </header>

      <div className={`mx-auto w-full px-4 py-6 transition-all duration-500 sm:px-6 lg:px-8 ${isTheaterMode ? 'max-w-[2000px]' : 'max-w-[1880px]'}`}>
        <div className={`flex flex-col gap-6 lg:gap-8 ${isTheaterMode ? '' : 'lg:flex-row'}`}>
          <div className={`flex flex-col transition-all duration-500 ${isLightsOut ? 'z-50' : 'z-10'} ${isTheaterMode ? 'w-full' : 'w-full shrink-0 lg:w-[68%] xl:w-[70%]'}`}>
            <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0d0d0f] shadow-[0_30px_80px_-35px_rgba(0,0,0,0.85)] ring-1 ring-white/5">
              <div
                ref={playerContainerRef}
                onDoubleClick={() => {
                  if (canUseNativeVideo) void handleToggleFullscreen()
                }}
                className={`relative w-full bg-black transition-all duration-500 ${
                  isTelegramSource
                    ? 'h-[40vh] min-h-[350px] sm:h-[50vh] lg:h-[68vh]'
                    : isTheaterMode
                      ? 'aspect-video max-h-[86vh]'
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

                <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/80 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/85 to-transparent" />

                <div className="absolute left-4 top-4 z-20 flex flex-wrap items-center gap-2">
                  {currentEpisode && (
                    <span className="rounded-xl border border-white/10 bg-black/55 px-3 py-2 text-xs font-bold text-white backdrop-blur-md">
                      Tập {currentEpisode.episode_number}
                    </span>
                  )}
                  {activeSource && (
                    <span className="rounded-xl border border-red-500/30 bg-red-600/80 px-3 py-2 text-xs font-bold uppercase text-white backdrop-blur-md">
                      {activeSource.label}
                    </span>
                  )}
                  {!!resumeNotice && (
                    <span className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200 backdrop-blur-md">
                      {resumeNotice}
                    </span>
                  )}
                </div>

                <div className="absolute right-4 top-4 z-20 hidden items-center gap-2 sm:flex">
                  <button
                    type="button"
                    onClick={() => setShowShortcuts(true)}
                    className="rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs font-semibold text-zinc-100 backdrop-blur-md transition hover:bg-black/70"
                  >
                    ? Trợ giúp
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLightsOut((v) => !v)}
                    className="rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs font-semibold text-zinc-100 backdrop-blur-md transition hover:bg-black/70"
                  >
                    {isLightsOut ? 'Bật đèn' : 'Tắt đèn'}
                  </button>
                </div>

                {playerError && (
                  <div className="absolute left-1/2 top-6 z-20 -translate-x-1/2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-5 py-3 text-sm font-medium text-amber-200 backdrop-blur-md">
                    {playerError}
                  </div>
                )}

                {autoNextCountdown !== null && nextEpisode && (
                  <div className="absolute inset-x-0 bottom-5 z-20 flex justify-center px-4">
                    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black/75 p-4 shadow-2xl backdrop-blur-xl">
                      <p className="text-sm font-semibold text-zinc-300">Tập hiện tại đã phát xong</p>
                      <p className="mt-1 text-lg font-black text-white">
                        Tự chuyển sang tập {nextEpisode.episode_number} sau {autoNextCountdown}s
                      </p>
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAutoNextCountdown(null)}
                          className="flex-1 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/15"
                        >
                          Ở lại
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangeEpisode(nextEpisode)}
                          className="flex-1 rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-500"
                        >
                          Xem ngay
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-white/5 bg-[#111114] p-4 sm:px-6 sm:py-5">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={!prevEpisode}
                        onClick={() => prevEpisode && handleChangeEpisode(prevEpisode)}
                        className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-white/5 px-4 text-sm font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="19 20 9 12 19 4 19 20" /><line x1="5" x2="5" y1="19" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                        Tập trước
                      </button>

                      <button
                        type="button"
                        disabled={!nextEpisode}
                        onClick={() => nextEpisode && handleChangeEpisode(nextEpisode)}
                        className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        Tập tiếp
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" x2="19" y1="5" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                      </button>

                      <button
                        type="button"
                        onClick={toggleAutoNext}
                        className={`flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition ${
                          isAutoNext
                            ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30'
                            : 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {isAutoNext ? 'Tự chuyển: Bật' : 'Tự chuyển: Tắt'}
                      </button>
                    </div>

                    <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto pb-1 xl:pb-0">
                      {canUseNativeVideo && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSkip(-SEEK_STEP)}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                            title="Tua lại 10 giây"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></svg>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSkip(SEEK_STEP)}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                            title="Tua tới 10 giây"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M12 7v5l-4 2" /></svg>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSkip(INTRO_SKIP_SECONDS)}
                            className="flex h-11 shrink-0 items-center justify-center rounded-2xl bg-white/5 px-4 text-sm font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white"
                          >
                            Bỏ qua intro
                          </button>

                          <button
                            type="button"
                            onClick={cyclePlaybackRate}
                            className="flex h-11 shrink-0 items-center justify-center rounded-2xl bg-white/5 px-4 text-sm font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white"
                          >
                            {playbackRate}x
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsTheaterMode((v) => !v)}
                        className={`flex h-11 shrink-0 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition ${
                          isTheaterMode
                            ? 'bg-white/15 text-white ring-1 ring-white/20'
                            : 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {isTheaterMode ? 'Thu nhỏ' : 'Rạp phim'}
                      </button>

                      {canUseNativeVideo && (
                        <>
                          <button
                            type="button"
                            onClick={handleTogglePiP}
                            className="flex h-11 shrink-0 items-center justify-center rounded-2xl bg-white/5 px-4 text-sm font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
                          >
                            PiP
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleToggleFullscreen()}
                            className="flex h-11 shrink-0 items-center justify-center rounded-2xl bg-white/5 px-4 text-sm font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
                          >
                            Full
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-white/5 pt-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
                      <span className="mr-1 hidden text-xs font-medium text-zinc-500 sm:block">Nguồn phát:</span>
                      {sourceOptions.filter((i) => i.available).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setPlayerError('')
                            setActiveServerId(item.id)
                            pushToast(`Đang chuyển qua ${item.label}`, 'info')
                          }}
                          className={`flex h-9 items-center justify-center rounded-xl px-3 text-xs font-bold transition-all ${
                            activeServerId === item.id
                              ? 'bg-red-500/10 text-red-400 ring-1 ring-red-500/50'
                              : 'bg-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                          }`}
                        >
                          {item.label}
                          {item.isPrimary ? ' • Chính' : ''}
                        </button>
                      ))}
                    </div>

                    {canUseNativeVideo && (
                      <div className="hidden h-11 items-center gap-3 rounded-2xl bg-white/5 px-4 sm:flex">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>
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
                          className="w-28 cursor-pointer accent-red-500"
                        />
                        <span className="w-10 text-right text-xs font-bold text-zinc-300">
                          {muted ? 0 : Math.round(volume * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {!isLightsOut && (
              <section className="mt-6 overflow-hidden rounded-[28px] border border-white/10 bg-[#101012]/85 backdrop-blur-sm shadow-[0_30px_70px_-35px_rgba(0,0,0,0.75)]">
                <div className="border-b border-white/5 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-black text-white sm:text-2xl">Thông tin nhanh</h2>
                      <p className="mt-1 text-sm text-zinc-500">
                        Giao diện mới gom thao tác chính, nguồn phát và thông tin phim gọn hơn
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMobilePanel(true)}
                      className="flex h-10 items-center justify-center rounded-2xl bg-white/5 px-4 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 lg:hidden"
                    >
                      Mở bảng điều khiển
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4 sm:p-5">
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Đánh giá</p>
                    <p className="mt-2 text-2xl font-black text-yellow-400">{movie.rating || 'N/A'}</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Lượt xem</p>
                    <p className="mt-2 text-2xl font-black text-white">{formatViews(movie.views)}</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Thể loại</p>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold text-zinc-200">
                      {movie.genres || 'Đang cập nhật'}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Mô tả</p>
                    <p className="mt-2 line-clamp-3 text-sm font-medium leading-6 text-zinc-400">
                      {movie.description || 'Chưa có thông tin mô tả nội dung.'}
                    </p>
                  </div>
                </div>
              </section>
            )}
          </div>

          <aside
            className={`hidden transition-all duration-500 lg:flex ${
              isLightsOut ? 'h-0 overflow-hidden opacity-0' : 'opacity-100'
            } ${isTheaterMode ? 'w-full' : 'w-full shrink-0 lg:w-[32%] xl:w-[30%]'}`}
          >
            <div className={`flex w-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0d0d0f] shadow-xl ${isTheaterMode ? 'max-h-[700px]' : 'max-h-[calc(100vh-7rem)] sticky top-24'}`}>
              <div className="border-b border-white/5 p-4 sm:p-5">
                <div className="flex gap-2 overflow-x-auto">
                  <TabButton active={activeTab === 'episodes'} label="Tập phim" onClick={() => setActiveTab('episodes')} />
                  <TabButton active={activeTab === 'details'} label="Thông tin" onClick={() => setActiveTab('details')} />
                  <TabButton active={activeTab === 'settings'} label="Cài đặt" onClick={() => setActiveTab('settings')} />
                </div>
              </div>

              <div className="min-h-0 flex-1">
                {activeTab === 'episodes' ? (
                  <EpisodeExplorer
                    episodes={filteredEpisodes}
                    currentEpisodeId={currentEpisode?.id}
                    onSelect={handleChangeEpisode}
                    progressMap={episodeProgressMap}
                    episodeSearch={episodeSearch}
                    onSearchChange={setEpisodeSearch}
                    episodeLayout={episodeLayout}
                    onChangeLayout={setEpisodeLayout}
                    episodeSort={episodeSort}
                    onChangeSort={setEpisodeSort}
                    selectedWindow={selectedWindow}
                    onSelectWindow={setSelectedWindow}
                    windows={episodeWindows}
                  />
                ) : activeTab === 'details' ? (
                  <DetailsPanel
                    movie={movie}
                    totalEpisodes={episodes.length}
                    onCopy={handleShare}
                    onToggleFavorite={() => toggleFavorite(movie.id)}
                    onReport={handleReport}
                    copied={copied}
                    isFavorite={isFavorite}
                    reported={reported}
                    showDescription={showDescription}
                    onToggleDescription={() => setShowDescription((v) => !v)}
                  />
                ) : (
                  <SettingsPanel
                    isAutoNext={isAutoNext}
                    onToggleAutoNext={toggleAutoNext}
                    playbackRate={playbackRate}
                    onCyclePlaybackRate={cyclePlaybackRate}
                    volume={volume}
                    muted={muted}
                    onVolumeChange={(value) => {
                      setVolume(value)
                      setMuted(value === 0)
                      if (videoRef.current) {
                        videoRef.current.volume = value
                        videoRef.current.muted = value === 0
                      }
                    }}
                    onToggleTheater={() => setIsTheaterMode((v) => !v)}
                    onToggleLightsOut={() => setIsLightsOut((v) => !v)}
                    isTheaterMode={isTheaterMode}
                    isLightsOut={isLightsOut}
                    canUseNativeVideo={canUseNativeVideo}
                  />
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {!isLightsOut && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/92 px-4 py-3 backdrop-blur-lg lg:hidden">
          <div className="mx-auto grid max-w-lg grid-cols-4 gap-2">
            <button
              type="button"
              disabled={!prevEpisode}
              onClick={() => prevEpisode && handleChangeEpisode(prevEpisode)}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/5 text-sm font-semibold text-zinc-300 transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-30"
            >
              Trước
            </button>

            <button
              type="button"
              onClick={() => setShowMobilePanel(true)}
              className="flex h-12 items-center justify-center rounded-2xl bg-red-600 text-sm font-bold text-white transition hover:bg-red-500"
            >
              Tập
            </button>

            <button
              type="button"
              onClick={() => setIsLightsOut((v) => !v)}
              className="flex h-12 items-center justify-center rounded-2xl bg-white/5 text-sm font-semibold text-zinc-300 transition hover:bg-white/10"
            >
              {isLightsOut ? 'Đèn' : 'Tối'}
            </button>

            <button
              type="button"
              disabled={!nextEpisode}
              onClick={() => nextEpisode && handleChangeEpisode(nextEpisode)}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/5 text-sm font-semibold text-zinc-300 transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-30"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
