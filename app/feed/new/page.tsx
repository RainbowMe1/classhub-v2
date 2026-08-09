'use client';
import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Image as ImageIcon, X, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewPostPage() {
  const router = useRouter();
  const supabase = createClient();
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFiles(list: FileList | null) {
    if (!list) return;
    setError('');
    const next = [...files];
    const nextPrev = [...previews];
    for (const f of Array.from(list)) {
      if (!f.type.startsWith('image/')) { setError('Hanya file gambar yang diizinkan.'); continue; }
      if (f.size > 5 * 1024 * 1024) { setError('Maksimal 5MB per gambar.'); continue; }
      if (next.length >= 5) { setError('Maksimal 5 foto per postingan.'); break; }
      next.push(f);
      nextPrev.push(URL.createObjectURL(f));
    }
    setFiles(next);
    setPreviews(nextPrev);
  }

  function removeFile(idx: number) {
    setFiles((p) => p.filter((_, i) => i !== idx));
    setPreviews((p) => p.filter((_, i) => i !== idx));
  }

  async function publish() {
    if (!content.trim() && files.length === 0) { setError('Tulis sesuatu atau tambah foto.'); return; }
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const postId = crypto.randomUUID();
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const ext = files[i].name.split('.').pop() || 'jpg';
        const path = user.id + '/' + postId + '/image-' + i + '.' + ext;
        const { error: upErr } = await supabase.storage.from('posts').upload(path, files[i]);
        if (upErr) { setError('Upload gagal: ' + upErr.message); setLoading(false); return; }
        const { data: pub } = supabase.storage.from('posts').getPublicUrl(path);
        urls.push(pub.publicUrl);
      }
      const { error: dbErr } = await supabase.from('posts').insert({
        user_id: user.id,
        content: content.trim() || null,
        media_urls: urls,
        media_type: urls.length > 0 ? 'image' : 'none',
      });
      if (dbErr) { setError('Gagal simpan post: ' + dbErr.message); setLoading(false); return; }
      router.push('/feed');
      router.refresh();
    } catch {
      setError('Terjadi kesalahan tak terduga.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur border-b border-line">
        <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto">
          <Link href="/feed" className="flex items-center gap-2 text-mut hover:text-ink">
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm">Kembali</span>
          </Link>
          <button
            onClick={publish}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Posting
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm break-all">{error}</div>}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Apa yang terjadi di kelas hari ini?"
          rows={5}
          className="w-full p-4 rounded-2xl bg-card border border-line text-ink placeholder-mut focus:outline-none focus:border-acc/50 resize-none"
        />
        {previews.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {previews.map((p, i) => (
              <div key={i} className="relative">
                <img src={p} alt="" className="rounded-xl w-full h-28 object-cover border border-line" />
                <button
                  onClick={() => removeFile(i)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-ink"
                  aria-label="Hapus foto"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-card border border-line text-sm text-ink-soft hover:border-acc/50 w-full"
        >
          <ImageIcon className="h-5 w-5 text-acc" />
          Tambah foto (maks 5, maks 5MB/foto)
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => pickFiles(e.target.files)} />
      </main>
    </div>
  );
}
