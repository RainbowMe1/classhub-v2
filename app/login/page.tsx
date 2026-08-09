'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { LogIn, Eye, EyeOff, Loader2, Globe } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, is_banned')
        .eq('username', username.toLowerCase())
        .maybeSingle();
      if (!profile) { setError('Username tidak ditemukan'); setLoading(false); return; }
      if (profile.is_banned) { setError('Akun ini telah diblokir'); setLoading(false); return; }
      const { error } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password,
      });
      if (error) { setError('Password salah'); setLoading(false); return; }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-acc/10 border border-acc/30 mb-4">
            <LogIn className="h-6 w-6 text-acc" />
          </div>
          <h1 className="text-3xl font-bold text-grad">ClassHub</h1>
          <p className="text-mut text-sm mt-1">Masuk ke kelas kamu</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-line rounded-2xl p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              className="w-full px-4 py-3 rounded-xl bg-card-2 border border-line text-ink placeholder-mut focus:outline-none focus:border-acc/50 focus:ring-1 focus:ring-acc/30 transition"
              placeholder="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl bg-card-2 border border-line text-ink placeholder-mut focus:outline-none focus:border-acc/50 focus:ring-1 focus:ring-acc/30 transition pr-12"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-mut hover:text-ink"
                aria-label="Toggle password"
              >
                {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-acc text-acc-ink font-semibold hover:bg-acc-strong disabled:opacity-50 transition"
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
          <Link
            href="/"
            className="w-full py-3 rounded-xl bg-card-2 border border-line text-mut text-sm font-medium hover:text-ink flex items-center justify-center gap-2 transition"
          >
            <Globe className="h-4 w-4" />
            Lihat Portofolio Kelas
          </Link>
          <p className="text-center text-xs text-mut">Lupa password? Hubungi admin kelas kamu.</p>
        </form>
      </div>
    </div>
  );
}
