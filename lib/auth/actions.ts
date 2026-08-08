'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function login(formData: { username: string; password: string }) {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, is_banned')
    .eq('username', formData.username.toLowerCase())
    .maybeSingle();
  if (!profile) return { error: 'Username tidak ditemukan' };
  if (profile.is_banned) return { error: 'Akun diblokir' };
  const { error } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: formData.password,
  });
  if (error) return { error: 'Password salah' };
  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile || profile.is_banned) return null;
  return { ...user, profile };
}

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireRole(role: 'admin' | 'teacher') {
  const user = await requireUser();
  if (role === 'admin' && user.profile.role !== 'admin') redirect('/dashboard');
  if (role === 'teacher' && user.profile.role === 'student') redirect('/dashboard');
  return user;
}
