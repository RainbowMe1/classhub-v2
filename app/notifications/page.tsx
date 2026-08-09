import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import NotificationsClient from '@/components/notifications/NotificationsClient';

export default async function NotificationsPage() {
  const user = await requireUser();
  return (
    <AppLayout profile={user.profile}>
      <NotificationsClient userId={user.id} />
    </AppLayout>
  );
}
