import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('fileId');
  const type = searchParams.get('type') || 'audio';

  if (!fileId) return new NextResponse('Thiếu fileId', { status: 400 });

  const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN; 
  if (!botToken) return new NextResponse('Chưa cấu hình Bot Token', { status: 500 });

  try {
    // 1. Lấy link thực tế từ Telegram
    const getFileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    const data = await getFileRes.json();
    
    if (!data.ok) return new NextResponse('Không tìm thấy file trên Telegram', { status: 404 });

    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;

    // 2. Tải luồng dữ liệu (stream) từ Telegram
    const fileStreamRes = await fetch(fileUrl);
    if (!fileStreamRes.ok) return new NextResponse('Lỗi khi tải file', { status: 500 });

    // 3. Trả dữ liệu về trình duyệt kèm Header cho phép CORS (Quan trọng nhất)
    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', '*'); // Cho phép mọi trình duyệt lấy để vẽ sóng nhạc
    headers.set('Cache-Control', 'public, max-age=31536000'); // Lưu cache 1 năm cho mượt
    
    if (type === 'text') {
      headers.set('Content-Type', 'text/plain; charset=utf-8');
      const text = await fileStreamRes.text();
      return new NextResponse(text, { headers });
    }

    // Nếu là Audio: Trả stream data thay vì redirect
    headers.set('Content-Type', fileStreamRes.headers.get('content-type') || 'audio/mpeg');
    headers.set('Content-Length', fileStreamRes.headers.get('content-length') || '');
    headers.set('Accept-Ranges', 'bytes');

    return new NextResponse(fileStreamRes.body, { headers });
    
  } catch (e) {
    return new NextResponse('Lỗi máy chủ nội bộ', { status: 500 });
  }
}