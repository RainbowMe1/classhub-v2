import { requireUser } from '@/lib/auth/actions';
import { getPiketHistory } from '@/lib/piket-data';
import AppLayout from '@/components/layout/AppLayout';
import PiketHistory from '@/components/piket/PiketHistory';
import PiketSetupNotice from '@/components/piket/PiketSetupNotice';
import { History } from 'lucide-react';
import Link from 'next/link';

export default async function PiketHistoryPage() {
  const user = await requireUser();
  const canReview = user.profile.role === 'admin' || user.profile.role === 'teacher';
  const rows = await getPiketHistory(canReview ? undefined : user.id);

  return (
    <AppLayout profile={user.profile}>
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold">
                <History className="h-6 w-6 text-acc" aria-hidden="true" />
                Riwayat Piket
              </h1>
              <p className="mt-1 text-sm text-mut">
                {canReview ? 'Riwayat bukti piket seluruh kelas.' : 'Riwayat bukti piket yang sudah kamu kirim.'}
              </p>
            </div>
            {canReview && (
              <Link
                href="/admin/piket"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-acc px-4 py-2 text-sm font-bold text-acc-ink transition hover:bg-acc-strong"
              >
                Buka Bukti untuk Diverifikasi
              </Link>
            )}
          </div>
        </div>
        {rows.setupRequired ? <PiketSetupNotice /> : <PiketHistory rows={rows.rows} canReview={canReview} />}
      </div>
    </AppLayout>
  );
}
