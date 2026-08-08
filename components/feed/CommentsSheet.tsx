'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, Send, Trash2 } from 'lucide-react';

export default function CommentsSheet({ postId, userId, onClose }: { postId: string; userId: string; onClose: () => void }) {
  const supabase = createClient();
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [err, setErr] = useState('');

  async function load() {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(username, full_name)')
      .eq('post_id', postId)
      .order('created_at');
    setComments(data ?? []);
  }

  useEffect(() => {
    load();
  }, [postId]);

  async function submit() {
    if (!text.trim()) return;
    setErr('');
    const { error } = await supabase.from('comments').insert({
      post_id: postId,
      user_id: userId,
      content: text.trim(),
      parent_id: replyTo ? replyTo.id : null,
    });
    if (error) { setErr('Gagal kirim: ' + error.message); return; }
    setText('');
    setReplyTo(null);
    load();
  }

  async function del(id: string) {
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (!error) load();
  }

  const top = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center">
      <div className="bg-[#0f0f0f] w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <h3 className="font-semibold text-white">Komentar</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {err && <div className="p-2 rounded-lg bg-red-500/10 text-red-400 text-xs">{err}</div>}
          {top.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">Belum ada komentar. Mulai diskusi!</p>
          ) : (
            top.map((c) => (
              <div key={c.id}>
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-[#3a3a3a] flex items-center justify-center text-xs font-bold shrink-0">
                    {(c.profiles?.full_name || 'U').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-[#161616] rounded-2xl rounded-tl-sm px-3 py-2">
                      <div className="text-xs font-semibold mb-0.5 text-white">{c.profiles?.full_name}</div>
                      <div className="text-sm whitespace-pre-wrap text-gray-200">{c.content}</div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 ml-2 text-xs text-gray-500">
                      <button onClick={() => setReplyTo(c)} className="hover:text-white">Balas</button>
                      {c.user_id === userId && (
                        <button onClick={() => del(c.id)} className="text-red-400 hover:text-red-300 flex items-center gap-1">
                          <Trash2 className="h-3 w-3" /> Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="ml-11 mt-2 space-y-2">
                  {repliesOf(c.id).map((r) => (
                    <div key={r.id} className="flex gap-3">
                      <div className="h-7 w-7 rounded-full bg-[#3a3a3a] flex items-center justify-center text-xs font-bold shrink-0">
                        {(r.profiles?.full_name || 'U').charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-[#161616] rounded-2xl rounded-tl-sm px-3 py-2">
                          <div className="text-xs font-semibold mb-0.5 text-white">{r.profiles?.full_name}</div>
                          <div className="text-sm whitespace-pre-wrap text-gray-200">{r.content}</div>
                        </div>
                        {r.user_id === userId && (
                          <div className="ml-2 mt-1">
                            <button onClick={() => del(r.id)} className="text-xs text-red-400">Hapus</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-3 border-t border-[#2a2a2a]">
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
              <span>Membalas {replyTo.profiles?.full_name}</span>
              <button onClick={() => setReplyTo(null)} className="text-gray-500 hover:text-white"><X className="h-3 w-3" /></button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Tulis komentar..."
              className="flex-1 px-4 py-2 rounded-full bg-[#161616] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50"
            />
            <button onClick={submit} disabled={!text.trim()} className="p-2 rounded-full bg-[#a3e635] text-[#0a0a0a] disabled:opacity-30" aria-label="Kirim">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
