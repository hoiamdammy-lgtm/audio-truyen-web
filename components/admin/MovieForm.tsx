'use client'

import { FALLBACK_COVER } from '@/lib/movie-admin-utils'
import type { MovieForm as MovieFormType } from '@/types/movie-admin'

type Props = {
  form: MovieFormType
  isSaving: boolean
  editingMovieId: string | null
  onChange: (next: MovieFormType) => void
  onSubmit: (e: React.FormEvent) => void
  onReset: () => void
  onBack: () => void
}

export default function MovieForm({
  form,
  isSaving,
  editingMovieId,
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
            {editingMovieId ? 'Chỉnh sửa phim' : 'Thêm phim mới'}
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Nhập thông tin phim trong một khung riêng để dễ thao tác
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
        <div className="grid gap-6 xl:grid-cols-[220px_1fr]">
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
              Ảnh bìa
            </label>

            <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
              <img
                src={form.cover_url || FALLBACK_COVER}
                className="aspect-[3/4] w-full object-cover"
                alt="preview"
                onError={(e) => {
                  e.currentTarget.src = FALLBACK_COVER
                }}
              />
            </div>

            <input
              value={form.cover_url}
              onChange={(e) => onChange({ ...form, cover_url: e.target.value })}
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
              placeholder="Dán link ảnh bìa..."
            />
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-4">
              <h3 className="mb-4 text-sm font-black text-white">Thông tin chính</h3>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400">Tên phim</label>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => onChange({ ...form, title: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-400">Quốc gia</label>
                    <input
                      value={form.country}
                      onChange={(e) => onChange({ ...form, country: e.target.value })}
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-400">Năm phát hành</label>
                    <input
                      type="number"
                      value={form.release_year}
                      onChange={(e) => onChange({ ...form, release_year: e.target.value })}
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-400">Trạng thái</label>
                    <select
                      value={form.status}
                      onChange={(e) => onChange({ ...form, status: e.target.value })}
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100"
                    >
                      <option value="Đang ra">Đang ra</option>
                      <option value="Hoàn thành">Hoàn thành</option>
                      <option value="Sắp chiếu">Sắp chiếu</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-4">
              <h3 className="mb-4 text-sm font-black text-white">Thông tin nội dung</h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400">Diễn viên</label>
                  <input
                    value={form.main_cast}
                    onChange={(e) => onChange({ ...form, main_cast: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400">Đạo diễn</label>
                  <input
                    value={form.director}
                    onChange={(e) => onChange({ ...form, director: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400">Thể loại</label>
                  <input
                    value={form.genres}
                    onChange={(e) => onChange({ ...form, genres: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
                    placeholder="Boy Love, học đường..."
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400">Rating</label>
                  <input
                    value={form.rating}
                    onChange={(e) => onChange({ ...form, rating: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
                    placeholder="4.8"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-4">
              <h3 className="mb-4 text-sm font-black text-white">Mô tả</h3>

              <textarea
                rows={8}
                value={form.description}
                onChange={(e) => onChange({ ...form, description: e.target.value })}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
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
            {isSaving ? 'Đang lưu...' : editingMovieId ? 'Lưu thay đổi' : 'Thêm phim mới'}
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