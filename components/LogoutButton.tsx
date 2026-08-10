'use client';
import { useEffect, useRef, useState } from 'react';
import { logout } from '@/lib/auth/actions';
import { DoorOpen, Loader2 } from 'lucide-react';

export default function LogoutButton({ withLabel }: { withLabel?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function doLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await logout();
    } catch {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          withLabel
            ? 'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-mut hover:text-red-400 hover:bg-line transition'
            : 'p-2 text-mut hover:text-red-400'
        }
        aria-label="Keluar"
      >
        <DoorOpen className={withLabel ? 'h-4 w-4' : 'h-5 w-5'} />
        {withLabel && 'Keluar'}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4"
          onClick={() => { if (!busy) setOpen(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            className="bg-card border border-line rounded-2xl p-5 w-full max-w-sm space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 shrink-0">
                <DoorOpen className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 id="logout-title" className="font-semibold text-ink">Yakin ingin keluar?</h3>
                <p className="text-xs text-mut mt-1">Kamu akan keluar dari akun ini dan perlu login lagi buat masuk ke kelas.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                ref={cancelRef}
                onClick={() => setOpen(false)}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl bg-line text-ink text-sm font-semibold hover:bg-line-2 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={doLogout}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy ? 'Keluar...' : 'Keluar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
