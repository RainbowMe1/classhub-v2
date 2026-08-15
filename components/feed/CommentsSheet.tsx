'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { deleteCommentAdmin } from '@/lib/auth/moderation-actions';
import { X, Send, Trash2 } from 'lucide-react';

export default function CommentsSheet({ postId, userId, onClose, postOwnerId, actorName, isStaff }: any) {
  const supabase = createClient();
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<any>(null);
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
    const target = replyTo ? replyTo.user_id : postOwnerId;
    if (target && target !== userId) {
      await supabase.from('notifications').insert({
        user_id: target,
        type: 'comment',
        title: actorName + (replyTo ? ' membalas komentarmu' : ' mengomentari postinganmu'),
        actor_id: userId,
        target_type: 'post',
        target_id: postId,
      });
    }
    setText('');
    setReplyTo(null);
    load();
  }

  async function del(id: string, ownerId: string) {
    if (ownerId === userId) {
      const { error } = await supabase.from('comments').delete().eq('id', id);
      if (!error) load();
    } else {
      const res = await deleteCommentAdmin(id);
      if (res && res.error) setErr('Gagal hapus: ' + res.error);
      else load();
    }
  }

  const top = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-end md:items-center justify-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="bg-card border border-line rounded-t-2xl md:rounded-2xl w-full md:max-w-md max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 pt-2 pb-3 px-4 border-b border-line">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line-2 md:hidden" />
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-ink">Komentar</h3>
            <button onClick={onClose} className="p-2 text-mut hover:text-ink rounded-lg hover:bg-line" aria-label="Tutup komentar">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{err}</div>}
          {top.length === 0 ? (
            <div className="text-center py-10 text-mut text-sm">Belum ada komentar. Mulai diskusi!</div>
          ) : (
            top.map((c) => (
              <div key={c.id} className="space-y-2">
                <div className="flex items-start gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-line-2 flex items-center justify-center text-xs font-bold text-ink shrink-0">
                    {(c.profiles?.full_name || 'U').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-ink">{c.profiles?.full_name}</div>
                    <p className="text-sm whitespace-pre-wrap break-words">{c.content}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <button onClick={() => setReplyTo(c)} className="text-xs text-mut hover:text-ink">Balas</button>
                      {(c.user_id === userId || isStaff) && (
                        <button onClick={() => del(c.id, c.user_id)} className="text-xs text-red-400 hover:text-red-300 inline-flex items-center gap-1">
                          <Trash2 className="h-3 w-3" />
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {repliesOf(c.id).map((r) => (
                  <div key={r.id} className="flex items-start gap-2.5 pl-8">
                    <div className="h-7 w-7 rounded-full bg-line-2 flex items-center justify-center text-[10px] font-bold text-ink shrink-0">
                      {(r.profiles?.full_name || 'U').charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-ink">{r.profiles?.full_name}</div>
                      <p className="text-sm whitespace-pre-wrap break-words">{r.content}</p>
                      {(r.user_id === userId || isStaff) && (
                        <button onClick={() => del(r.id, r.user_id)} className="text-xs text-red-400 mt-0.5">Hapus</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="shrink-0 border-t border-line p-3 space-y-2">
          {replyTo && (
            <div className="flex items-center justify-between text-xs text-mut">
              <span>Membalas {replyTo.profiles?.full_name}</span>
              <button onClick={() => setReplyTo(null)} className="hover:text-ink" aria-label="Batal membalas">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Tulis komentar..."
              className="flex-1 px-4 py-2.5 rounded-full bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50"
            />
            <button onClick={submit} className="p-2.5 rounded-full bg-acc text-acc-ink shrink-0" aria-label="Kirim komentar">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
