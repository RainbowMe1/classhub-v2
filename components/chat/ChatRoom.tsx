'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Send, Loader2, MessageCircle } from 'lucide-react';

type Msg = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export default function ChatRoom({ userId, initial, names }: { userId: string; initial: Msg[]; names: Record<string, string> }) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

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
    if (!text.trim() || sending) return;
    setSending(true);
    setErr('');
    const { error } = await supabase.from('chat_messages').insert({
      user_id: userId,
      content: text.trim(),
    });
    if (error) setErr('Gagal kirim: ' + error.message);
    setText('');
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
                  <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
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
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Tulis pesan..."
              className="flex-1 px-4 py-2.5 rounded-full bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50"
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              className="p-2.5 rounded-full bg-[#a3e635] text-[#0a0a0a] disabled:opacity-30"
              aria-label="Kirim pesan"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
