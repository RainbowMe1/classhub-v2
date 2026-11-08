'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Check, Eye, Loader2, Trash2, X } from 'lucide-react';
import { deletePiketEvidence, reviewPiketSubmission } from '@/lib/auth/piket-actions';
import { formatPiketDate, formatPiketDateTime } from '@/lib/piket-utils';
import type { PiketHistoryRow } from '@/lib/piket-data';

const STATUS_LABELS: Record<PiketHistoryRow['status'], string> = {
  pending: 'Menunggu Verifikasi',
  verified: 'Terverifikasi',
  rejected: 'Ditolak',
};

const STATUS_STYLES: Record<PiketHistoryRow['status'], string> = {
  pending: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  verified: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  rejected: 'border-red-400/20 bg-red-400/10 text-red-300',
};

export default function PiketHistory({
  rows,
  canReview,
  initialStatus = 'all',
}: {
  rows: PiketHistoryRow[];
  canReview: boolean;
  initialStatus?: 'all' | PiketHistoryRow['status'];
}) {
  const router = useRouter();
  const [dateFilter, setDateFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [previewRow, setPreviewRow] = useState<PiketHistoryRow | null>(null);

  useEffect(() => {
    if (canReview) return;
    const refreshVisiblePage = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const interval = window.setInterval(refreshVisiblePage, 30000);
    document.addEventListener('visibilitychange', refreshVisiblePage);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshVisiblePage);
    };
  }, [canReview, router]);

  useEffect(() => {
    if (!previewRow) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setPreviewRow(null);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [previewRow]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    return (!dateFilter || row.duty_date === dateFilter)
      && row.student_name.toLowerCase().includes(nameFilter.trim().toLowerCase())
      && row.group_label.toLowerCase().includes(groupFilter.trim().toLowerCase())
      && (statusFilter === 'all' || row.status === statusFilter);
  }), [dateFilter, groupFilter, nameFilter, rows, statusFilter]);

  async function review(row: PiketHistoryRow, status: 'verified' | 'rejected') {
    setBusyId(row.id);
    setError('');
    setNotice('');
    let result: Awaited<ReturnType<typeof reviewPiketSubmission>>;
    try {
      result = await reviewPiketSubmission(row.id, status, reasons[row.id] ?? '');
    } catch {
      setBusyId(null);
      setError('Status belum dapat diperbarui karena koneksi bermasalah. Coba lagi.');
      return;
    }
    setBusyId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function deleteEvidence(row: PiketHistoryRow) {
    if (!window.confirm(`Hapus foto bukti ${row.student_name}? Status akan ditolak dan siswa dapat mengirim ulang.`)) return;
    setBusyId(row.id);
    setError('');
    setNotice('');
    let result: Awaited<ReturnType<typeof deletePiketEvidence>>;
    try {
      result = await deletePiketEvidence(row.id, reasons[row.id] ?? '');
    } catch {
      setBusyId(null);
      setError('Foto belum dapat dihapus karena koneksi bermasalah. Coba lagi.');
      return;
    }
    setBusyId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.warning) setNotice(result.warning);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canReview && (
        <section className="grid gap-2 rounded-2xl border border-line bg-card p-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filter riwayat piket">
          <label className="space-y-1 text-xs text-mut">
            Tanggal piket
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-line bg-card-2 px-3 text-sm text-ink"
            />
          </label>
          <label className="space-y-1 text-xs text-mut">
            Nama siswa
            <input
              value={nameFilter}
              onChange={(event) => setNameFilter(event.target.value)}
              placeholder="Cari nama..."
              className="min-h-11 w-full rounded-xl border border-line bg-card-2 px-3 text-sm text-ink"
            />
          </label>
          <label className="space-y-1 text-xs text-mut">
            Kelompok
            <input
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
              placeholder="Cari kelompok..."
              className="min-h-11 w-full rounded-xl border border-line bg-card-2 px-3 text-sm text-ink"
            />
          </label>
          <label className="space-y-1 text-xs text-mut">
            Status
            <select
              value={statusFilter}
              onChange={(event) => {
                const value = event.target.value;
                if (value === 'all' || value === 'pending' || value === 'verified' || value === 'rejected') {
                  setStatusFilter(value);
                }
              }}
              className="min-h-11 w-full rounded-xl border border-line bg-card-2 px-3 text-sm text-ink"
            >
              <option value="all">Semua status</option>
              <option value="pending">Menunggu Verifikasi</option>
              <option value="verified">Terverifikasi</option>
              <option value="rejected">Ditolak</option>
            </select>
          </label>
        </section>
      )}

      {error && <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-200">{notice}</div>}
      {filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center text-sm text-mut">
          {rows.length
            ? canReview && statusFilter === 'pending'
              ? 'Belum ada bukti yang menunggu verifikasi. Bukti baru dari siswa akan muncul di sini.'
              : 'Tidak ada bukti yang sesuai dengan filter.'
            : 'Belum ada riwayat bukti piket.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRows.map((row) => (
            <article key={row.id} className="overflow-hidden rounded-2xl border border-line bg-card">
              <div className="grid sm:grid-cols-[minmax(0,240px)_1fr]">
                {row.evidence_url ? (
                  <button
                    type="button"
                    onClick={() => setPreviewRow(row)}
                    className="group relative block aspect-[4/3] w-full bg-black text-left sm:aspect-auto sm:min-h-52"
                    aria-label={'Perbesar foto bukti piket ' + row.student_name}
                  >
                    <Image
                      src={row.evidence_url}
                      alt={'Bukti piket ' + row.student_name}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 100vw, 240px"
                      className="object-cover"
                    />
                    <span className="absolute bottom-2 right-2 rounded-lg bg-black/70 p-2 text-white opacity-100 transition group-hover:bg-black">
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </button>
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-card-2 px-4 text-center text-sm text-mut sm:aspect-auto sm:min-h-52">
                    {row.status === 'rejected'
                      ? 'Foto dihapus. Kamu dapat mengirim ulang bukti pada hari piket.'
                      : 'Foto bukti sudah dihapus'}
                  </div>
                )}
                <div className="min-w-0 space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold">{row.student_name}</h2>
                      <div className="text-sm text-mut">{row.group_label} · {formatPiketDate(row.duty_date)}</div>
                    </div>
                    <span className={'rounded-full border px-2.5 py-1 text-xs font-semibold ' + STATUS_STYLES[row.status]}>
                      {STATUS_LABELS[row.status]}
                    </span>
                  </div>
                  <div className="text-xs text-mut">Dikirim {formatPiketDateTime(row.submitted_at)} WIB</div>
                  {row.rejection_reason && (
                    <div className="rounded-xl border border-red-400/15 bg-red-400/5 p-3 text-sm text-red-300">
                      Alasan penolakan: {row.rejection_reason}
                    </div>
                  )}
                  {canReview && row.evidence_url && (
                    <div className="space-y-2 border-t border-line pt-3">
                      <label className="block space-y-1 text-xs text-mut">
                        Alasan penolakan atau penghapusan foto
                        <textarea
                          value={reasons[row.id] ?? ''}
                          onChange={(event) => setReasons((current) => ({ ...current, [row.id]: event.target.value }))}
                          maxLength={500}
                          rows={2}
                          className="w-full resize-y rounded-xl border border-line bg-card-2 px-3 py-2 text-sm text-ink"
                          placeholder="Wajib diisi untuk menolak atau menghapus foto"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {row.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => review(row, 'verified')}
                              disabled={busyId === row.id}
                              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                            >
                              {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                              Verifikasi
                            </button>
                            <button
                              type="button"
                              onClick={() => review(row, 'rejected')}
                              disabled={busyId === row.id || !(reasons[row.id] ?? '').trim()}
                              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-4 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
                              Tolak Bukti
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteEvidence(row)}
                          disabled={busyId === row.id || !(reasons[row.id] ?? '').trim()}
                          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-400/20 px-4 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                        >
                          {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                          Hapus Foto & Izinkan Kirim Ulang
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {previewRow?.evidence_url && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setPreviewRow(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={'Foto bukti piket ' + previewRow.student_name}
            className="relative flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-card shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{previewRow.student_name}</div>
                <div className="text-xs text-mut">{previewRow.group_label} · {formatPiketDate(previewRow.duty_date)}</div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewRow(null)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-mut transition hover:bg-line hover:text-ink"
                aria-label="Tutup foto"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="relative min-h-0 flex-1 bg-black">
              <Image
                src={previewRow.evidence_url}
                alt={'Foto bukti piket ' + previewRow.student_name}
                width={1600}
                height={1200}
                unoptimized
                className="mx-auto max-h-[calc(92dvh-80px)] w-full object-contain"
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
