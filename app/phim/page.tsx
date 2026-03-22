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
const STORAGE_PLAYER_STATE = 'movie-player-state-v2'

const COUNTRY_ALIASES: Record<string, string> = {
  'trung quoc': 'Trung Quốc',
  'trug quoc': 'Trung Quốc',
  china: 'Trung Quốc',
  cn: 'Trung Quốc',
  'han quoc': 'Hàn Quốc',
  'nam han': 'Hàn Quốc',
  korea: 'Hàn Quốc',
  'south korea': 'Hàn Quốc',
  kr: 'Hàn Quốc',
  'nhat ban': 'Nhật Bản',
  japan: 'Nhật Bản',
  jp: 'Nhật Bản',
  'thai lan': 'Thái Lan',
  thailand: 'Thái Lan',
  th: 'Thái Lan',
  'dai loan': 'Đài Loan',
  taiwan: 'Đài Loan',
  tw: 'Đài Loan',
  'hong kong': 'Hồng Kông',
  hongkong: 'Hồng Kông',
  'viet nam': 'Việt Nam',
  vietnam: 'Việt Nam',
  vn: 'Việt Nam',
  'hoa ky': 'Mỹ',
  usa: 'Mỹ',
  us: 'Mỹ',
}

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
type SortBy = 'newest' | 'popular' | 'az' | 'year-desc' | 'year-asc'

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

function prettifyLabel(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function normalizeCountryLabel(country?: string | null) {
  if (!country) return 'Khác'

  const cleaned = normalizeText(country).replace(/\s+/g, ' ')
  return COUNTRY_ALIASES[cleaned] || prettifyLabel(country)
}

function extractMovieCountries(country?: string | null) {
  if (!country) return ['Khác']

  const normalized = country
    .split(/[,/|;]+| - | – /g)
    .map((item) => normalizeCountryLabel(item))
    .filter(Boolean)

  return Array.from(new Set(normalized.length ? normalized : ['Khác']))
}

function getPrimaryCountry(country?: string | null) {
  return extractMovieCountries(country)[0] || 'Khác'
}

function formatMovieCountries(country?: string | null) {
  return extractMovieCountries(country).join(', ')
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

function sortMovies(list: Movie[], sortBy: SortBy) {
  const result = [...list]

  if (sortBy === 'popular') {
    result.sort((a, b) => (b.views || 0) - (a.views || 0))
    return result
  }

  if (sortBy === 'az') {
    result.sort((a, b) => a.title.localeCompare(b.title, 'vi'))
    return result
  }

  if (sortBy === 'year-desc') {
    result.sort((a, b) => (b.release_year || 0) - (a.release_year || 0))
    return result
  }

  if (sortBy === 'year-asc') {
    result.sort((a, b) => (a.release_year || 0) - (b.release_year || 0))
    return result
  }

  result.sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
    return bTime - aTime
  })

  return result
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

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ colorScheme: 'dark' }}
      className="h-11 w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 text-sm text-white outline-none transition focus:border-red-500/35 focus:bg-zinc-950"
    >
      {children}
    </select>
  )
}

function MovieCard({
  movie,
  isFavorite,
  onToggleFavorite,
  progress,
  priority = false,
}: {
  movie: Movie
  isFavorite: boolean
  onToggleFavorite: (movieId: string) => void
  progress?: ContinueWatchingItem
  priority?: boolean
}) {
  const episodeCount = getEpisodeCount(movie)
  const hasPercent = typeof progress?.percent === 'number' && (progress.percent || 0) > 0
  const hasEpisodeProgress = typeof progress?.currentEpisode === 'number'
  const countries = formatMovieCountries(movie.country)

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

          <div className="p-4">
            <h3
              className="min-h-[2.9rem] text-sm font-bold leading-5 text-white transition group-hover:text-red-400 sm:text-[15px]"
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
              {movie.release_year && (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                  📅 {movie.release_year}
                </span>
              )}
              {countries && (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                  🌎 {countries}
                </span>
              )}
            </div>

            <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-zinc-400">
              {movie.description ||
                'Khám phá bộ phim đang được cập nhật với giao diện rõ ràng, lọc nhanh theo quốc gia và năm.'}
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
  const [countryFilter, setCountryFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, ProgressItem>>({})
  const [playerStateMap, setPlayerStateMap] = useState<Record<string, PlayerStateItem>>({})
  const [fetchError, setFetchError] = useState('')

  useEffect(() => {
    setFavoriteIds(safeRead<string[]>(STORAGE_FAVORITES, []))

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
          currentEpisode: merged[item.movieId].currentEpisode || item.episodeNumber,
          updatedAt: merged[item.movieId].updatedAt || item.updatedAt,
        }
      }
    })

    return merged
  }, [progressMap, playerStateMap])

  const countryOptions = useMemo(() => {
    const unique = new Set<string>()

    movies.forEach((movie) => {
      extractMovieCountries(movie.country).forEach((country) => unique.add(country))
    })

    return Array.from(unique).sort((a, b) => {
      if (a === 'Khác') return 1
      if (b === 'Khác') return -1
      return a.localeCompare(b, 'vi')
    })
  }, [movies])

  const yearOptions = useMemo(() => {
    return Array.from(
      new Set(movies.map((movie) => movie.release_year).filter(Boolean) as number[])
    ).sort((a, b) => b - a)
  }, [movies])

  const countryCounts = useMemo(() => {
    const counts = new Map<string, number>()

    movies.forEach((movie) => {
      extractMovieCountries(movie.country).forEach((country) => {
        counts.set(country, (counts.get(country) || 0) + 1)
      })
    })

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi'))
      .slice(0, 8)
      .map(([country, count]) => ({ country, count }))
  }, [movies])

  const filteredMovies = useMemo(() => {
    let result = [...movies]
    const keyword = normalizeText(searchTerm)

    if (keyword) {
      result = result.filter((movie) => {
        const title = normalizeText(movie.title)
        const description = normalizeText(movie.description || '')
        const rawCountry = normalizeText(movie.country || '')
        const canonicalCountries = extractMovieCountries(movie.country)
          .map((item) => normalizeText(item))
          .join(' ')
        const year = movie.release_year ? String(movie.release_year) : ''

        return (
          title.includes(keyword) ||
          description.includes(keyword) ||
          rawCountry.includes(keyword) ||
          canonicalCountries.includes(keyword) ||
          year.includes(keyword)
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

    if (countryFilter !== 'all') {
      result = result.filter((movie) =>
        extractMovieCountries(movie.country).includes(countryFilter)
      )
    }

    if (yearFilter !== 'all') {
      result = result.filter((movie) => String(movie.release_year || '') === yearFilter)
    }

    return sortMovies(result, sortBy)
  }, [movies, searchTerm, statusFilter, favoriteIds, countryFilter, yearFilter, sortBy])

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

  const filteredGroups = useMemo(() => {
    const grouped = new Map<string, Movie[]>()

    filteredMovies.forEach((movie) => {
      const key = getPrimaryCountry(movie.country)
      const current = grouped.get(key) || []
      current.push(movie)
      grouped.set(key, current)
    })

    return Array.from(grouped.entries())
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'vi'))
      .map(([country, items]) => ({ country, items }))
  }, [filteredMovies])

  const activeFilterLabel = useMemo(() => {
    const labels: string[] = []

    if (countryFilter !== 'all') labels.push(countryFilter)
    if (yearFilter !== 'all') labels.push(yearFilter)
    if (statusFilter === 'ongoing') labels.push('Đang cập nhật')
    if (statusFilter === 'completed') labels.push('Hoàn thành')
    if (statusFilter === 'favorites') labels.push('Yêu thích')

    return labels.join(' • ')
  }, [countryFilter, yearFilter, statusFilter])

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(220,38,38,0.14),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(255,255,255,0.04),transparent_18%),linear-gradient(to_bottom,#09090b,#09090b)]" />

      <header className="border-b border-white/5 bg-[#09090b]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.04] p-5 sm:p-6 lg:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-700 text-lg shadow-[0_0_20px_rgba(239,68,68,0.35)]">
                    🎬
                  </div>
                  <div>
                    <p className="text-xl font-black tracking-tight text-white sm:text-2xl">
                      PHIM ĐAM MỸ
                    </p>
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Dễ xem hơn • Lọc nhanh hơn • Gọn hơn
                    </p>
                  </div>
                </div>

                <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-400 sm:text-[15px] sm:leading-7">
                  Tập trung vào điều người xem cần nhất: tìm phim nhanh theo tên, quốc gia, năm phát hành và trạng thái, không còn các khối thống kê gây rối mắt.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
                <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-zinc-300">
                  {movies.length} phim
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-zinc-300">
                  {countryOptions.length} quốc gia
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-zinc-300">
                  {yearOptions.length} năm
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative sm:col-span-2 lg:col-span-2">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Tìm tên phim, quốc gia, năm..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.05] pl-11 pr-12 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-red-500/35 focus:bg-white/[0.08]"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-sm text-zinc-400 transition hover:bg-white/10 hover:text-white"
                    aria-label="Xóa tìm kiếm"
                  >
                    ✕
                  </button>
                )}
              </div>

              <FilterSelect value={countryFilter} onChange={setCountryFilter}>
                <option value="all">Tất cả quốc gia</option>
                {countryOptions.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect value={yearFilter} onChange={setYearFilter}>
                <option value="all">Tất cả năm</option>
                {yearOptions.map((year) => (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                ))}
              </FilterSelect>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FilterSelect value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)}>
                <option value="all">Tất cả trạng thái</option>
                <option value="ongoing">Đang cập nhật</option>
                <option value="completed">Hoàn thành</option>
                <option value="favorites">Yêu thích</option>
              </FilterSelect>

              <FilterSelect value={sortBy} onChange={(value) => setSortBy(value as SortBy)}>
                <option value="newest">Mới cập nhật</option>
                <option value="popular">Xem nhiều</option>
                <option value="az">A → Z</option>
                <option value="year-desc">Năm mới → cũ</option>
                <option value="year-asc">Năm cũ → mới</option>
              </FilterSelect>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <ToolbarChip active={countryFilter === 'all'} onClick={() => setCountryFilter('all')}>
              Toàn bộ quốc gia
            </ToolbarChip>
            {countryCounts.map((item) => (
              <ToolbarChip
                key={item.country}
                active={countryFilter === item.country}
                onClick={() => setCountryFilter(item.country)}
              >
                {item.country} ({item.count})
              </ToolbarChip>
            ))}
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <ToolbarChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
              Tất cả ({filterCounts.all})
            </ToolbarChip>
            <ToolbarChip active={statusFilter === 'ongoing'} onClick={() => setStatusFilter('ongoing')}>
              Đang cập nhật ({filterCounts.ongoing})
            </ToolbarChip>
            <ToolbarChip active={statusFilter === 'completed'} onClick={() => setStatusFilter('completed')}>
              Hoàn thành ({filterCounts.completed})
            </ToolbarChip>
            <ToolbarChip active={statusFilter === 'favorites'} onClick={() => setStatusFilter('favorites')}>
              Yêu thích ({filterCounts.favorites})
            </ToolbarChip>
          </div>
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

              <div className="relative grid min-h-[300px] items-end px-4 py-5 sm:min-h-[380px] sm:px-6 sm:py-8 lg:min-h-[460px] lg:grid-cols-[1.08fr_0.92fr] lg:px-10 lg:py-10">
                <div className="max-w-2xl">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-red-300">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    Nổi bật theo bộ lọc hiện tại
                  </div>

                  <h1 className="mb-3 text-2xl font-black leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
                    {featuredMovie.title}
                  </h1>

                  <p className="mb-5 max-w-xl text-sm leading-6 text-zinc-300 sm:text-base sm:leading-7">
                    {featuredMovie.description ||
                      'Bộ phim nổi bật trong nhóm kết quả hiện tại, ưu tiên hiển thị rõ quốc gia và năm để duyệt nhanh hơn.'}
                  </p>

                  <div className="mb-6 flex flex-wrap gap-2 text-xs sm:text-sm">
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-zinc-200">
                      👁 {formatViews(featuredMovie.views)} lượt xem
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-zinc-200">
                      🎞 {getEpisodeCount(featuredMovie)} tập
                    </span>
                    {featuredMovie.release_year && (
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-zinc-200">
                        📅 {featuredMovie.release_year}
                      </span>
                    )}
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-zinc-200">
                      🌎 {formatMovieCountries(featuredMovie.country)}
                    </span>
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
            title={countryFilter === 'all' ? 'Phân loại theo quốc gia' : 'Kết quả theo bộ lọc'}
            extra={
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-300">
                {filteredMovies.length} phim
              </div>
            }
          />

          {(searchTerm || activeFilterLabel) && (
            <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
              {searchTerm && <span>Kết quả cho: “{searchTerm}”</span>}
              {activeFilterLabel && <span>• {activeFilterLabel}</span>}
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
          ) : filteredMovies.length === 0 ? (
            <div className="rounded-3xl border border-white/5 bg-white/[0.03] px-6 py-14 text-center">
              <div className="mb-4 text-4xl">📭</div>
              <h3 className="text-xl font-black text-white">Không tìm thấy phim phù hợp</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
                Hãy thử từ khóa khác, đổi quốc gia, đổi năm hoặc quay lại chế độ tất cả.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <ToolbarChip
                  active={false}
                  onClick={() => {
                    setSearchTerm('')
                    setStatusFilter('all')
                    setSortBy('newest')
                    setCountryFilter('all')
                    setYearFilter('all')
                  }}
                >
                  Đặt lại bộ lọc
                </ToolbarChip>
              </div>
            </div>
          ) : countryFilter !== 'all' ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filteredMovies.map((movie, index) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  isFavorite={favoriteIds.includes(movie.id)}
                  onToggleFavorite={toggleFavorite}
                  progress={continueWatchingMap[movie.id]}
                  priority={index < 4}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-10">
              {filteredGroups.map((group) => (
                <section key={group.country}>
                  <SectionTitle
                    eyebrow="Quốc gia"
                    title={group.country}
                    extra={
                      <button
                        type="button"
                        onClick={() => setCountryFilter(group.country)}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/[0.08]"
                      >
                        Lọc riêng {group.country}
                      </button>
                    }
                  />

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {group.items.map((movie, index) => (
                      <MovieCard
                        key={movie.id}
                        movie={movie}
                        isFavorite={favoriteIds.includes(movie.id)}
                        onToggleFavorite={toggleFavorite}
                        progress={continueWatchingMap[movie.id]}
                        priority={index < 2}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
