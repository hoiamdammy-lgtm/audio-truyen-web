import type { EpisodeForm, MovieForm, ServerForm } from '@/types/movie-admin'

export const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&q=80&w=300&h=400'

export const emptyMovieForm: MovieForm = {
  title: '',
  cover_url: '',
  description: '',
  status: 'Đang ra',
  country: 'Thái Lan',
  genres: '',
  director: '',
  main_cast: '',
  release_year: String(new Date().getFullYear()),
  rating: '',
}

export const emptyEpisodeForm: EpisodeForm = {
  episode_number: '',
  title: '',
}

export const emptyServerForm: ServerForm = {
  name: '',
  provider: 'direct',
  url: '',
  embed_url: '',
  source_type: 'embed',
  sort_order: '1',
  is_active: true,
  is_primary: false,
  note: '',
}

export const removeAccents = (str: string) =>
  str?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() || ''

export function formatDate(date?: string | null) {
  if (!date) return '---'
  try {
    return new Date(date).toLocaleDateString('vi-VN')
  } catch {
    return '---'
  }
}

export function detectProvider(url: string) {
  const value = url.toLowerCase()

  if (value.includes('ok.ru')) return 'okru'
  if (value.includes('bili')) return 'bilibili'
  if (value.includes('drive.google.com')) return 'google_drive'
  if (value.includes('youtube.com') || value.includes('youtu.be')) return 'youtube'
  if (value.includes('t.me/')) return 'telegram'

  return 'direct'
}

export function normalizeServerName(provider: string, currentName: string) {
  const trimmed = currentName.trim()
  if (trimmed) return trimmed

  switch (provider) {
    case 'okru':
      return 'OK.ru'
    case 'bilibili':
      return 'Bilibili'
    case 'google_drive':
      return 'Google Drive'
    case 'seekstreaming':
      return 'seekstreaming'
    case 'telegram':
      return 'Telegram'
    default:
      return 'Server'
  }
}

export function processEmbedUrl(input: string) {
  if (!input) return ''
  let processedUrl = input.trim()

  if (processedUrl.includes('<iframe') && processedUrl.includes('src=')) {
    const srcMatch = processedUrl.match(/src=["'](.*?)["']/)
    if (srcMatch?.[1]) processedUrl = srcMatch[1]
  }

  if (processedUrl.startsWith('//')) {
    processedUrl = 'https:' + processedUrl
  }

  if (processedUrl.includes('ok.ru/videoembed') && !processedUrl.includes('autoplay=')) {
    processedUrl += processedUrl.includes('?') ? '&autoplay=0' : '?autoplay=0'
  }

  if (processedUrl.includes('drive.google.com/file/d/')) {
    processedUrl = processedUrl.replace('/view?usp=sharing', '/preview')
  }

  return processedUrl
}