'use client'

import type { EpisodeForm as EpisodeFormType } from '@/types/movie-admin'

type Props = {
  form: EpisodeFormType
  editingEpisodeId: string | null
  isSaving: boolean
  selectedMovieTitle?: string
  onChange: (next: EpisodeFormType) => void
  onSubmit: (e: React.FormEvent) => void
  onReset: () => void
  onBack: () => void
}

export default function EpisodeForm({
  form,
  editingEpisodeId,
  isSaving,
  selectedMovieTitle,
  onChange,
  onSubmit,
  onReset,
  onBack,
}: Props) {
  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-black text-white">
            {editingEpisodeId ? 'Chỉnh sửa tập' : 'Thêm tập mới'}
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            {selectedMovieTitle
              ? `Phim đang chọn: ${selectedMovieTitle}`
              : 'Hãy chọn phim trước'}
          </p>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:bg-zinc-800"
        >
          Quay lại
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-4">
          <h3 className="mb-4 text-sm font-black text-white">Thông tin tập</h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Số tập</label>
              <input
                type="number"
                value={form.episode_number}
                onChange={(e) => onChange({ ...form, episode_number: e.target.value })}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Tên hiển thị</label>
              <input
                value={form.title}
                onChange={(e) => onChange({ ...form, title: e.target.value })}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
                placeholder="VD: Tập 1 / Tập 12 END"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-zinc-800 pt-4">
          <button
            type="submit"
            disabled={isSaving}
            className="min-w-[180px] rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-zinc-200 disabled:opacity-60"
          >
            {isSaving ? 'Đang lưu...' : editingEpisodeId ? 'Lưu thay đổi' : 'Thêm tập mới'}
          </button>

          <button
            type="button"
            onClick={onReset}
            className="rounded-2xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-bold text-zinc-200 transition hover:bg-zinc-800"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  )
}