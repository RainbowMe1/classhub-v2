'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import PostEditor from '@/components/PostEditor';
import { ArrowLeft, Loader2, X } from 'lucide-react';

export default function NewPostPage() {
  const supabase = createClient();
  const router = useRouter();
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [queue, setQueue] = useState<File[]>([]);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [myCount, setMyCount] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
      setMyCount(count ?? 0);
    })();
  }, []);

  useEffect(() => {
    if (!editFile && queue.length > 0) setEditFile(queue[0]);
  }, [queue, editFile]);

  function addFile(f: File) {
    setFiles((p) => [...p, f].slice(0, 4));
    setPreviews((p) => [...p, URL.createObjectURL(f)].slice(0, 4));
  }

  function onPick(list: FileList) {
    setErr('');
    const imgs: File[] = [];
    for (const f of Array.from(list)) {
      if (f.type.startsWith('image/')) {
        imgs.push(f);
      } else if (f.type.startsWith('video/')) {
        if (f.size > 20 * 1024 * 1024) { setErr('Video maksimal 20MB.'); continue; }
        addFile(f);
      }
    }
    if (imgs.length > 0) setQueue((q) => [...q, ...imgs]);
  }

  async function submit() {
    if (!content.trim() && files.length === 0) { setErr('Isi sesuatu atau pilih media.'); return; }
    setBusy(true);
    setErr('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErr('Login dulu.'); setBusy(false); return; }
    const { count } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    if ((count ?? 0) >= 8) {
      setErr('Limit 8 postingan tercapai. Hapus yang lama di menu Postinganku dulu.');
      setBusy(false);
      return;
    }
    const postId = crypto.randomUUID();
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = f.name.split('.').pop() || 'jpg';
      const path = user.id + '/' + postId + '/' + i + '.' + ext;
      const { error: upErr } = await supabase.storage.from('posts').upload(path, f, { upsert: true });
      if (upErr) { setErr('Upload gagal: ' + upErr.message); setBusy(false); return; }
      urls.push(supabase.storage.from('posts').getPublicUrl(path).data.publicUrl);
    }
    const type = urls.length === 0 ? null : files[0].type.startsWith('video/') ? 'video' : 'image';
    const { error } = await supabase.from('posts').insert({
      user_id: user.id,
      content: content.trim() || null,
      media_urls: urls,
      media_type: type,
    });
    if (error) { setErr(error.message); setBusy(false); return; }
    router.push('/feed');
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur border-b border-line">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 h-14">
          <Link href="/feed" className="p-2 text-mut hover:text-ink" aria-label="Kembali">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-semibold">Posting Baru</h1>
          {myCount !== null && (
            <span className="ml-auto text-xs text-mut">
              Postingan: <span className="font-bold text-acc">{myCount}/8</span>
            </span>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {err && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder="Apa yang mau kamu bagikan?"
          className="w-full px-4 py-3 rounded-xl bg-card border border-line text-sm focus:outline-none focus:border-acc/50 resize-none"
        />
        {previews.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {previews.map((p, i) => (
              <div key={i} className="relative shrink-0">
                <img src={p} alt="" className="h-24 w-24 rounded-xl object-cover border border-line" />
                <button
                  onClick={() => {
                    setFiles((f) => f.filter((_, j) => j !== i));
                    setPreviews((f) => f.filter((_, j) => j !== i));
                  }}
                  className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-ink"
                  aria-label="Hapus media"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full py-3 rounded-xl bg-card border border-line text-sm text-mut hover:text-ink"
        >
          + Tambah Foto/Video (foto bisa diedit dulu biar pas)
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onPick(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          onClick={submit}
          disabled={busy}
          className="w-full py-3 rounded-xl bg-acc text-acc-ink font-semibold hover:bg-acc-strong disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? 'Mengunggah...' : 'Terbitkan'}
        </button>
      </main>

      {editFile && (
        <PostEditor
          file={editFile}
          onClose={() => {
            setQueue((q) => q.slice(1));
            setEditFile(null);
          }}
          onDone={(f: File) => {
            addFile(f);
            setQueue((q) => q.slice(1));
            setEditFile(null);
          }}
        />
      )}
    </div>
  );
}
