import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import BirthdayPage from '@/components/BirthdayPage';

export default async function UltahRoute() {
  const user = await requireUser();
  return (
    <AppLayout profile={user.profile}>
      <BirthdayPage />
    </AppLayout>
  );
}
