'use client'

import toast, { Toaster } from 'react-hot-toast'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminSidebar from '@/components/admin/AdminSidebar'
import MovieForm from '@/components/admin/MovieForm'
import EpisodeList from '@/components/admin/EpisodeList'
import EpisodeForm from '@/components/admin/EpisodeForm'
import ServerList from '@/components/admin/ServerList'
import ServerForm from '@/components/admin/ServerForm'
import {
  detectProvider,
  emptyEpisodeForm,
  emptyMovieForm,
  emptyServerForm,
  normalizeServerName,
  processEmbedUrl,
  removeAccents,
} from '@/lib/movie-admin-utils'
import { supabase } from '@/lib/supabase'
import type {
  Episode,
  EpisodeServer,
  Movie,
  WorkspaceView,
} from '@/types/movie-admin'

export default function AdminPhimPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMovieId, setSelectedMovieId] = useState('')
  const [selectedEpisodeId, setSelectedEpisodeId] = useState('')
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('dashboard')

  const [movies, setMovies] = useState<Movie[]>([])
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [servers, setServers] = useState<EpisodeServer[]>([])
  const [isLoadingMovies, setIsLoadingMovies] = useState(true)

  const [movieForm, setMovieForm] = useState(emptyMovieForm)
  const [editingMovieId, setEditingMovieId] = useState<string | null>(null)
  const [isSavingMovie, setIsSavingMovie] = useState(false)

  const [episodeForm, setEpisodeForm] = useState(emptyEpisodeForm)
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null)
  const [isSavingEpisode, setIsSavingEpisode] = useState(false)

  const [serverForm, setServerForm] = useState(emptyServerForm)
  const [editingServerId, setEditingServerId] = useState<string | null>(null)
  const [isSavingServer, setIsSavingServer] = useState(false)

  const resetMovieForm = () => {
    setEditingMovieId(null)
    setMovieForm(emptyMovieForm)
  }

  const resetEpisodeForm = () => {
    setEditingEpisodeId(null)
    setEpisodeForm({
      episode_number:
        episodes.length > 0
          ? String(Math.max(...episodes.map((e) => e.episode_number)) + 1)
          : '1',
      title: '',
    })
  }

  const resetServerForm = () => {
    setEditingServerId(null)
    setServerForm({
      ...emptyServerForm,
      sort_order:
        servers.length > 0
          ? String(Math.max(...servers.map((s) => s.sort_order)) + 1)
          : '1',
      is_primary: servers.length === 0,
    })
  }

  const fetchMovies = useCallback(async () => {
    setIsLoadingMovies(true)

    const { data, error } = await supabase
      .from('movies')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      toast.error('Không tải được danh sách phim')
      setMovies([])
      setIsLoadingMovies(false)
      return
    }

    const list = (data || []) as Movie[]
    setMovies(list)

    if (!selectedMovieId && list.length > 0) {
      setSelectedMovieId(list[0].id)
    }

    setIsLoadingMovies(false)
  }, [selectedMovieId])

  const fetchEpisodes = useCallback(
    async (movieId: string) => {
      if (!movieId) {
        setEpisodes([])
        setSelectedEpisodeId('')
        return
      }

      const { data, error } = await supabase
        .from('episodes')
        .select('id, movie_id, episode_number, title, created_at')
        .eq('movie_id', movieId)
        .order('episode_number', { ascending: true })

      if (error) {
        console.error(error)
        toast.error('Không tải được danh sách tập')
        setEpisodes([])
        return
      }

      const list = (data || []) as Episode[]
      setEpisodes(list)

      if (list.length > 0 && !selectedEpisodeId) {
        setSelectedEpisodeId(list[0].id)
      }
    },
    [selectedEpisodeId]
  )

  const fetchServers = useCallback(async (episodeId: string) => {
    if (!episodeId) {
      setServers([])
      return
    }

    const { data, error } = await supabase
      .from('episode_servers')
      .select('*')
      .eq('episode_id', episodeId)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error(error)
      toast.error('Không tải được danh sách server')
      setServers([])
      return
    }

    setServers((data || []) as EpisodeServer[])
  }, [])

  useEffect(() => {
    fetchMovies()
  }, [fetchMovies])

  useEffect(() => {
    if (selectedMovieId) {
      fetchEpisodes(selectedMovieId)
    } else {
      setEpisodes([])
      setSelectedEpisodeId('')
    }
  }, [selectedMovieId, fetchEpisodes])

  useEffect(() => {
    if (selectedEpisodeId) {
      fetchServers(selectedEpisodeId)
    } else {
      setServers([])
    }
  }, [selectedEpisodeId, fetchServers])

  const filteredMovies = useMemo(() => {
    return movies.filter((m) =>
      removeAccents(m.title).includes(removeAccents(searchTerm))
    )
  }, [movies, searchTerm])

  const selectedMovie =
    movies.find((movie) => movie.id === selectedMovieId) || null

  const selectedEpisode =
    episodes.find((episode) => episode.id === selectedEpisodeId) || null

  const handleEditMovie = (movie: Movie) => {
    setEditingMovieId(movie.id)
    setMovieForm({
      title: movie.title || '',
      cover_url: movie.cover_url || '',
      description: movie.description || '',
      status: movie.status || 'Đang ra',
      country: movie.country || 'Thái Lan',
      genres: movie.genres || '',
      director: movie.director || '',
      main_cast: movie.main_cast || '',
      release_year: movie.release_year
        ? String(movie.release_year)
        : String(new Date().getFullYear()),
      rating: movie.rating ? String(movie.rating) : '',
    })
    setWorkspaceView('movie-form')
  }

  const handleSaveMovie = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!movieForm.title.trim()) {
      toast.error('Tên phim không được để trống')
      return
    }

    setIsSavingMovie(true)
    const loadingToast = toast.loading(
      editingMovieId ? 'Đang cập nhật phim...' : 'Đang thêm phim...'
    )

    const payload = {
      title: movieForm.title.trim(),
      cover_url: movieForm.cover_url.trim() || null,
      description: movieForm.description.trim() || null,
      status: movieForm.status,
      country: movieForm.country.trim() || null,
      genres: movieForm.genres.trim() || null,
      director: movieForm.director.trim() || null,
      main_cast: movieForm.main_cast.trim() || null,
      release_year: movieForm.release_year ? Number(movieForm.release_year) : null,
      rating: movieForm.rating ? Number(movieForm.rating) : null,
    }

    if (editingMovieId) {
      const { error } = await supabase
        .from('movies')
        .update(payload)
        .eq('id', editingMovieId)

      if (error) {
        toast.error(error.message, { id: loadingToast })
        setIsSavingMovie(false)
        return
      }

      toast.success('Cập nhật phim thành công', { id: loadingToast })
    } else {
      const { data, error } = await supabase
        .from('movies')
        .insert([payload])
        .select('*')
        .single()

      if (error) {
        toast.error(error.message, { id: loadingToast })
        setIsSavingMovie(false)
        return
      }

      if (data?.id) {
        setSelectedMovieId(data.id)
      }

      toast.success('Thêm phim thành công', { id: loadingToast })
    }

    await fetchMovies()
    resetMovieForm()
    setWorkspaceView('dashboard')
    setIsSavingMovie(false)
  }

  const handleEditEpisode = (episode: Episode) => {
    setEditingEpisodeId(episode.id)
    setEpisodeForm({
      episode_number: String(episode.episode_number),
      title: episode.title || '',
    })
    setWorkspaceView('episode-form')
  }

  const handleSaveEpisode = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedMovieId) {
      toast.error('Hãy chọn phim trước')
      return
    }

    if (!episodeForm.episode_number) {
      toast.error('Vui lòng nhập số tập')
      return
    }

    const duplicate = episodes.find(
      (ep) =>
        ep.episode_number === Number(episodeForm.episode_number) &&
        ep.id !== editingEpisodeId
    )

    if (duplicate) {
      toast.error(`Tập ${episodeForm.episode_number} đã tồn tại`)
      return
    }

    setIsSavingEpisode(true)
    const loadingToast = toast.loading(
      editingEpisodeId ? 'Đang cập nhật tập...' : 'Đang thêm tập...'
    )

    const payload = {
      movie_id: selectedMovieId,
      episode_number: Number(episodeForm.episode_number),
      title: episodeForm.title.trim() || `Tập ${episodeForm.episode_number}`,
    }

    if (editingEpisodeId) {
      const { error } = await supabase
        .from('episodes')
        .update(payload)
        .eq('id', editingEpisodeId)

      if (error) {
        toast.error(error.message, { id: loadingToast })
        setIsSavingEpisode(false)
        return
      }

      toast.success('Cập nhật tập thành công', { id: loadingToast })
    } else {
      const { data, error } = await supabase
        .from('episodes')
        .insert([payload])
        .select('*')
        .single()

      if (error) {
        toast.error(error.message, { id: loadingToast })
        setIsSavingEpisode(false)
        return
      }

      if (data?.id) {
        setSelectedEpisodeId(data.id)
      }

      toast.success('Thêm tập thành công', { id: loadingToast })
    }

    await fetchEpisodes(selectedMovieId)
    resetEpisodeForm()
    setWorkspaceView('episode-form')
    setIsSavingEpisode(false)
  }

  const handleDeleteEpisode = async (episode: Episode) => {
    const ok = window.confirm(`Xóa tập ${episode.episode_number} và toàn bộ server?`)
    if (!ok) return

    const loadingToast = toast.loading('Đang xóa tập...')

    const { error } = await supabase.from('episodes').delete().eq('id', episode.id)

    if (error) {
      toast.error(error.message, { id: loadingToast })
      return
    }

    if (selectedEpisodeId === episode.id) {
      setSelectedEpisodeId('')
      setServers([])
      resetEpisodeForm()
      resetServerForm()
    }

    await fetchEpisodes(selectedMovieId)
    toast.success('Đã xóa tập', { id: loadingToast })
  }

  const handleEditServer = (server: EpisodeServer) => {
    setEditingServerId(server.id)
    setServerForm({
      name: server.name || '',
      provider: server.provider || 'direct',
      url: server.url || '',
      embed_url: server.embed_url || '',
      source_type: server.source_type || 'embed',
      sort_order: String(server.sort_order || 1),
      is_active: server.is_active,
      is_primary: server.is_primary,
      note: server.note || '',
    })
    setWorkspaceView('server-form')
  }

  const handleSaveServer = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedEpisodeId) {
      toast.error('Hãy chọn tập trước')
      return
    }

    if (!serverForm.url.trim()) {
      toast.error('URL server không được để trống')
      return
    }

    const normalizedUrl = processEmbedUrl(serverForm.url)
    const provider =
      serverForm.provider === 'auto'
        ? detectProvider(normalizedUrl)
        : serverForm.provider

    const payload = {
      episode_id: selectedEpisodeId,
      name: normalizeServerName(provider, serverForm.name),
      provider,
      url: normalizedUrl,
      embed_url: serverForm.embed_url.trim() || null,
      source_type: serverForm.source_type || 'embed',
      sort_order: Number(serverForm.sort_order || 1),
      is_active: serverForm.is_active,
      is_primary: serverForm.is_primary,
      note: serverForm.note.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const duplicateOrder = servers.find(
      (s) => s.sort_order === payload.sort_order && s.id !== editingServerId
    )

    if (duplicateOrder) {
      toast.error(`Thứ tự ${payload.sort_order} đã tồn tại`)
      return
    }

    setIsSavingServer(true)
    const loadingToast = toast.loading(
      editingServerId ? 'Đang cập nhật server...' : 'Đang thêm server...'
    )

    if (payload.is_primary) {
      const { error: resetError } = await supabase
        .from('episode_servers')
        .update({
          is_primary: false,
          updated_at: new Date().toISOString(),
        })
        .eq('episode_id', selectedEpisodeId)

      if (resetError) {
        toast.error(resetError.message, { id: loadingToast })
        setIsSavingServer(false)
        return
      }
    }

    if (editingServerId) {
      const { error } = await supabase
        .from('episode_servers')
        .update(payload)
        .eq('id', editingServerId)

      if (error) {
        toast.error(error.message, { id: loadingToast })
        setIsSavingServer(false)
        return
      }

      toast.success('Cập nhật server thành công', { id: loadingToast })
    } else {
      const { error } = await supabase.from('episode_servers').insert([
        {
          ...payload,
          created_at: new Date().toISOString(),
        },
      ])

      if (error) {
        toast.error(error.message, { id: loadingToast })
        setIsSavingServer(false)
        return
      }

      toast.success('Thêm server thành công', { id: loadingToast })
    }

    await fetchServers(selectedEpisodeId)
    resetServerForm()
    setWorkspaceView('server-form')
    setIsSavingServer(false)
  }

  const handleSetPrimaryServer = async (server: EpisodeServer) => {
    if (!selectedEpisodeId) return

    const loadingToast = toast.loading('Đang đặt server chính...')

    const { error: resetError } = await supabase
      .from('episode_servers')
      .update({
        is_primary: false,
        updated_at: new Date().toISOString(),
      })
      .eq('episode_id', selectedEpisodeId)

    if (resetError) {
      toast.error(resetError.message, { id: loadingToast })
      return
    }

    const { error } = await supabase
      .from('episode_servers')
      .update({
        is_primary: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', server.id)

    if (error) {
      toast.error(error.message, { id: loadingToast })
      return
    }

    await fetchServers(selectedEpisodeId)
    toast.success('Đã đổi server chính', { id: loadingToast })
  }

  const handleDeleteServer = async (server: EpisodeServer) => {
    const ok = window.confirm(`Xóa server "${server.name}"?`)
    if (!ok) return

    const loadingToast = toast.loading('Đang xóa server...')

    const { error } = await supabase
      .from('episode_servers')
      .delete()
      .eq('id', server.id)

    if (error) {
      toast.error(error.message, { id: loadingToast })
      return
    }

    await fetchServers(selectedEpisodeId)
    resetServerForm()
    toast.success('Đã xóa server', { id: loadingToast })
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-300 selection:bg-red-500/30">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#18181b',
            color: '#e4e4e7',
            border: '1px solid #27272a',
            fontSize: '13px',
          },
        }}
      />

      <div className="mx-auto max-w-[1700px] p-4 md:p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-4 h-fit">
            <AdminSidebar
              movies={filteredMovies}
              selectedMovieId={selectedMovieId}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onSelectMovie={(movie) => {
                setSelectedMovieId(movie.id)
                setWorkspaceView('dashboard')
              }}
              onCreateMovie={() => {
                resetMovieForm()
                setWorkspaceView('movie-form')
              }}
            />
          </div>

          <section className="min-h-[720px] rounded-3xl border border-zinc-800 bg-zinc-900/40 p-5 shadow-lg">
            <div className="mb-5 flex flex-wrap gap-2 border-b border-zinc-800 pb-4">
              <button
                onClick={() => setWorkspaceView('dashboard')}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                  workspaceView === 'dashboard'
                    ? 'bg-white text-black'
                    : 'border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                Dashboard
              </button>

              <button
                onClick={() => setWorkspaceView('movie-form')}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                  workspaceView === 'movie-form'
                    ? 'bg-white text-black'
                    : 'border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                Phim
              </button>

              <button
                onClick={() => setWorkspaceView('episode-form')}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                  workspaceView === 'episode-form'
                    ? 'bg-white text-black'
                    : 'border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                Tập
              </button>

              <button
                onClick={() => setWorkspaceView('server-form')}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                  workspaceView === 'server-form'
                    ? 'bg-white text-black'
                    : 'border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                Server
              </button>
            </div>

            {workspaceView === 'dashboard' && (
              <div>
                <h2 className="text-xl font-black text-white">Dashboard</h2>

                {isLoadingMovies ? (
                  <p className="mt-2 text-sm text-zinc-500">Đang tải dữ liệu phim...</p>
                ) : selectedMovie ? (
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-sm text-zinc-500">Tên phim</p>
                      <p className="text-lg font-bold text-white">{selectedMovie.title}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                        <p className="text-xs text-zinc-500">Quốc gia</p>
                        <p className="mt-1 font-bold text-white">
                          {selectedMovie.country || '---'}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                        <p className="text-xs text-zinc-500">Năm phát hành</p>
                        <p className="mt-1 font-bold text-white">
                          {selectedMovie.release_year || '---'}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                        <p className="text-xs text-zinc-500">Trạng thái</p>
                        <p className="mt-1 font-bold text-white">
                          {selectedMovie.status || '---'}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                        <p className="text-xs text-zinc-500">Rating</p>
                        <p className="mt-1 font-bold text-white">
                          {selectedMovie.rating || '---'}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                      <p className="text-xs text-zinc-500">Mô tả</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-300">
                        {selectedMovie.description || 'Chưa có mô tả'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        onClick={() => handleEditMovie(selectedMovie)}
                        className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-zinc-200"
                      >
                        Chỉnh sửa phim
                      </button>

                      <button
                        onClick={fetchMovies}
                        className="rounded-2xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-bold text-zinc-200 transition hover:bg-zinc-800"
                      >
                        Tải lại dữ liệu
                      </button>

                      <button
                        onClick={() => {
                          resetEpisodeForm()
                          if (selectedEpisodeId) {
                            fetchServers(selectedEpisodeId)
                          }
                          setWorkspaceView('episode-form')
                        }}
                        className="rounded-2xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-bold text-zinc-200 transition hover:bg-zinc-800"
                      >
                        Quản lý tập
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500">
                    Hãy chọn phim ở sidebar bên trái
                  </p>
                )}
              </div>
            )}

            {workspaceView === 'movie-form' && (
              <MovieForm
                form={movieForm}
                isSaving={isSavingMovie}
                editingMovieId={editingMovieId}
                onChange={setMovieForm}
                onSubmit={handleSaveMovie}
                onReset={resetMovieForm}
                onBack={() => setWorkspaceView('dashboard')}
              />
            )}

            {workspaceView === 'episode-form' && (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_320px_minmax(0,1fr)]">
                <EpisodeList
                  episodes={episodes}
                  selectedEpisodeId={selectedEpisodeId}
                  onSelectEpisode={(episode) => {
                    setSelectedEpisodeId(episode.id)
                  }}
                  onCreateEpisode={() => {
                    resetEpisodeForm()
                    setWorkspaceView('episode-form')
                  }}
                  onEditEpisode={handleEditEpisode}
                  onDeleteEpisode={handleDeleteEpisode}
                />

                <ServerList
                  servers={servers}
                  selectedEpisodeTitle={
                    selectedEpisode
                      ? `Tập ${selectedEpisode.episode_number} - ${selectedEpisode.title || ''}`
                      : 'Chưa chọn tập'
                  }
                  onCreateServer={() => {
                    resetServerForm()
                    setWorkspaceView('server-form')
                  }}
                  onEditServer={handleEditServer}
                  onSetPrimary={handleSetPrimaryServer}
                  onDeleteServer={handleDeleteServer}
                />

                <EpisodeForm
                  form={episodeForm}
                  editingEpisodeId={editingEpisodeId}
                  isSaving={isSavingEpisode}
                  selectedMovieTitle={selectedMovie?.title}
                  onChange={setEpisodeForm}
                  onSubmit={handleSaveEpisode}
                  onReset={resetEpisodeForm}
                  onBack={() => setWorkspaceView('dashboard')}
                />
              </div>
            )}

            {workspaceView === 'server-form' && (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_320px_minmax(0,1fr)]">
                <EpisodeList
                  episodes={episodes}
                  selectedEpisodeId={selectedEpisodeId}
                  onSelectEpisode={(episode) => {
                    setSelectedEpisodeId(episode.id)
                  }}
                  onCreateEpisode={() => {
                    resetEpisodeForm()
                    setWorkspaceView('episode-form')
                  }}
                  onEditEpisode={handleEditEpisode}
                  onDeleteEpisode={handleDeleteEpisode}
                />

                <ServerList
                  servers={servers}
                  selectedEpisodeTitle={
                    selectedEpisode
                      ? `Tập ${selectedEpisode.episode_number} - ${selectedEpisode.title || ''}`
                      : 'Chưa chọn tập'
                  }
                  onCreateServer={() => {
                    resetServerForm()
                    setWorkspaceView('server-form')
                  }}
                  onEditServer={handleEditServer}
                  onSetPrimary={handleSetPrimaryServer}
                  onDeleteServer={handleDeleteServer}
                />

                <ServerForm
                  form={serverForm}
                  editingServerId={editingServerId}
                  isSaving={isSavingServer}
                  selectedEpisodeTitle={
                    selectedEpisode
                      ? `Tập ${selectedEpisode.episode_number} - ${selectedEpisode.title || ''}`
                      : 'Chưa chọn tập'
                  }
                  onChange={setServerForm}
                  onSubmit={handleSaveServer}
                  onReset={resetServerForm}
                  onBack={() => setWorkspaceView('episode-form')}
                />
              </div>
            )}
          </section>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 999px; }
          `,
        }}
      />
    </main>
  )
}