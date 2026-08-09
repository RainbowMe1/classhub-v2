'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Send, Loader2, MessageCircle, Image as ImageIcon, X } from 'lucide-react';
import Lightbox from '@/components/feed/Lightbox';

type Msg = {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  created_at: string;
};

export default function ChatRoom({ userId, initial, names }: { userId: string; initial: Msg[]; names: Record<string, string> }) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const channel = supabase
      .channel('chat-room')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload: any) => {
          const row = payload.new as Msg;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    if ((!text.trim() && !pendingFile) || sending) return;
    setSending(true);
    setErr('');
    try {
      let media_url: string | null = null;
      if (pendingFile) {
        if (!pendingFile.type.startsWith('image/')) { setErr('Hanya file gambar.'); setSending(false); return; }
        if (pendingFile.size > 10 * 1024 * 1024) { setErr('Foto maksimal 10MB.'); setSending(false); return; }
        const id = crypto.randomUUID();
        const ext = pendingFile.name.split('.').pop() || 'jpg';
        const path = userId + '/' + id + '.' + ext;
        const { error: upErr } = await supabase.storage.from('chat').upload(path, pendingFile, { upsert: true });
        if (upErr) { setErr('Upload gagal: ' + upErr.message); setSending(false); return; }
        media_url = supabase.storage.from('chat').getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from('chat_messages').insert({
        user_id: userId,
        content: text.trim() || null,
        media_url,
        media_type: media_url ? 'image' : null,
      });
      if (error) { setErr('Gagal kirim: ' + error.message); setSending(false); return; }
      setText('');
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch {
      setErr('Terjadi kesalahan.');
    }
    setSending(false);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl flex flex-col h-[calc(100vh-140px)]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2a2a2a]">
          <MessageCircle className="h-5 w-5 text-[#a3e635]" />
          <div>
            <div className="font-semibold text-white text-sm">Chat Kelas</div>
            <div className="text-xs text-gray-500">Realtime • semua anggota</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-8">Belum ada pesan. Sapa kelas lu!</p>
          )}
          {messages.map((m) => {
            const own = m.user_id === userId;
            return (
              <div key={m.id} className={'flex ' + (own ? 'justify-end' : 'justify-start')}>
                <div
                  className={
                    'max-w-[75%] rounded-2xl px-3 py-2 ' +
                    (own ? 'bg-[#a3e635] text-[#0a0a0a] rounded-br-sm' : 'bg-[#0f0f0f] border border-[#2a2a2a] rounded-bl-sm')
                  }
                >
                  {!own && (
                    <div className="text-xs font-semibold mb-0.5 text-[#a3e635]">
                      {names[m.user_id] || 'Warga Kelas'}
                    </div>
                  )}
                  {m.media_url && (
                    <button onClick={() => setLightbox(m.media_url)} className="block mb-1 rounded-xl overflow-hidden" aria-label="Lihat foto">
                      <img src={m.media_url} alt="" loading="lazy" className="max-h-64 w-full object-contain rounded-xl" />
                    </button>
                  )}
                  {m.content && <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>}
                  <div className={'text-[10px] mt-1 ' + (own ? 'text-[#0a0a0a]/60' : 'text-gray-500')}>
                    {new Date(m.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <div className="p-3 border-t border-[#2a2a2a]">
          {err && <div className="text-xs text-red-400 mb-2">{err}</div>}
          {pendingFile && (
            <div className="flex items-center gap-2 mb-2 text-xs text-gray-300">
              <ImageIcon className="h-4 w-4 text-[#a3e635]" />
              <span className="truncate">{pendingFile.name}</span>
              <button onClick={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="text-gray-500 hover:text-white" aria-label="Hapus foto">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="p-2.5 rounded-full bg-[#0f0f0f] border border-[#2a2a2a] text-gray-400 hover:text-white"
              aria-label="Kirim foto"
            >
              <ImageIcon className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setPendingFile(e.target.files?.[0] || null)}
            />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Tulis pesan..."
              className="flex-1 px-4 py-2.5 rounded-full bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50"
            />
            <button
              onClick={send}
              disabled={!text.trim() && !pendingFile ? true : sending}
              className="p-2.5 rounded-full bg-[#a3e635] text-[#0a0a0a] disabled:opacity-30"
              aria-label="Kirim pesan"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {lightbox && <Lightbox urls={[lightbox]} index={0} onClose={() => setLightbox(null)} />}
    </div>
  );
}
