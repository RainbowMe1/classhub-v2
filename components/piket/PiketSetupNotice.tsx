import { AlertTriangle } from 'lucide-react';

export default function PiketSetupNotice() {
  return (
    <div role="alert" className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
        <div>
          <div className="font-semibold">Database bukti piket belum disiapkan</div>
          <p className="mt-1 leading-relaxed text-amber-100/80">
            Jadwal tetap dapat dilihat, tetapi pengiriman dan verifikasi bukti belum tersedia.
            Minta pengelola proyek menjalankan migrasi <code className="rounded bg-black/20 px-1">supabase/migrations/006_piket_evidence.sql</code>
            {' '}pada database Supabase, lalu muat ulang halaman.
          </p>
        </div>
      </div>
    </div>
  );
}
