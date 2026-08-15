'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveAISettings } from '@/lib/auth/ai-actions';
import { X, KeyRound } from 'lucide-react';

export default function AISettings({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save(fd: FormData) {
    setBusy(true);
    setErr('');
    const res = await saveAISettings(fd);
    setBusy(false);
    if (res && res.error) setErr(res.error);
    else {
      onClose();
      router.refresh();
    }
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50';

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={(e) => { e.preventDefault(); save(new FormData(e.currentTarget)); }}
        className="bg-card border border-line rounded-2xl p-5 w-full max-w-sm space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-acc" />
            Pengaturan AI
          </h3>
          <button type="button" onClick={onClose} className="p-2 text-mut hover:text-ink" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>
        {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}
        <div>
          <div className="text-xs text-mut mb-1">Gemini API Key (kosongkan biar tetap yang lama)</div>
          <input name="api_key" type="password" placeholder="AIza..." className={inputCls} />
        </div>
        <div>
          <div className="text-xs text-mut mb-1">Model</div>
          <input name="model" defaultValue="gemini-2.5-flash" className={inputCls} />
        </div>
        <button disabled={busy} className="w-full py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold disabled:opacity-50">
          {busy ? 'Menyimpan...' : 'Simpan'}
        </button>
        <p className="text-[11px] text-mut">Key disimpan di database & dipakai server-side. Gak pernah dikirim ke browser anggota.</p>
      </form>
    </div>
  );
}
