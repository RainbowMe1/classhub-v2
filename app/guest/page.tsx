import { getClassSettings } from '@/lib/auth/settings-actions';
import GuestShell from '@/components/guest/GuestShell';

export default async function GuestPage() {
  const s = await getClassSettings();
  return <GuestShell settings={s} />;
}
