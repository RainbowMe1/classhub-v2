import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import CheckInPage from '@/components/CheckInPage';

export default async function CheckInRoute() {
  const user = await requireUser();
  return (
    <AppLayout profile={user.profile}>
      <CheckInPage />
    </AppLayout>
  );
}
