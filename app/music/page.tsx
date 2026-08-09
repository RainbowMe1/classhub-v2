import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import MusicRoom from '@/components/music/MusicRoom';

export default async function MusicPage() {
  const user = await requireUser();
  return (
    <AppLayout profile={user.profile}>
      <MusicRoom userId={user.id} isStaff={user.profile.role !== 'student'} />
    </AppLayout>
  );
}
