export type Movie = {
  id: string
  title: string
  cover_url?: string | null
  description?: string | null
  status?: string | null
  country?: string | null
  genres?: string | null
  director?: string | null
  main_cast?: string | null
  release_year?: number | null
  rating?: number | null
  views?: number | null
  views_week?: number | null
  views_month?: number | null
  created_at?: string | null
}

export type Episode = {
  id: string
  movie_id: string
  episode_number: number
  title?: string | null
  created_at?: string | null
}

export type EpisodeServer = {
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

export type MovieForm = {
  title: string
  cover_url: string
  description: string
  status: string
  country: string
  genres: string
  director: string
  main_cast: string
  release_year: string
  rating: string
}

export type EpisodeForm = {
  episode_number: string
  title: string
}

export type ServerForm = {
  name: string
  provider: string
  url: string
  embed_url: string
  source_type: string
  sort_order: string
  is_active: boolean
  is_primary: boolean
  note: string
}

export type WorkspaceView =
  | 'dashboard'
  | 'movie-form'
  | 'episode-form'
  | 'server-form'