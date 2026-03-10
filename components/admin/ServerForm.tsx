'use client'

import type { ServerForm as ServerFormType } from '@/types/movie-admin'

const PROVIDER_LABELS: Record<string, string> = {
  direct: 'Direct',
  okru: 'OK.ru',
  bilibili: 'Bilibili',
  google_drive: 'Google Drive',
  youtube: 'YouTube',
  seekstreaming: 'SeekStreaming',
  auto: 'Auto',
}
type Props = {
  form: ServerFormType
  editingServerId: string | null
  isSaving: boolean
  selectedEpisodeTitle?: string
  onChange: (next: ServerFormType) => void
  onSubmit: (e: React.FormEvent) => void
  onReset: () => void
  onBack: () => void
}

export default function ServerForm({
  form,
  editingServerId,
  isSaving,
  selectedEpisodeTitle,
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
            {editingServerId ? 'Chỉnh sửa server' : 'Thêm server mới'}
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            {selectedEpisodeTitle || 'Hãy chọn tập trước'}
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
          <h3 className="mb-4 text-sm font-black text-white">Thông tin server</h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Tên server</label>
              <input
                value={form.name}
                onChange={(e) => onChange({ ...form, name: e.target.value })}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
                placeholder="VD: OK.ru / SeekStreaming"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Provider</label>
              <select
                value={form.provider}
                onChange={(e) => {
                  const provider = e.target.value
                  const label = PROVIDER_LABELS[provider] || provider

                  onChange({
                    ...form,
                    provider,
                    name: label, // tự động cập nhật tên server
                  })
                }}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100"
              >
                <option value="direct">Direct</option>
                <option value="okru">OK.ru</option>
                <option value="bilibili">Bilibili</option>
                <option value="google_drive">Google Drive</option>
                <option value="youtube">YouTube</option>
                <option value="seekstreaming">seekstreaming</option>
                <option value="auto">Tự nhận diện</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Thứ tự</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => onChange({ ...form, sort_order: e.target.value })}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Loại nguồn</label>
              <select
                value={form.source_type}
                onChange={(e) => onChange({ ...form, source_type: e.target.value })}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100"
              >
                <option value="embed">embed</option>
                <option value="direct">direct</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-zinc-400">URL hoặc iframe</label>
            <textarea
              value={form.url}
              onChange={(e) => onChange({ ...form, url: e.target.value })}
              className="min-h-[120px] w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs outline-none text-blue-400 focus:border-red-500"
              placeholder="Dán link hoặc iframe..."
            />
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-zinc-400">Embed URL (nếu có)</label>
            <input
              value={form.embed_url}
              onChange={(e) => onChange({ ...form, embed_url: e.target.value })}
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
            />
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-zinc-400">Ghi chú</label>
            <input
              value={form.note}
              onChange={(e) => onChange({ ...form, note: e.target.value })}
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 outline-none text-zinc-100 focus:border-red-500"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => onChange({ ...form, is_active: e.target.checked })}
              />
              Đang hoạt động
            </label>

            <label className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={form.is_primary}
                onChange={(e) => onChange({ ...form, is_primary: e.target.checked })}
              />
              Đặt làm server chính
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-zinc-800 pt-4">
          <button
            type="submit"
            disabled={isSaving}
            className="min-w-[180px] rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-zinc-200 disabled:opacity-60"
          >
            {isSaving ? 'Đang lưu...' : editingServerId ? 'Lưu thay đổi' : 'Thêm server mới'}
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