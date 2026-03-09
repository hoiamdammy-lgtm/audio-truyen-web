'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&q=80&w=1200&h=1600'

const STORAGE_FAVORITES = 'movie-favorites-v1'
const STORAGE_PROGRESS = 'movie-progress-v1'
const STORAGE_DENSITY = 'movie-density-v1'
const STORAGE_PLAYER_STATE = 'movie-player-state-v2'

type Movie = {
  id: string
  title: string
  cover_url?: string | null
  status?: string | null
  views?: number | null
  description?: string | null
  country?: string | null
  release_year?: number | null
  rating?: number | null
  created_at?: string | null
  episodes?: { count: number }[]
}

type ProgressItem = {
  movieId: string
  title?: string
  cover_url?: string | null
  currentEpisode?: number
  totalEpisodes?: number
  percent?: number
  updatedAt?: string
}

type PlayerStateItem = {
  movieId: string
  episodeId?: string
  episodeNumber?: number
  updatedAt?: string
}

type ContinueWatchingItem = {
  movieId: string
  title?: string
  cover_url?: string | null
  currentEpisode?: number
  totalEpisodes?: number
  percent?: number
  updatedAt?: string
}

type StatusFilter = 'all' | 'ongoing' | 'completed' | 'favorites'
type SortBy = 'newest' | 'popular' | 'az'
type Density = 'comfortable' | 'compact'

function normalizeText(str: string) {
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

function getEpisodeCount(movie: Movie) {
  return movie.episodes?.[0]?.count || 0
}

function formatViews(value?: number | null) {
  return new Intl.NumberFormat('vi-VN').format(value || 0)
}

function isNewMovie(createdAt?: string | null) {
  if (!createdAt) return false
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return false
  return Date.now() - created <= 1000 * 60 * 60 * 24 * 14
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

function normalizePlayerStateData(
  raw: Record<string, PlayerStateItem> | PlayerStateItem[] | unknown
): Record<string, PlayerStateItem> {
  if (!raw) return {}

  if (Array.isArray(raw)) {
    return raw.reduce<Record<string, PlayerStateItem>>((acc, item) => {
      if (item?.movieId) acc[item.movieId] = item
      return acc
    }, {})
  }

  if (typeof raw === 'object') {
    return raw as Record<string, PlayerStateItem>
  }

  return {}
}

function PosterImage({
  src,
  alt,
  priority = false,
  className = '',
}: {
  src?: string | null
  alt: string
  priority?: boolean
  className?: string
}) {
  return (
    <img
      src={src || FALLBACK_COVER}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={className}
      onError={(e) => {
        const target = e.currentTarget
        if (target.src !== FALLBACK_COVER) {
          target.src = FALLBACK_COVER
        }
      }}
    />
  )
}

function SectionTitle({
  eyebrow,
  title,
  extra,
}: {
  eyebrow: string
  title: string
  extra?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3 sm:mb-5">
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-500">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">
          {title}
        </h2>
      </div>
      {extra}
    </div>
  )
}

function ToolbarChip({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold transition sm:text-sm ${
        active
          ? 'border-red-500/30 bg-red-500/15 text-red-300'
          : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]'
      }`}
    >
      {children}
    </button>
  )
}

function QuickFilterRow({
  statusFilter,
  setStatusFilter,
  sortBy,
  setSortBy,
  counts,
}: {
  statusFilter: StatusFilter
  setStatusFilter: (value: StatusFilter) => void
  sortBy: SortBy
  setSortBy: (value: SortBy) => void
  counts: {
    all: number
    ongoing: number
    completed: number
    favorites: number
  }
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <ToolbarChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
        Tất cả ({counts.all})
      </ToolbarChip>
      <ToolbarChip
        active={statusFilter === 'ongoing'}
        onClick={() => setStatusFilter('ongoing')}
      >
        Đang cập nhật ({counts.ongoing})
      </ToolbarChip>
      <ToolbarChip
        active={statusFilter === 'completed'}
        onClick={() => setStatusFilter('completed')}
      >
        Hoàn thành ({counts.completed})
      </ToolbarChip>
      <ToolbarChip
        active={statusFilter === 'favorites'}
        onClick={() => setStatusFilter('favorites')}
      >
        Yêu thích ({counts.favorites})
      </ToolbarChip>
      <ToolbarChip active={sortBy === 'popular'} onClick={() => setSortBy('popular')}>
        Xem nhiều
      </ToolbarChip>
      <ToolbarChip active={sortBy === 'newest'} onClick={() => setSortBy('newest')}>
        Mới nhất
      </ToolbarChip>
      <ToolbarChip active={sortBy === 'az'} onClick={() => setSortBy('az')}>
        A → Z
      </ToolbarChip>
    </div>
  )
}

function MovieCard({
  movie,
  isFavorite,
  onToggleFavorite,
  progress,
  priority = false,
  density = 'comfortable',
}: {
  movie: Movie
  isFavorite: boolean
  onToggleFavorite: (movieId: string) => void
  progress?: ContinueWatchingItem
  priority?: boolean
  density?: Density
}) {
  const episodeCount = getEpisodeCount(movie)
  const compact = density === 'compact'
  const hasPercent = typeof progress?.percent === 'number' && (progress.percent || 0) > 0
  const hasEpisodeProgress = typeof progress?.currentEpisode === 'number'

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onToggleFavorite(movie.id)
        }}
        className={`absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition ${
          isFavorite
            ? 'border-red-500/30 bg-red-500/20 text-red-300'
            : 'border-white/10 bg-black/45 text-zinc-200 hover:bg-black/65'
        }`}
        aria-label={isFavorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
      >
        {isFavorite ? '♥' : '♡'}
      </button>

      <Link
        href={`/phim/${movie.id}`}
        prefetch={false}
        className="block"
        aria-label={`Xem phim ${movie.title}`}
      >
        <article className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] transition duration-300 hover:-translate-y-1 hover:border-red-500/20 hover:bg-white/[0.05] hover:shadow-[0_18px_40px_rgba(239,68,68,0.12)]">
          <div className="relative aspect-[2/3] overflow-hidden bg-zinc-900">
            <PosterImage
              src={movie.cover_url}
              alt={movie.title}
              priority={priority}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />

            <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2 pr-12">
              {isNewMovie(movie.created_at) && (
                <span className="rounded-md bg-amber-400 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-zinc-950">
                  New
                </span>
              )}

              {(movie.views || 0) >= 1000 && (
                <span className="rounded-md bg-fuchsia-500 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                  Hot
                </span>
              )}

              <span
                className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wide ${
                  movie.status === 'Hoàn thành'
                    ? 'bg-emerald-400 text-zinc-950'
                    : 'bg-red-500 text-white'
                }`}
              >
                {movie.status === 'Hoàn thành' ? 'Full' : 'Mới'}
              </span>
            </div>

            {(hasPercent || hasEpisodeProgress) && (
              <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-3">
                <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-zinc-200">
                  <span>
                    {hasPercent
                      ? `Đã xem ${Math.round(progress?.percent || 0)}%`
                      : 'Đang xem dở'}
                  </span>
                  <span>
                    Tập {progress?.currentEpisode || 1}
                    {progress?.totalEpisodes ? `/${progress.totalEpisodes}` : ''}
                  </span>
                </div>
                {hasPercent ? (
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-red-500"
                      style={{
                        width: `${Math.min(100, Math.max(0, progress?.percent || 0))}%`,
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full w-1/3 rounded-full bg-red-500" />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={compact ? 'p-3' : 'p-4'}>
            <h3
              className={`font-bold leading-5 text-white transition group-hover:text-red-400 ${
                compact ? 'min-h-[2.5rem] text-[13px]' : 'min-h-[2.9rem] text-sm sm:text-[15px]'
              }`}
              title={movie.title}
            >
              {movie.title}
            </h3>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400 sm:text-xs">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                👁 {formatViews(movie.views)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                🎞 {episodeCount} tập
              </span>
              {movie.country && (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                  🌎 {movie.country}
                </span>
              )}
            </div>

            {!compact && (
              <div className="hidden sm:block">
                <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-zinc-400">
                  {movie.description ||
                    'Khám phá bộ phim đang được cập nhật với giao diện xem hiện đại và tối ưu cho mọi thiết bị.'}
                </p>

                <div className="mt-4 flex items-center gap-2">
                  <div className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-white px-3 text-xs font-bold text-black transition group-hover:bg-zinc-200">
                    {hasPercent || hasEpisodeProgress ? 'Tiếp tục xem' : 'Xem ngay'}
                  </div>
                  <div className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-zinc-200">
                    Chi tiết
                  </div>
                </div>
              </div>
            )}
          </div>
        </article>
      </Link>
    </div>
  )
}

export default function PhimPage() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('newest')
  const [density, setDensity] = useState<Density>('comfortable')
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, ProgressItem>>({})
  const [playerStateMap, setPlayerStateMap] = useState<Record<string, PlayerStateItem>>({})
  const [fetchError, setFetchError] = useState('')

  useEffect(() => {
    setFavoriteIds(safeRead<string[]>(STORAGE_FAVORITES, []))
    setDensity(safeRead<Density>(STORAGE_DENSITY, 'comfortable'))

    const rawProgress = safeRead<Record<string, ProgressItem> | ProgressItem[]>(
      STORAGE_PROGRESS,
      {}
    )

    const rawPlayerState = safeRead<
      Record<string, PlayerStateItem> | PlayerStateItem[]
    >(STORAGE_PLAYER_STATE, {})

    setProgressMap(normalizeProgressData(rawProgress))
    setPlayerStateMap(normalizePlayerStateData(rawPlayerState))
  }, [])

  const fetchMovies = useCallback(async () => {
    setIsLoading(true)
    setFetchError('')

    const { data, error } = await supabase
      .from('movies')
      .select(
        'id,title,cover_url,status,views,description,country,release_year,rating,created_at,episodes(count)'
      )
      .order('created_at', { ascending: false })

    if (error) {
      setFetchError('Không thể tải danh sách phim lúc này.')
      setIsLoading(false)
      return
    }

    setMovies((data as Movie[]) || [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchMovies()
  }, [fetchMovies])

  const toggleFavorite = useCallback((movieId: string) => {
    setFavoriteIds((prev) => {
      const next = prev.includes(movieId)
        ? prev.filter((id) => id !== movieId)
        : [movieId, ...prev]
      safeWrite(STORAGE_FAVORITES, next)
      return next
    })
  }, [])

  const continueWatchingMap = useMemo(() => {
    const merged: Record<string, ContinueWatchingItem> = {}

    Object.values(progressMap).forEach((item) => {
      if (!item?.movieId) return
      merged[item.movieId] = {
        movieId: item.movieId,
        title: item.title,
        cover_url: item.cover_url,
        currentEpisode: item.currentEpisode,
        totalEpisodes: item.totalEpisodes,
        percent: item.percent,
        updatedAt: item.updatedAt,
      }
    })

    Object.values(playerStateMap).forEach((item) => {
      if (!item?.movieId) return

      if (!merged[item.movieId]) {
        merged[item.movieId] = {
          movieId: item.movieId,
          currentEpisode: item.episodeNumber,
          updatedAt: item.updatedAt,
        }
      } else {
        merged[item.movieId] = {
          ...merged[item.movieId],
          currentEpisode:
            merged[item.movieId].currentEpisode || item.episodeNumber,
          updatedAt: merged[item.movieId].updatedAt || item.updatedAt,
        }
      }
    })

    return merged
  }, [progressMap, playerStateMap])

  const filteredMovies = useMemo(() => {
    let result = [...movies]
    const keyword = normalizeText(searchTerm)

    if (keyword) {
      result = result.filter((movie) => {
        const title = normalizeText(movie.title)
        const description = normalizeText(movie.description || '')
        const country = normalizeText(movie.country || '')
        return (
          title.includes(keyword) ||
          description.includes(keyword) ||
          country.includes(keyword)
        )
      })
    }

    if (statusFilter === 'completed') {
      result = result.filter((movie) => movie.status === 'Hoàn thành')
    } else if (statusFilter === 'ongoing') {
      result = result.filter((movie) => movie.status !== 'Hoàn thành')
    } else if (statusFilter === 'favorites') {
      result = result.filter((movie) => favoriteIds.includes(movie.id))
    }

    if (sortBy === 'popular') {
      result.sort((a, b) => (b.views || 0) - (a.views || 0))
    } else if (sortBy === 'az') {
      result.sort((a, b) => a.title.localeCompare(b.title, 'vi'))
    } else {
      result.sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
        return bTime - aTime
      })
    }

    return result
  }, [movies, searchTerm, statusFilter, sortBy, favoriteIds])

  const featuredMovie = useMemo(() => {
    if (!filteredMovies.length) return undefined
    return [...filteredMovies].sort((a, b) => (b.views || 0) - (a.views || 0))[0]
  }, [filteredMovies])

  const continueWatching = useMemo(() => {
    return Object.values(continueWatchingMap)
      .filter(
        (item) =>
          item?.movieId &&
          ((item.percent || 0) > 0 || typeof item.currentEpisode === 'number')
      )
      .sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return bTime - aTime
      })
      .map((item) => {
        const matchedMovie = movies.find((movie) => movie.id === item.movieId)

        if (matchedMovie) {
          return {
            movie: matchedMovie,
            progress: {
              ...item,
              totalEpisodes:
                item.totalEpisodes || getEpisodeCount(matchedMovie) || undefined,
            },
          }
        }

        return {
          movie: {
            id: item.movieId,
            title: item.title || 'Phim đang xem',
            cover_url: item.cover_url || FALLBACK_COVER,
            status: 'Đang cập nhật',
            views: 0,
            description: '',
            country: '',
            release_year: null,
            rating: null,
            created_at: null,
            episodes: [{ count: item.totalEpisodes || 0 }],
          } as Movie,
          progress: item,
        }
      })
      .slice(0, 10)
  }, [continueWatchingMap, movies])

  const favoriteMovies = useMemo(() => {
    return movies.filter((movie) => favoriteIds.includes(movie.id)).slice(0, 12)
  }, [movies, favoriteIds])

  const popularMovies = useMemo(() => {
    return [...movies].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10)
  }, [movies])

  const latestMovies = useMemo(() => filteredMovies.slice(0, 24), [filteredMovies])

  const filterCounts = useMemo(() => {
    const completed = movies.filter((m) => m.status === 'Hoàn thành').length
    const ongoing = movies.length - completed

    return {
      all: movies.length,
      ongoing,
      completed,
      favorites: favoriteIds.length,
    }
  }, [movies, favoriteIds])

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(220,38,38,0.14),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(255,255,255,0.04),transparent_18%),linear-gradient(to_bottom,#09090b,#09090b)]" />

      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#09090b]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-700 text-lg shadow-[0_0_20px_rgba(239,68,68,0.35)]">
                🎬
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-black tracking-tight text-white">
                  PHIM ĐAM MỸ
                </p>
                <p className="hidden text-[11px] uppercase tracking-[0.22em] text-zinc-500 sm:block">
                  Xem phim nhanh, đẹp, tiện
                </p>
              </div>
            </Link>

            <div className="hidden items-center gap-2 md:flex">
              <button
                type="button"
                onClick={() => {
                  setDensity('comfortable')
                  safeWrite(STORAGE_DENSITY, 'comfortable')
                }}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  density === 'comfortable'
                    ? 'border-red-500/30 bg-red-500/15 text-red-300'
                    : 'border-white/10 bg-white/[0.04] text-zinc-300'
                }`}
              >
                Thẻ lớn
              </button>
              <button
                type="button"
                onClick={() => {
                  setDensity('compact')
                  safeWrite(STORAGE_DENSITY, 'compact')
                }}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  density === 'compact'
                    ? 'border-red-500/30 bg-red-500/15 text-red-300'
                    : 'border-white/10 bg-white/[0.04] text-zinc-300'
                }`}
              >
                Thẻ gọn
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                🔍
              </span>
              <input
                type="text"
                placeholder="Tìm tên phim, mô tả, từ khóa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.05] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-red-500/35 focus:bg-white/[0.08]"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-zinc-200 outline-none"
            >
              <option value="all">Tất cả</option>
              <option value="ongoing">Đang cập nhật</option>
              <option value="completed">Hoàn thành</option>
              <option value="favorites">Yêu thích</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-zinc-200 outline-none"
            >
              <option value="newest">Mới cập nhật</option>
              <option value="popular">Xem nhiều</option>
              <option value="az">A → Z</option>
            </select>
          </div>

          <QuickFilterRow
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            sortBy={sortBy}
            setSortBy={setSortBy}
            counts={filterCounts}
          />
        </div>
      </header>

      {featuredMovie && !isLoading && (
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-[28px] border border-white/8 bg-zinc-900">
              <div className="absolute inset-0">
                <PosterImage
                  src={featuredMovie.cover_url}
                  alt={featuredMovie.title}
                  priority
                  className="h-full w-full object-cover opacity-30"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#09090b] via-[#09090be8] to-[#09090b80]" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-transparent to-transparent" />
              </div>

              <div className="relative grid min-h-[300px] items-end px-4 py-5 sm:min-h-[380px] sm:px-6 sm:py-8 lg:min-h-[500px] lg:grid-cols-[1.08fr_0.92fr] lg:px-10 lg:py-10">
                <div className="max-w-2xl">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-red-300">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    Nổi bật cho bạn
                  </div>

                  <h1 className="mb-3 text-2xl font-black leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
                    {featuredMovie.title}
                  </h1>

                  <p className="mb-5 max-w-xl text-sm leading-6 text-zinc-300 sm:text-base sm:leading-7">
                    {featuredMovie.description ||
                      'Bộ phim nổi bật với giao diện xem hiện đại, tải mượt, thao tác dễ trên điện thoại, tablet và desktop.'}
                  </p>

                  <div className="mb-6 flex flex-wrap gap-2 text-xs sm:text-sm">
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-zinc-200">
                      👁 {formatViews(featuredMovie.views)} lượt xem
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-zinc-200">
                      🎞 {getEpisodeCount(featuredMovie)} tập
                    </span>
                    {featuredMovie.country && (
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-zinc-200">
                        🌎 {featuredMovie.country}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-3 py-1.5 font-semibold ${
                        featuredMovie.status === 'Hoàn thành'
                          ? 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
                          : 'border border-red-400/20 bg-red-500/10 text-red-300'
                      }`}
                    >
                      {featuredMovie.status || 'Đang cập nhật'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/phim/${featuredMovie.id}`}
                      prefetch={false}
                      className="inline-flex h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-bold text-black transition hover:bg-zinc-200"
                    >
                      ▶ Xem ngay
                    </Link>

                    <button
                      type="button"
                      onClick={() => toggleFavorite(featuredMovie.id)}
                      className={`inline-flex h-12 items-center justify-center rounded-2xl border px-5 text-sm font-bold transition ${
                        favoriteIds.includes(featuredMovie.id)
                          ? 'border-red-500/30 bg-red-500/15 text-red-300'
                          : 'border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.08]'
                      }`}
                    >
                      {favoriteIds.includes(featuredMovie.id)
                        ? '♥ Đã yêu thích'
                        : '♡ Yêu thích'}
                    </button>

                    <a
                      href="#thu-vien-phim"
                      className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-5 text-sm font-bold text-white transition hover:bg-white/[0.08]"
                    >
                      Khám phá thư viện
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {continueWatching.length > 0 && (
          <section className="mb-10">
            <SectionTitle eyebrow="Dành cho bạn" title="Tiếp tục xem" />
            <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {continueWatching.map((item, index) => (
                <div
                  key={item.movie.id}
                  className="w-[42vw] min-w-[170px] max-w-[240px] sm:w-[28vw] md:w-[22vw] lg:w-[18vw]"
                >
                  <MovieCard
                    movie={item.movie}
                    isFavorite={favoriteIds.includes(item.movie.id)}
                    onToggleFavorite={toggleFavorite}
                    progress={item.progress}
                    priority={index < 2}
                    density="compact"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {favoriteMovies.length > 0 && (
          <section className="mb-10">
            <SectionTitle
              eyebrow="Cá nhân hóa"
              title="Danh sách yêu thích"
              extra={
                <button
                  type="button"
                  onClick={() => setStatusFilter('favorites')}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/[0.08]"
                >
                  Xem tất cả
                </button>
              }
            />
            <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {favoriteMovies.map((movie, index) => (
                <div
                  key={movie.id}
                  className="w-[42vw] min-w-[170px] max-w-[240px] sm:w-[28vw] md:w-[22vw] lg:w-[18vw]"
                >
                  <MovieCard
                    movie={movie}
                    isFavorite={true}
                    onToggleFavorite={toggleFavorite}
                    progress={continueWatchingMap[movie.id]}
                    priority={index < 2}
                    density="compact"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {!isLoading && popularMovies.length > 0 && (
          <section className="mb-10">
            <SectionTitle eyebrow="Thịnh hành" title="Phim được xem nhiều" />
            <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {popularMovies.map((movie, index) => (
                <div
                  key={movie.id}
                  className="w-[42vw] min-w-[170px] max-w-[240px] sm:w-[28vw] md:w-[22vw] lg:w-[18vw]"
                >
                  <div className="relative">
                    <div className="absolute left-3 top-3 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-sm font-black text-white">
                      {index + 1}
                    </div>
                    <MovieCard
                      movie={movie}
                      isFavorite={favoriteIds.includes(movie.id)}
                      onToggleFavorite={toggleFavorite}
                      progress={continueWatchingMap[movie.id]}
                      priority={index < 2}
                      density="compact"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section id="thu-vien-phim">
          <SectionTitle
            eyebrow="Thư viện"
            title="Phim mới cập nhật"
            extra={
              <div className="hidden items-center gap-2 sm:flex">
                <button
                  type="button"
                  onClick={() => {
                    setDensity('comfortable')
                    safeWrite(STORAGE_DENSITY, 'comfortable')
                  }}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    density === 'comfortable'
                      ? 'border-red-500/30 bg-red-500/15 text-red-300'
                      : 'border-white/10 bg-white/[0.04] text-zinc-300'
                  }`}
                >
                  Thẻ lớn
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDensity('compact')
                    safeWrite(STORAGE_DENSITY, 'compact')
                  }}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    density === 'compact'
                      ? 'border-red-500/30 bg-red-500/15 text-red-300'
                      : 'border-white/10 bg-white/[0.04] text-zinc-300'
                  }`}
                >
                  Thẻ gọn
                </button>
              </div>
            }
          />

          {searchTerm && (
            <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
              Kết quả cho: “{searchTerm}”
            </div>
          )}

          {fetchError ? (
            <div className="rounded-3xl border border-white/5 bg-white/[0.03] px-6 py-12 text-center">
              <div className="mb-4 text-4xl">⚠️</div>
              <h3 className="text-xl font-black text-white">{fetchError}</h3>
              <button
                type="button"
                onClick={fetchMovies}
                className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-white px-5 text-sm font-bold text-black"
              >
                Tải lại
              </button>
            </div>
          ) : isLoading ? (
            <div
              className={`grid gap-4 ${
                density === 'compact'
                  ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                  : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5'
              }`}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03]"
                >
                  <div className="aspect-[2/3] animate-pulse bg-zinc-800/60" />
                  <div className="space-y-2 p-4">
                    <div className="h-4 w-4/5 animate-pulse rounded bg-zinc-800/60" />
                    <div className="h-3 w-2/5 animate-pulse rounded bg-zinc-800/60" />
                    <div className="h-3 w-full animate-pulse rounded bg-zinc-800/50" />
                  </div>
                </div>
              ))}
            </div>
          ) : latestMovies.length === 0 ? (
            <div className="rounded-3xl border border-white/5 bg-white/[0.03] px-6 py-14 text-center">
              <div className="mb-4 text-4xl">📭</div>
              <h3 className="text-xl font-black text-white">Không tìm thấy phim phù hợp</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
                Hãy thử từ khóa khác, đổi bộ lọc hoặc quay lại chế độ tất cả để khám phá thêm nội dung.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <ToolbarChip
                  active={false}
                  onClick={() => {
                    setSearchTerm('')
                    setStatusFilter('all')
                    setSortBy('newest')
                  }}
                >
                  Đặt lại bộ lọc
                </ToolbarChip>
              </div>
            </div>
          ) : (
            <div
              className={`grid gap-4 ${
                density === 'compact'
                  ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                  : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5'
              }`}
            >
              {latestMovies.map((movie, index) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  isFavorite={favoriteIds.includes(movie.id)}
                  onToggleFavorite={toggleFavorite}
                  progress={continueWatchingMap[movie.id]}
                  priority={index < 4}
                  density={density}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}