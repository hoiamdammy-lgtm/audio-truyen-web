'use client'

import { useState, useEffect, DragEvent } from 'react'
import { supabase } from '@/lib/supabase'
import toast, { Toaster } from 'react-hot-toast'

const removeAccents = (str: string) => {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, '');
}

// HÀM CHỐNG SPAM TELEGRAM (Tạm dừng X giây)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function UltimateAdmin() {
  const [activeTab, setActiveTab] = useState('manage') 
  
  const [novels, setNovels] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPerspective, setFilterPerspective] = useState('')
  const [filterGenre, setFilterGenre] = useState('')

  const [isNovelModalOpen, setIsNovelModalOpen] = useState(false)
  const [viewingNovel, setViewingNovel] = useState<any>(null) 
  const [novelChapters, setNovelChapters] = useState<any[]>([])
  const [isLoadingChapters, setIsLoadingChapters] = useState(false)
  const [chapterSearchTerm, setChapterSearchTerm] = useState('') 

  const [editingNovel, setEditingNovel] = useState<any>(null)
  const [novelForm, setNovelForm] = useState({ 
    title: '', author: '', cover_url: '', description: '', 
    status: 'Đang ra', perspective: 'Chủ thụ', genres: '' 
  })
  const [coverFile, setCoverFile] = useState<File | null>(null)

  // STATES UPLOAD NÂNG CẤP
  const [selectedNovelId, setSelectedNovelId] = useState('')
  const [uploadQueue, setUploadQueue] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragging, setIsDragging] = useState(false) 
  const [existingChapterNumbers, setExistingChapterNumbers] = useState<number[]>([]) // Chứa các tập đã up

  useEffect(() => {
    fetchNovels()
  }, [])

  // RADAR: Tự động quét các tập đã có khi chọn Truyện ở tab Đăng File
  useEffect(() => {
    if (activeTab === 'upload' && selectedNovelId) {
      const fetchExisting = async () => {
        const { data } = await supabase.from('chapters').select('chapter_number').eq('novel_id', selectedNovelId);
        if (data) setExistingChapterNumbers(data.map(d => d.chapter_number));
      }
      fetchExisting();
    } else {
      setExistingChapterNumbers([]);
    }
  }, [selectedNovelId, activeTab])

  const fetchNovels = async () => {
    const { data } = await supabase.from('novels').select('*').order('created_at', { ascending: false })
    if (data) setNovels(data)
  }

  const filteredNovels = novels.filter(n => {
    const searchNormalized = removeAccents(searchTerm);
    const matchSearch = removeAccents(n.title).includes(searchNormalized) || removeAccents(n.author).includes(searchNormalized);
    const matchPerspective = filterPerspective ? n.perspective === filterPerspective : true;
    const matchGenre = filterGenre ? removeAccents(n.genres || '').includes(removeAccents(filterGenre)) : true;
    return matchSearch && matchPerspective && matchGenre;
  })

  const filteredChapters = novelChapters.filter(c => 
    removeAccents(c.title).includes(removeAccents(chapterSearchTerm)) || 
    c.chapter_number.toString().includes(chapterSearchTerm)
  );

  const handleViewChapters = async (novel: any) => {
    setViewingNovel(novel)
    setChapterSearchTerm('') 
    setIsLoadingChapters(true)
    const { data, error } = await supabase.from('chapters').select('*').eq('novel_id', novel.id).order('chapter_number', { ascending: true })
    if (error) toast.error("Lỗi tải chương: " + error.message)
    else setNovelChapters(data || [])
    setIsLoadingChapters(false)
  }

  const handleDeleteChapter = async (id: string, title: string) => {
    if (!window.confirm(`Xóa vĩnh viễn [${title}]?`)) return
    const { error } = await supabase.from('chapters').delete().eq('id', id)
    if (error) toast.error("Lỗi xóa: " + error.message)
    else {
      toast.success("Đã xóa chương!")
      setNovelChapters(novelChapters.filter(c => c.id !== id))
      // Cập nhật lại radar nếu đang ở tab Upload
      setExistingChapterNumbers(prev => prev.filter(num => num !== novelChapters.find(c => c.id === id)?.chapter_number))
    }
  }

  const handleDeleteNovel = async (id: string, title: string, coverUrl: string) => {
    if (!window.confirm(`Xóa truyện "${title}" sẽ mất TOÀN BỘ CHƯƠNG thuộc truyện này. Bạn có chắc chắn không?`)) return;
    const loadingToast = toast.loading("Đang xóa truyện...");
    
    if (coverUrl && coverUrl.includes('supabase.co')) {
      try {
        const urlObj = new URL(coverUrl);
        const pathParts = urlObj.pathname.split('/');
        const fileName = pathParts[pathParts.length - 1]; 
        await supabase.storage.from('covers').remove([fileName]);
      } catch (e) { console.log("Không thể xóa ảnh bìa:", e); }
    }

    await supabase.from('chapters').delete().eq('novel_id', id);
    const { error } = await supabase.from('novels').delete().eq('id', id);
    
    if (error) { toast.error("Lỗi xóa truyện: " + error.message, { id: loadingToast }); } 
    else { toast.success("Đã xóa hoàn toàn truyện!", { id: loadingToast }); fetchNovels(); }
  }

  const handleSaveNovel = async (e: React.FormEvent) => {
    e.preventDefault()
    const loadingToast = toast.loading("Đang lưu dữ liệu...")
    let finalCoverUrl = novelForm.cover_url;

    if (coverFile) {
      toast.loading("Đang tải ảnh bìa lên...", { id: loadingToast })
      const fileExt = coverFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('covers').upload(fileName, coverFile);
      if (uploadError) { toast.error("Lỗi tải ảnh: " + uploadError.message, { id: loadingToast }); return; }
      const { data: publicUrlData } = supabase.storage.from('covers').getPublicUrl(fileName);
      finalCoverUrl = publicUrlData.publicUrl;
    }

    if (!finalCoverUrl) { toast.error("Thiếu ảnh bìa!", { id: loadingToast }); return; }

    const dataToSave = { ...novelForm, cover_url: finalCoverUrl };

    if (editingNovel) {
      const { error } = await supabase.from('novels').update(dataToSave).eq('id', editingNovel.id)
      if (error) toast.error(error.message, { id: loadingToast })
      else toast.success("Cập nhật thành công!", { id: loadingToast })
    } else {
      const { error } = await supabase.from('novels').insert([dataToSave])
      if (error) toast.error(error.message, { id: loadingToast })
      else toast.success("Thêm truyện thành công!", { id: loadingToast })
    }
    
    closeNovelModal();
    fetchNovels();
  }

  const openAddModal = () => {
    setEditingNovel(null);
    setNovelForm({ title: '', author: '', cover_url: '', description: '', status: 'Đang ra', perspective: 'Chủ thụ', genres: '' });
    setCoverFile(null);
    setIsNovelModalOpen(true);
  }

  const openEditModal = (novel: any) => {
    setEditingNovel(novel); 
    setNovelForm({ ...novel, genres: novel.genres || '', perspective: novel.perspective || 'Chủ thụ' }); 
    setCoverFile(null);
    setIsNovelModalOpen(true);
  }

  const closeNovelModal = () => {
    setIsNovelModalOpen(false);
    setTimeout(() => setEditingNovel(null), 200);
  }

  const handleGenresChange = (e: React.ChangeEvent<HTMLInputElement>) => { setNovelForm({ ...novelForm, genres: e.target.value }); }
  const formatGenresOnBlur = () => {
    const parsed = (novelForm.genres || '').split(/[-–,|/]+/).map(t => t.trim().charAt(0).toUpperCase() + t.trim().slice(1)).filter(t => t.length > 0).join(', ');
    setNovelForm({ ...novelForm, genres: parsed });
  }

  // LOGIC PHÂN TÍCH FILE THÔNG MINH
  const processFiles = async (files: File[]) => {
    if (!selectedNovelId) { toast.error("Vui lòng chọn truyện trước khi thả file!"); return; }

    // Tìm số tập lớn nhất để nối tiếp
    let startChapterNumber = 1;
    if (existingChapterNumbers.length > 0) {
      startChapterNumber = Math.max(...existingChapterNumbers) + 1;
    }

    setUploadQueue(prevQueue => {
      let newQueue = [...prevQueue];
      files.forEach(file => {
        const extension = file.name.split('.').pop()?.toLowerCase();
        const baseName = file.name.replace(/\.[^/.]+$/, ""); 
        
        const existingItemIndex = newQueue.findIndex(item => item.title === baseName);
        if (existingItemIndex >= 0) {
          if (extension === 'mp3' || extension === 'm4a') newQueue[existingItemIndex].audioFile = file;
          if (extension === 'txt') newQueue[existingItemIndex].textFile = file;
        } else {
          // Bóc tách số tập từ tên file (Ví dụ: "Chuong 05" -> 5)
          const numMatch = baseName.match(/\d+/);
          let predictedChapterNumber = numMatch ? parseInt(numMatch[0]) : null;

          newQueue.push({
            id: Math.random().toString(36).substring(7),
            audioFile: (extension === 'mp3' || extension === 'm4a') ? file : undefined,
            textFile: extension === 'txt' ? file : undefined,
            title: baseName, 
            status: 'pending', 
            progress: 0,
            predictedNumber: predictedChapterNumber // Lưu tạm số dự đoán
          });
        }
      });
      
      newQueue.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
      
      return newQueue.map((item, index) => {
        // Nếu file có chứa số, dùng số đó. Nếu không, dùng số nối tiếp.
        const finalChapterNumber = item.predictedNumber || (startChapterNumber + index);
        return { 
          ...item, 
          chapterNumber: finalChapterNumber,
          isDuplicate: existingChapterNumbers.includes(finalChapterNumber) // Cảnh báo nếu trùng
        }
      });
    });
    toast.success("Đã nạp file thành công!");
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) processFiles(Array.from(e.target.files)); e.target.value = ''; }
  const handleDrop = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) processFiles(Array.from(e.dataTransfer.files)); }

  const uploadToTelegram = async (botToken: string, chatId: string, file: File, caption: string, type: 'audio' | 'document') => {
    const formData = new FormData();
    formData.append('chat_id', chatId); formData.append(type, file); formData.append('caption', caption);
    const endpoint = type === 'audio' ? 'sendAudio' : 'sendDocument';
    const res = await fetch(`https://api.telegram.org/bot${botToken}/${endpoint}`, { method: 'POST', body: formData });
    const tgData = await res.json();
    if (!tgData.ok) {
      if(tgData.error_code === 429) throw new Error("Telegram chặn do up quá nhanh. Hãy chờ 1 phút.");
      throw new Error(tgData.description || "Lỗi Telegram");
    }
    return `tg://${type === 'audio' ? tgData.result.audio.file_id : tgData.result.document.file_id}`;
  }

  const startBulkUpload = async () => {
    if (!selectedNovelId) return toast.error("Chưa chọn truyện!")
    if (uploadQueue.length === 0) return toast.error("Hàng chờ trống!")
    
    // Cảnh báo nếu có tập trùng lặp
    const hasDuplicates = uploadQueue.some(item => existingChapterNumbers.includes(Number(item.chapterNumber)) && item.status !== 'success');
    if (hasDuplicates) {
      if (!window.confirm("CẢNH BÁO: Có một số tập bị TRÙNG SỐ với dữ liệu đã có. Hệ thống sẽ ghi đè nội dung mới. Bạn muốn tiếp tục?")) return;
    }
    
    setIsProcessing(true); let successCount = 0;
    const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN; const chatId = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;
    if (!botToken || !chatId) { setIsProcessing(false); return toast.error("Thiếu Token!"); }

    const selectedNovel = novels.find(n => n.id === selectedNovelId);
    if(!selectedNovel) { setIsProcessing(false); return toast.error("Truyện không tồn tại!"); }

    try {
      toast.success("Bắt đầu đẩy lên Server (Tốc độ an toàn)...");
      for (let i = 0; i < uploadQueue.length; i++) {
        const item = uploadQueue[i]; if (item.status === 'success') continue;
        
        updateQueueItem(item.id, { status: 'uploading', progress: 20 })
        try {
          const caption = `[${selectedNovel.title}] - Tập ${item.chapterNumber}: ${item.title}`;
          let audioUrl = null;
          let textUrl = null;

          if (item.audioFile) {
            audioUrl = await uploadToTelegram(botToken, chatId, item.audioFile, caption, 'audio');
            await delay(1000); // Nghỉ 1s giữa file audio và file text
          }
          updateQueueItem(item.id, { progress: 60 })
          
          if (item.textFile) {
            textUrl = await uploadToTelegram(botToken, chatId, item.textFile, `${caption} (Text)`, 'document');
          }
          updateQueueItem(item.id, { progress: 80 })

          // Upsert: Nếu trùng số chương thì ghi đè (onConflict)
          const { error } = await supabase.from('chapters').upsert({
            novel_id: selectedNovelId, 
            chapter_number: Number(item.chapterNumber),
            title: item.title, 
            audio_url: audioUrl || undefined, // undefined để không xóa link cũ nếu ko upload đè
            text_url: textUrl || undefined
          }, { onConflict: 'novel_id, chapter_number' })

          if (error) throw error
          
          updateQueueItem(item.id, { status: 'success', progress: 100 }); 
          successCount++;
          setExistingChapterNumbers(prev => [...prev, Number(item.chapterNumber)]); // Cập nhật radar
          
          // HỆ THỐNG CHỐNG BLOCK: Nghỉ ngơi 2.5 GIÂY TRƯỚC KHI UP TẬP TIẾP THEO
          if (i < uploadQueue.length - 1) {
            await delay(2500); 
          }

        } catch (err: any) { 
          updateQueueItem(item.id, { status: 'error', progress: 0 }); 
          toast.error(`Lỗi Tập ${item.chapterNumber}: ${err.message}`);
          // Nếu bị 429 Too Many Requests, buộc dừng vòng lặp
          if (err.message.includes('429') || err.message.includes('quá nhanh')) break;
        }
      }
    } finally { setIsProcessing(false); if (successCount > 0) toast.success(`Đã đăng thành công ${successCount} chương!`); }
  }

  const updateQueueItem = (id: string, data: any) => setUploadQueue(prev => prev.map(item => item.id === id ? { ...item, ...data } : item))
  const removeFileFromQueue = (id: string) => setUploadQueue(prev => prev.filter(item => item.id !== id))
  const clearSuccessFiles = () => setUploadQueue(prev => prev.filter(item => item.status !== 'success'))

  // Xử lý đổi số tập thủ công, cập nhật luôn trạng thái trùng
  const handleChapterNumberChange = (id: string, newVal: string) => {
    const num = Number(newVal);
    updateQueueItem(id, { 
      chapterNumber: num, 
      isDuplicate: existingChapterNumbers.includes(num) 
    });
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-200 font-sans selection:bg-cyan-500/30">
      <Toaster position="top-right" toastOptions={{ style: { background: '#18181b', color: '#e4e4e7', border: '1px solid #27272a' } }} />
      
      <nav className="bg-[#09090b]/90 backdrop-blur-xl border-b border-zinc-800/80 p-4 sticky top-0 z-40 shadow-2xl">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 tracking-tight flex items-center gap-2">
            <span className="text-2xl drop-shadow-md">⚙️</span> TRẠM ĐIỀU KHIỂN
          </h1>
          <div className="flex gap-2 bg-zinc-900/80 p-1.5 rounded-2xl border border-zinc-800/50 backdrop-blur-md">
            <button onClick={() => setActiveTab('manage')} className={`px-6 py-2 rounded-xl font-bold transition-all duration-300 text-sm ${activeTab === 'manage' ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/25' : 'hover:bg-zinc-800 text-zinc-400'}`}>
              📚 Kho Truyện ({novels.length})
            </button>
            <button onClick={() => setActiveTab('upload')} className={`px-6 py-2 rounded-xl font-bold transition-all duration-300 text-sm ${activeTab === 'upload' ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25' : 'hover:bg-zinc-800 text-zinc-400'}`}>
              🚀 Đăng File
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto p-4 md:p-6 mt-2">
        {/* --- TAB KHO TRUYỆN --- */}
        {activeTab === 'manage' && (
          <div className="animate-fade-in space-y-6">
            <div className="bg-zinc-900/50 p-5 rounded-[2rem] border border-zinc-800 shadow-xl flex flex-col lg:flex-row gap-4 justify-between items-center z-10 relative">
              <div className="flex w-full lg:w-auto gap-3">
                <button onClick={openAddModal} className="w-full lg:w-auto bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white px-8 py-3.5 rounded-2xl font-black tracking-wide shadow-lg shadow-cyan-500/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                  <span className="text-xl">+</span> TẠO MỚI
                </button>
              </div>

              <div className="flex w-full lg:flex-1 gap-3 flex-col sm:flex-row">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50">🏷️</span>
                  <input type="text" placeholder="Lọc Thể loại (vd: Đam mỹ...)" value={filterGenre} onChange={(e) => setFilterGenre(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500 pl-11 p-3.5 rounded-xl outline-none transition-colors text-sm font-medium" />
                </div>
                <select value={filterPerspective} onChange={(e) => setFilterPerspective(e.target.value)} className="w-full sm:w-48 bg-zinc-950 border border-zinc-800 focus:border-blue-500 p-3.5 rounded-xl outline-none font-bold text-cyan-400 cursor-pointer text-sm">
                  <option value="">Tất cả góc nhìn</option>
                  <option value="Chủ thụ">Chủ thụ</option>
                  <option value="Chủ công">Chủ công</option>
                  <option value="Hỗ công">Hỗ công</option>
                  <option value="Vô CP">Vô CP</option>
                  <option value="Ngôi thứ ba">Ngôi thứ ba</option>
                </select>
                <div className="relative w-full sm:w-72">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50">🔍</span>
                  <input type="text" placeholder="Tìm kiếm truyện..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500 pl-11 p-3.5 rounded-xl outline-none transition-colors text-sm" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredNovels.length === 0 ? (
                <div className="col-span-full py-20 text-center text-zinc-600 flex flex-col items-center">
                  <span className="text-6xl mb-4 opacity-30">📭</span>
                  <p className="text-xl font-bold">Trống rỗng...</p>
                </div>
              ) : (
                filteredNovels.map(novel => (
                  <div key={novel.id} className="bg-zinc-900/40 p-4 rounded-3xl border border-zinc-800/80 shadow-lg flex flex-col group hover:border-cyan-500/30 transition-all duration-300">
                    <div className="flex gap-4 mb-4">
                      <div className="relative shrink-0">
                        <img src={novel.cover_url} className="w-24 h-36 object-cover rounded-2xl shadow-md border border-zinc-700" alt="cover" onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/150x200?text=No+Cover' }} />
                        <span className={`absolute -bottom-2 -right-2 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border shadow-lg ${novel.status === 'Hoàn thành' ? 'bg-emerald-500 text-emerald-50 border-emerald-400' : 'bg-blue-600 text-blue-50 border-blue-400'}`}>
                          {novel.status}
                        </span>
                      </div>
                      <div className="flex-1 overflow-hidden flex flex-col">
                        <h3 className="font-black text-lg leading-tight mb-1 text-zinc-200 group-hover:text-cyan-400 transition-colors line-clamp-2" title={novel.title}>{novel.title}</h3>
                        <p className="text-sm text-zinc-500 font-medium truncate mb-2">✍️ {novel.author}</p>
                        <div className="mb-2">
                          <span className="inline-block bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] uppercase font-bold px-2 py-1 rounded-md">👁️ {novel.perspective || 'Chưa phân loại'}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-auto">
                          {novel.genres ? novel.genres.split(',').slice(0, 3).map((tag: string, i: number) => (
                            <span key={i} className="bg-zinc-800 text-zinc-400 text-[9px] px-2 py-1 rounded truncate max-w-[80px] border border-zinc-700/50" title={tag.trim()}>#{tag.trim()}</span>
                          )) : <span className="text-xs text-zinc-600 italic">Chưa có thể loại</span>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 pt-4 border-t border-zinc-800/80 mt-auto">
                      <button onClick={() => handleViewChapters(novel)} className="flex-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 p-2.5 rounded-xl font-bold text-sm transition-colors border border-cyan-500/20 flex items-center justify-center gap-2">
                        📖 Xem Chương
                      </button>
                      <button onClick={() => openEditModal(novel)} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-2.5 px-4 rounded-xl transition-colors font-bold text-sm" title="Sửa thông tin">Sửa</button>
                      <button onClick={() => handleDeleteNovel(novel.id, novel.title, novel.cover_url)} className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white p-2.5 px-3 rounded-xl transition-colors font-bold text-sm" title="Xóa Truyện">🗑️</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* --- TAB UPLOAD --- */}
        {activeTab === 'upload' && (
          <div className="animate-fade-in space-y-6">
            <div className="flex flex-col md:flex-row items-center gap-4 bg-zinc-900/50 p-5 rounded-3xl border border-zinc-800 shadow-lg relative overflow-hidden">
              {/* Radar Effect background */}
              <div className="absolute inset-0 bg-blue-500/5 opacity-50 blur-xl pointer-events-none"></div>
              
              <h2 className="text-xl font-bold border-l-4 border-blue-500 pl-4 whitespace-nowrap hidden md:block">Chọn Đích Đến</h2>
              <div className="flex-1 w-full relative z-10 flex items-center gap-4">
                <select value={selectedNovelId} onChange={e => setSelectedNovelId(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold transition-all hover:border-zinc-500 cursor-pointer text-blue-400 shadow-inner">
                  <option value="" className="text-zinc-600">-- Vui lòng chọn truyện trước khi đăng file --</option>
                  {novels.map(n => <option key={n.id} value={n.id} className="text-zinc-200">[{n.status}] {n.title}</option>)}
                </select>
                
                {/* Thông báo Radar Quét */}
                {selectedNovelId && (
                   <div className="hidden sm:flex flex-col items-center bg-zinc-950 border border-zinc-800 px-4 py-2 rounded-xl shrink-0">
                     <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Đã up lên web</span>
                     <span className="text-lg font-black text-amber-500">{existingChapterNumbers.length} <span className="text-sm text-zinc-600">tập</span></span>
                   </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }} onDrop={handleDrop} className={`lg:col-span-1 border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center transition-all duration-300 relative h-[500px] group ${isDragging ? 'border-blue-500 bg-blue-500/10 scale-[1.02]' : 'border-zinc-700 bg-zinc-900/30 hover:border-blue-500 hover:bg-zinc-900/60'}`}>
                <input type="file" multiple accept=".mp3,.m4a,.txt" onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                <div className={`transform transition-transform duration-300 ${isDragging ? 'scale-110 -translate-y-2' : 'group-hover:-translate-y-2'}`}><span className="text-7xl drop-shadow-2xl">📥</span></div>
                <h3 className="text-2xl font-black mt-6 mb-2 text-center text-zinc-200">Kéo & Thả File</h3>
                <p className="text-zinc-500 text-center leading-relaxed text-sm px-4">Tự bắt cặp <strong className="text-blue-400">Audio</strong> / <strong className="text-emerald-400">Text</strong>.<br/>Có Radar chống up trùng.</p>
              </div>

              <div className="lg:col-span-2 bg-zinc-900/30 rounded-3xl p-6 border border-zinc-800 shadow-xl min-h-[500px] flex flex-col">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-zinc-800/80 pb-4">
                  <div><h3 className="font-black text-xl text-zinc-200">Hàng Chờ Đăng</h3><p className="text-sm text-zinc-500 font-medium">Sẵn sàng: {uploadQueue.length} tập</p></div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    {uploadQueue.length > 0 && (
                      <>
                        <button onClick={clearSuccessFiles} disabled={isProcessing} className="px-4 py-2.5 rounded-xl font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition border border-emerald-500/20 disabled:opacity-50">Dọn đồ đã Up</button>
                        <button onClick={() => setUploadQueue([])} disabled={isProcessing} className="px-4 py-2.5 rounded-xl font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 transition disabled:opacity-50">Xóa hết</button>
                        <button onClick={startBulkUpload} disabled={isProcessing} className="flex-1 sm:flex-none bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 px-8 py-2.5 rounded-xl font-black shadow-lg shadow-blue-500/25 transition-all active:scale-95 disabled:opacity-50 text-white">{isProcessing ? '⏳ ĐANG UP (CHỐNG SPAM)...' : '🚀 BẮT ĐẦU ĐĂNG'}</button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-[600px] custom-scrollbar">
                  {uploadQueue.map((item) => (
                      <div key={item.id} className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center gap-4 transition-colors ${item.isDuplicate ? 'bg-red-500/5 border-red-500/30' : 'bg-zinc-950/50 border-zinc-800/50 hover:border-zinc-700'}`}>
                        <div className="flex-1 w-full">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex flex-col relative">
                              <span className={`text-[10px] font-bold uppercase mb-1 ${item.isDuplicate ? 'text-red-400' : 'text-zinc-500'}`}>Tập</span>
                              <input type="number" value={item.chapterNumber} onChange={e => handleChapterNumberChange(item.id, e.target.value)} className={`w-16 bg-zinc-900 font-black p-1.5 rounded-lg text-center outline-none border ${item.isDuplicate ? 'text-red-400 border-red-500/50 focus:border-red-400' : 'text-cyan-400 border-zinc-800 focus:border-cyan-500'}`} />
                            </div>
                            
                            <div className="flex-1 flex flex-col">
                              <span className="text-[10px] text-zinc-500 font-bold uppercase mb-1 flex justify-between">
                                Tên Tập
                                {item.isDuplicate && <span className="text-red-400 animate-pulse">⚠️ Sẽ bị ghi đè!</span>}
                              </span>
                              <input value={item.title} onChange={e => updateQueueItem(item.id, { title: e.target.value })} className={`w-full bg-transparent font-bold outline-none border-b-2 pb-1 ${item.isDuplicate ? 'text-red-200 border-red-500/30 focus:border-red-400' : 'text-zinc-200 border-zinc-800 focus:border-cyan-500'}`} />
                            </div>

                            <div className="flex gap-2 text-[10px] font-black uppercase mt-4">
                               {item.audioFile ? <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1.5 rounded-md">🔊 Audio</span> : <span className="bg-zinc-900 text-zinc-600 border border-zinc-800 px-2.5 py-1.5 rounded-md">Trống</span>}
                               {item.textFile ? <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1.5 rounded-md">📝 Text</span> : <span className="bg-zinc-900 text-zinc-600 border border-zinc-800 px-2.5 py-1.5 rounded-md">Trống</span>}
                            </div>
                          </div>
                          
                          <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-800">
                            <div className={`h-full transition-all duration-500 ${item.status === 'error' ? 'bg-red-500' : item.status === 'success' ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-cyan-400'}`} style={{ width: `${item.progress}%` }}></div>
                          </div>
                        </div>
                        
                        <div className="flex sm:flex-col items-center justify-center w-full sm:w-20 gap-2 pt-3 sm:pt-0 sm:pl-3 border-t sm:border-t-0 sm:border-l border-zinc-800/50">
                          {item.status === 'success' ? <span className="text-emerald-400 font-black text-sm">XONG</span> : item.status === 'error' ? <span className="text-red-400 font-black text-sm">LỖI</span> : item.status === 'uploading' ? <span className="text-cyan-400 font-black text-sm animate-pulse">{item.progress}%</span> : <button onClick={() => removeFileFromQueue(item.id)} className="text-zinc-400 hover:text-red-400 text-sm font-bold bg-zinc-900 border border-zinc-800 hover:border-red-500/30 px-3 py-1.5 rounded-lg w-full transition-colors">Xóa</button>}
                        </div>
                      </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- CÁC MODAL --- */}
      {isNovelModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col my-auto mt-10 mb-10">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/30 rounded-t-3xl">
              <h2 className="text-2xl font-black text-cyan-400">{editingNovel ? '✏️ Chỉnh Sửa Truyện' : '✨ Khởi Tạo Truyện Mới'}</h2>
              <button onClick={closeNovelModal} className="text-zinc-500 hover:bg-red-500/20 hover:text-red-400 w-10 h-10 rounded-xl font-bold transition-colors text-xl">✕</button>
            </div>
            
            <form onSubmit={handleSaveNovel} className="p-6 space-y-5 overflow-y-auto custom-scrollbar max-h-[75vh]">
              <div><label className="text-xs font-bold uppercase text-zinc-500 mb-2 block">Tên truyện</label><input required value={novelForm.title} onChange={e => setNovelForm({...novelForm, title: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 focus:border-cyan-500 p-3.5 rounded-xl outline-none font-medium" placeholder="Nhập tên truyện..." /></div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div><label className="text-xs font-bold uppercase text-zinc-500 mb-2 block">Tác giả</label><input value={novelForm.author} onChange={e => setNovelForm({...novelForm, author: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 focus:border-cyan-500 p-3.5 rounded-xl outline-none font-medium" /></div>
                <div><label className="text-xs font-bold uppercase text-zinc-500 mb-2 block">Tình trạng</label><select value={novelForm.status} onChange={e => setNovelForm({...novelForm, status: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 focus:border-cyan-500 p-3.5 rounded-xl outline-none font-bold text-cyan-400 cursor-pointer"><option value="Đang ra">Đang ra</option><option value="Hoàn thành">Hoàn thành</option><option value="Tạm ngưng">Tạm ngưng</option></select></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/10">
                <div className="sm:col-span-1">
                  <label className="text-xs font-bold uppercase text-indigo-400 mb-2 block">👁️ Góc Nhìn</label>
                  <select value={novelForm.perspective || 'Chủ thụ'} onChange={e => setNovelForm({...novelForm, perspective: e.target.value})} className="w-full bg-zinc-950 border border-indigo-500/20 focus:border-indigo-500 p-3.5 rounded-xl outline-none font-bold text-indigo-300 cursor-pointer">
                    <option value="Chủ thụ">Chủ thụ</option>
                    <option value="Chủ công">Chủ công</option>
                    <option value="Hỗ công">Hỗ công</option>
                    <option value="Vô CP">Vô CP</option>
                    <option value="Ngôi thứ ba">Ngôi thứ ba</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold uppercase text-indigo-400 mb-2 flex justify-between"><span>🏷️ Thể loại (Tự tách thẻ)</span></label>
                  <input value={novelForm.genres || ''} onChange={handleGenresChange} onBlur={formatGenresOnBlur} className="w-full bg-zinc-950 border border-indigo-500/20 focus:border-indigo-500 p-3.5 rounded-xl outline-none font-medium text-sm" placeholder="Dán cụm từ vào đây: Đam Mỹ - Tương Lai..." />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(novelForm.genres || '').split(',').filter(t => t.trim() !== '').map((tag, i) => (
                      <span key={i} className="bg-indigo-500/10 text-indigo-300 text-[10px] font-bold px-2 py-1 rounded border border-indigo-500/20">{tag.trim()}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-zinc-500 mb-2 block">Ảnh Bìa</label>
                <div className="flex gap-4 items-center">
                  {(coverFile || novelForm.cover_url) ? (
                    <img src={coverFile ? URL.createObjectURL(coverFile) : novelForm.cover_url} className="h-28 w-20 object-cover rounded-xl border border-zinc-700 shadow-xl shrink-0" onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/150?text=Lỗi' }}/>
                  ) : <div className="h-28 w-20 bg-zinc-900 rounded-xl border border-dashed border-zinc-700 flex items-center justify-center shrink-0 text-2xl opacity-50">🖼️</div>}
                  <div className="flex-1 space-y-3">
                    <input type="file" accept="image/*" onChange={(e) => { if (e.target.files && e.target.files[0]) { setCoverFile(e.target.files[0]); setNovelForm({...novelForm, cover_url: ''}); } }} className="w-full text-sm file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-cyan-500/10 file:text-cyan-400 hover:file:bg-cyan-500/20 text-zinc-400 cursor-pointer" />
                    <input type="text" value={novelForm.cover_url} onChange={e => { setNovelForm({...novelForm, cover_url: e.target.value}); setCoverFile(null); }} className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl outline-none text-xs" placeholder="Hoặc dán link ảnh..." />
                  </div>
                </div>
              </div>

              <div><label className="text-xs font-bold uppercase text-zinc-500 mb-2 block">Mô tả tóm tắt</label><textarea rows={4} value={novelForm.description} onChange={e => setNovelForm({...novelForm, description: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 p-3.5 rounded-xl outline-none custom-scrollbar text-sm" /></div>
              
              <div className="pt-4 flex gap-3">
                <button type="submit" className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 py-4 rounded-xl font-black text-lg shadow-lg shadow-cyan-500/20 text-white">{editingNovel ? 'LƯU THAY ĐỔI' : 'TẠO TRUYỆN MỚI'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingNovel && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-10 animate-fade-in">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-4xl max-h-full rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b border-zinc-800 flex flex-col sm:flex-row sm:justify-between items-start sm:items-center bg-zinc-900/30 gap-4">
              <div>
                <h2 className="text-2xl font-black text-cyan-400 line-clamp-1">📖 {viewingNovel.title}</h2>
                <p className="text-zinc-500 text-sm mt-1">Tổng cộng: <strong className="text-zinc-200">{novelChapters.length}</strong> chương</p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50 text-sm">🔍</span>
                  <input type="text" placeholder="Tìm tập..." value={chapterSearchTerm} onChange={(e) => setChapterSearchTerm(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 focus:border-cyan-500 pl-9 p-2 rounded-xl outline-none transition-colors text-sm" />
                </div>
                <button onClick={() => setViewingNovel(null)} className="bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 w-10 h-10 rounded-xl font-bold transition-colors text-xl shrink-0">✕</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-[#09090b] custom-scrollbar">
              {isLoadingChapters ? <div className="text-center py-10 text-zinc-600 font-bold animate-pulse">⏳ Đang tải vũ trụ chương...</div> : 
               novelChapters.length === 0 ? <div className="text-center py-10 text-zinc-600 italic">Chưa có chương nào được đăng.</div> : 
               filteredChapters.length === 0 ? <div className="text-center py-10 text-zinc-600 italic">Không tìm thấy tập phù hợp.</div> :
               (<div className="space-y-3">
                 {filteredChapters.map(chapter => (
                   <div key={chapter.id} className="bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col md:flex-row justify-between gap-4 items-center transition-colors">
                     <div className="flex-1 w-full">
                       <div className="flex items-center gap-3 mb-1"><span className="bg-zinc-800 text-cyan-400 font-black text-xs px-2 py-1 rounded border border-zinc-700">Tập {chapter.chapter_number}</span></div>
                       <h4 className="font-bold text-zinc-200 text-lg">{chapter.title}</h4>
                     </div>
                     <button onClick={() => handleDeleteChapter(chapter.id, chapter.title)} className="w-full md:w-auto text-sm bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20 px-4 py-2.5 rounded-xl font-bold transition-colors whitespace-nowrap">🗑️ Xóa Tập</button>
                   </div>
                 ))}
               </div>)}
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }
        .animate-fade-in { animation: fadeIn 0.2s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}} />
    </main>
  )
}