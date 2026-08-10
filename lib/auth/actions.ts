'use server';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
  if (!profile) return null;
  return { ...user, profile };
}

export async function requireUser() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.profile.is_banned) {
    await supabase.auth.signOut();
    redirect('/login');
  }
  return user;
}

export async function requireRole(role: string) {
  const user = await requireUser();
  if (role === 'teacher') {
    if (user.profile.role !== 'teacher' && user.profile.role !== 'admin') redirect('/dashboard');
  } else if (user.profile.role !== role) {
    redirect('/dashboard');
  }
  return user;
}
