'use client'

import type { Episode } from '@/types/movie-admin'

type Props = {
  episodes: Episode[]
  selectedEpisodeId: string
  onSelectEpisode: (episode: Episode) => void
  onCreateEpisode: () => void
  onEditEpisode: (episode: Episode) => void
  onDeleteEpisode: (episode: Episode) => void
}

export default function EpisodeList({
  episodes,
  selectedEpisodeId,
  onSelectEpisode,
  onCreateEpisode,
  onEditEpisode,
  onDeleteEpisode,
}: Props) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-200">Danh sách tập ({episodes.length})</h3>
          <p className="mt-1 text-[11px] text-zinc-500">Chọn tập để chỉnh sửa</p>
        </div>

        <button
          type="button"
          onClick={onCreateEpisode}
          className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-[11px] font-bold text-zinc-200 hover:bg-zinc-800"
        >
          + Tập mới
        </button>
      </div>

      <div className="max-h-[680px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
        {episodes.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/60 text-center text-sm text-zinc-500">
            Phim này chưa có tập nào
          </div>
        ) : (
          episodes.map((episode) => {
            const isActive = selectedEpisodeId === episode.id

            return (
              <div
                key={episode.id}
                className={`rounded-2xl border p-3 transition ${
                  isActive
                    ? 'border-red-500/40 bg-red-500/10'
                    : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'
                }`}
              >
                <button
                  onClick={() => onSelectEpisode(episode)}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-zinc-800 px-3 py-1 text-[10px] font-black text-red-400">
                      Tập {episode.episode_number}
                    </span>
                    <span className="truncate text-sm font-bold text-zinc-100">
                      {episode.title || `Tập ${episode.episode_number}`}
                    </span>
                  </div>
                </button>

                <div className="mt-3 flex justify-end gap-2 border-t border-zinc-800 pt-3">
                  <button
                    onClick={() => onEditEpisode(episode)}
                    className="rounded-lg bg-zinc-800 px-3 py-1.5 text-[11px] font-bold text-zinc-200 hover:bg-zinc-700"
                  >
                    Sửa
                  </button>

                  <button
                    onClick={() => onDeleteEpisode(episode)}
                    className="rounded-lg bg-red-500/10 px-3 py-1.5 text-[11px] font-bold text-red-400 hover:bg-red-500 hover:text-white"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}