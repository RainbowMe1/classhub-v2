import { requireRole } from '@/lib/auth/actions';
import { getPiketHistory } from '@/lib/piket-data';
import AppLayout from '@/components/layout/AppLayout';
import PiketHistory from '@/components/piket/PiketHistory';
import PiketSetupNotice from '@/components/piket/PiketSetupNotice';
import { Camera } from 'lucide-react';

export default async function AdminPiketPage() {
  const user = await requireRole('teacher');
  const rows = await getPiketHistory();

  return (
    <AppLayout profile={user.profile}>
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Camera className="h-6 w-6 text-acc" aria-hidden="true" />
            Verifikasi Bukti Piket
          </h1>
          <p className="mt-1 text-sm text-mut">Periksa foto, tinjau riwayat, lalu verifikasi atau tolak dengan alasan.</p>
        </div>
        {rows.setupRequired ? <PiketSetupNotice /> : <PiketHistory rows={rows.rows} canReview initialStatus="pending" />}
      </div>
    </AppLayout>
  );
}
