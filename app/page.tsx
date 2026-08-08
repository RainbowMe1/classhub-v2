import { getUser } from '@/lib/auth/actions';
import { redirect } from 'next/navigation';

export default async function Home() {
  const user = await getUser();
  if (user) redirect('/dashboard');
  redirect('/login');
}
