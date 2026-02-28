import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import PlayGroupButton from '@/components/PlayGroupButton'
import NovelActions from '@/components/NovelActions' // <-- Import mới

async function getNovelData(id: string) {
  const { error: rpcError } = await supabase.rpc('increment_views', { row_id: id });
  const { data: novel } = await supabase.from('novels').select('*').eq('id', id).single()
  const { data: chapters } = await supabase
    .from('chapters')
    .select('*')
    .eq('novel_id', id)
    .order('chapter_number', { ascending: true })

  return { novel, chapters }
}

export default async function NovelDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { novel, chapters } = await getNovelData(id)

  if (!novel) return <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-zinc-500 font-bold">Không tìm thấy thông tin truyện.</div>

  const groupedChapters = chapters?.reduce((acc: any, cap) => {
    const part = cap.part_name || 'Danh sách tập';
    if (!acc[part]) acc[part] = [];
    acc[part].push(cap);
    return acc;
  }, {}) || {};

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-200 pb-32 font-sans relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none opacity-20 blur-[120px]" style={{ backgroundImage: `radial-gradient(circle at 50% 20%, #f59e0b 0%, transparent 50%)` }}></div>

      <div className="max-w-6xl mx-auto px-4 py-8 relative z-10">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-zinc-500 hover:text-amber-500 transition-colors font-bold tracking-widest text-sm">
          ← TRỞ VỀ KHO TRUYỆN
        </Link>

        <div className="flex flex-col md:flex-row gap-10 mb-10">
          <div className="w-full md:w-72 shrink-0">
            <img src={novel.cover_url} className="w-full aspect-[2/3] object-cover rounded-[2.5rem] shadow-2xl shadow-amber-500/10 border border-zinc-800" alt={novel.title} />
          </div>
          
          <div className="flex-1 flex flex-col">
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="bg-amber-500 text-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{novel.status}</span>
              <span className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-zinc-700">{novel.perspective || 'Chủ thụ'}</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-2 text-white tracking-tighter leading-tight drop-shadow-lg">{novel.title}</h1>
            <p className="text-xl font-bold text-amber-500/80 mb-6">✍️ {novel.author}</p>

            <div className="flex flex-wrap gap-2 mb-6">
              {novel.genres?.split(',').filter((g:string) => g.trim()!=='').map((g: string, i: number) => (
                <span key={i} className="bg-zinc-900/80 border border-zinc-800 px-4 py-1.5 rounded-xl text-xs font-bold text-zinc-400">#{g.trim()}</span>
              ))}
            </div>

            <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 p-6 rounded-3xl text-zinc-400 leading-relaxed text-sm shadow-inner mb-8">
              <p className="whitespace-pre-wrap line-clamp-4 hover:line-clamp-none transition-all cursor-pointer">{novel.description || 'Truyện đang cập nhật mô tả...'}</p>
            </div>

            {/* PHẦN ĐIỀU KHIỂN THÔNG MINH: NGHE TỪ ĐẦU & NGHE TIẾP */}
            <NovelActions novel={novel} chapters={chapters} />
          </div>
        </div>

        {/* DANH SÁCH CHƯƠNG */}
        <div className="space-y-12 mt-16">
          {Object.entries(groupedChapters).map(([partName, caps]: any) => (
            <div key={partName} className="bg-zinc-900/20 p-6 rounded-[2rem] border border-zinc-800/40 shadow-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <h2 className="text-xl font-black flex items-center gap-4 text-white">
                  <span className="w-1.5 h-6 bg-gradient-to-b from-amber-400 to-orange-500 rounded-full"></span>
                  {partName}
                </h2>
                <PlayGroupButton chaptersToPlay={caps} novel={novel} label={`Nghe phần này`} isPrimary={false} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {caps.map((cap: any) => (
                  <Link href={`/truyen/${id}/${cap.id}`} key={cap.id} className="group bg-zinc-900/40 hover:bg-zinc-800/80 border border-zinc-800/50 hover:border-amber-500/50 p-5 rounded-2xl transition-all flex flex-col gap-3 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-amber-500/80 uppercase tracking-widest bg-amber-500/10 px-2 py-1 rounded-md">Tập {cap.chapter_number}</p>
                    </div>
                    <h4 className="font-bold text-zinc-300 group-hover:text-amber-400 transition-colors line-clamp-2 leading-snug text-base">{cap.title}</h4>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}