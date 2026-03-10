'use client'

import { FALLBACK_COVER } from '@/lib/movie-admin-utils'
import type { Movie } from '@/types/movie-admin'

type Props = {
  movies: Movie[]
  selectedMovieId: string
  searchTerm: string
  onSearchChange: (value: string) => void
  onSelectMovie: (movie: Movie) => void
  onCreateMovie: () => void
}

export default function AdminSidebar({
  movies,
  selectedMovieId,
  searchTerm,
  onSearchChange,
  onSelectMovie,
  onCreateMovie,
}: Props) {
  return (
    <aside className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-4 shadow-lg">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-white">Kho phim</h2>
          <p className="mt-1 text-[11px] text-zinc-500">Chọn phim để thao tác bên phải</p>
        </div>

        <button
          onClick={onCreateMovie}
          className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-black transition hover:bg-zinc-200"
        >
          + Phim mới
        </button>
      </div>

      <input
        type="text"
        placeholder="Tìm tên phim..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="mb-4 h-11 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-200 outline-none transition focus:border-red-500"
      />

      <div className="max-h-[78vh] space-y-3 overflow-y-auto pr-1 custom-scrollbar">
        {movies.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-8 text-center text-sm text-zinc-500">
            Không có phim nào
          </div>
        ) : (
          movies.map((movie) => {
            const isActive = selectedMovieId === movie.id

            return (
              <button
                key={movie.id}
                onClick={() => onSelectMovie(movie)}
                className={`w-full rounded-2xl border p-3 text-left transition ${
                  isActive
                    ? 'border-red-500/40 bg-red-500/10 shadow-lg shadow-red-950/20'
                    : 'border-zinc-800/80 bg-zinc-950/50 hover:border-zinc-700'
                }`}
              >
                <div className="flex gap-3">
                  <img
                    src={movie.cover_url || FALLBACK_COVER}
                    className="h-24 w-16 shrink-0 rounded-xl border border-zinc-700 object-cover"
                    alt={movie.title}
                    onError={(e) => {
                      e.currentTarget.src = FALLBACK_COVER
                    }}
                  />

                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 text-sm font-bold text-zinc-100">
                      {movie.title}
                    </h3>

                    <div className="mt-2 space-y-1 text-[11px] text-zinc-500">
                      <p>🌍 {movie.country || '---'}</p>
                      <p>📅 {movie.release_year || '---'}</p>
                      <p>🎞 {movie.status || 'Đang ra'}</p>
                    </div>
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </aside>
  )
}