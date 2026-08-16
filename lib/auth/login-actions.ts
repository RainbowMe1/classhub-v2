'use server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
  const username = String(formData.get('username') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  if (!username || !password) return { error: 'Username dan password wajib diisi.' };

  const admin = createAdminClient();
  const { data: prof } = await admin
    .from('profiles')
    .select('email, is_banned')
    .eq('username', username)
    .maybeSingle();
  if (!prof) return { error: 'Username atau password salah.' };
  if (prof.is_banned) return { error: 'Akun kamu diblokir. Hubungi admin kelas.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: prof.email, password });
  if (error) return { error: 'Username atau password salah.' };

  redirect('/dashboard');
}
