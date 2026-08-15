'use client';
import { useEffect, useRef, useState } from 'react';
import { askAI } from '@/lib/auth/ai-actions';
import { Bot, Send, Trash2, Loader2, Settings2 } from 'lucide-react';
import AISettings from './AISettings';

type M = { role: 'user' | 'model'; text: string };

const LS_KEY = 'ch-ai-history';

export default function AIChat({ isAdmin, configured, model }: { isAdmin: boolean; configured: boolean; model: string }) {
  const [msgs, setMsgs] = useState<M[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showCfg, setShowCfg] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setMsgs(parsed);
      }
    } catch (e) {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(msgs.slice(-100)));
    } catch (e) {}
  }, [msgs, loaded]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, busy]);

  function clear() {
    setMsgs([]);
    try {
      localStorage.removeItem(LS_KEY);
    } catch (e) {}
  }

  async function send() {
    const t = text.trim();
    if (!t || busy) return;
    setErr('');
    const next = [...msgs, { role: 'user' as const, text: t }];
    setMsgs(next);
    setText('');
    setBusy(true);
    const res = await askAI(next.slice(-16));
    setBusy(false);
    if (res && res.error) setErr(res.error);
    else setMsgs([...next, { role: 'model' as const, text: res.text || '(tidak ada jawaban)' }]);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col" style={{ height: 'calc(100vh - 6rem)' }}>
      <div className="flex items-center justify-between pb-3">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6 text-acc" />
          AI Kelas
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-line text-mut font-normal">{model}</span>
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={clear} className="p-2 text-mut hover:text-ink rounded-lg hover:bg-line" aria-label="Bersihkan percakapan">
            <Trash2 className="h-4 w-4" />
          </button>
          {isAdmin && (
            <button onClick={() => setShowCfg(true)} className="p-2 text-mut hover:text-ink rounded-lg hover:bg-line" aria-label="Pengaturan AI">
              <Settings2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {!configured ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-mut space-y-2">
            <Bot className="h-12 w-12 mx-auto text-line-2" />
            <p className="text-sm">AI belum dikonfigurasi.</p>
            <p className="text-xs">{isAdmin ? 'Pencet ikon gerigi di kanan atas buat masukin Groq API key.' : 'Minta admin mengaktifkan fitur ini.'}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {msgs.length === 0 && !busy && (
              <div className="text-center py-16 text-mut">
                <Bot className="h-10 w-10 mx-auto mb-3 text-acc" />
                <p className="text-sm">Tanya apa aja — materi pelajaran, tugas, ide kegiatan kelas.</p>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={'flex ' + (m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={
                    'max-w-[85%] px-4 py-2.5 text-sm whitespace-pre-wrap break-words ' +
                    (m.role === 'user'
                      ? 'bg-acc text-acc-ink rounded-2xl rounded-br-md'
                      : 'bg-card border border-line rounded-2xl rounded-bl-md')
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-card border border-line text-sm text-mut flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mikir...
                </div>
              </div>
            )}
            {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{err}</div>}
            <div ref={endRef} />
          </div>
          <div className="shrink-0 pt-3 flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Tanya apa aja..."
              className="flex-1 px-4 py-3 rounded-xl bg-card border border-line text-sm text-ink focus:outline-none focus:border-acc/50"
            />
            <button onClick={send} disabled={busy || !text.trim()} className="p-3 rounded-xl bg-acc text-acc-ink disabled:opacity-50" aria-label="Kirim">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {showCfg && isAdmin && <AISettings onClose={() => setShowCfg(false)} />}
    </div>
  );
}
