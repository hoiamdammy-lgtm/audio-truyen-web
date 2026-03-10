'use client'

import type { EpisodeServer } from '@/types/movie-admin'

type Props = {
  servers: EpisodeServer[]
  selectedEpisodeTitle?: string
  onCreateServer: () => void
  onEditServer: (server: EpisodeServer) => void
  onSetPrimary: (server: EpisodeServer) => void
  onDeleteServer: (server: EpisodeServer) => void
}

export default function ServerList({
  servers,
  selectedEpisodeTitle,
  onCreateServer,
  onEditServer,
  onSetPrimary,
  onDeleteServer,
}: Props) {
  const primaryServer = servers.find((server) => server.is_primary)

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-200">Danh sách server ({servers.length})</h3>
          <p className="mt-1 text-[11px] text-zinc-500">
            {selectedEpisodeTitle || 'Chọn tập để quản lý server'}
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateServer}
          className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-[11px] font-bold text-zinc-200 hover:bg-zinc-800"
        >
          + Server mới
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 text-center text-xs">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 px-3 py-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Hoạt động</div>
          <div className="mt-1 font-black text-white">
            {servers.filter((s) => s.is_active).length}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 px-3 py-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Server chính</div>
          <div className="mt-1 truncate font-black text-red-400">
            {primaryServer?.name || 'Chưa có'}
          </div>
        </div>
      </div>

      <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
        {servers.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/60 text-center text-sm text-zinc-500">
            Tập này chưa có server nào
          </div>
        ) : (
          servers.map((server) => (
            <div
              key={server.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-3 transition hover:border-zinc-700"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[10px] font-black text-red-400">
                      #{server.sort_order}
                    </span>

                    <h4 className="truncate text-sm font-bold text-zinc-100">
                      {server.name}
                    </h4>

                    {server.is_primary && (
                      <span className="rounded-full bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-400">
                        Primary
                      </span>
                    )}

                    {!server.is_active && (
                      <span className="rounded-full bg-zinc-700 px-2 py-1 text-[10px] font-bold text-zinc-300">
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="rounded-full border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-[10px] text-zinc-400">
                      {server.provider || 'direct'}
                    </span>

                    <span className="rounded-full border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-[10px] text-zinc-400">
                      {server.source_type || 'embed'}
                    </span>
                  </div>

                  <p className="line-clamp-2 break-all font-mono text-[11px] text-blue-400">
                    {server.url}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col gap-2">
                  {!server.is_primary && (
                    <button
                      onClick={() => onSetPrimary(server)}
                      className="rounded-lg bg-zinc-800 px-3 py-1.5 text-[11px] font-bold text-zinc-200 hover:bg-zinc-700"
                    >
                      Đặt chính
                    </button>
                  )}

                  <button
                    onClick={() => onEditServer(server)}
                    className="rounded-lg bg-zinc-800 px-3 py-1.5 text-[11px] font-bold text-zinc-200 hover:bg-zinc-700"
                  >
                    Sửa
                  </button>

                  <button
                    onClick={() => onDeleteServer(server)}
                    className="rounded-lg bg-red-500/10 px-3 py-1.5 text-[11px] font-bold text-red-400 hover:bg-red-500 hover:text-white"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}