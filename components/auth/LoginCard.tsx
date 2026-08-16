'use client';
import { useState } from 'react';
import { login } from '@/lib/auth/login-actions';
import Link from 'next/link';
import { Eye, EyeOff, User, Lock, LogIn, Eye as GuestIcon, Globe, Loader2 } from 'lucide-react';

export default function LoginCard() {
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setErr('');
    try {
      const fd = new FormData(e.currentTarget);
      const res: any = await login(fd);
      if (res && res.error) setErr(res.error);
    } catch (e2: any) {}
    setPending(false);
  }

  const inputWrap = 'flex items-center gap-2 px-3 rounded-xl bg-card-2 border border-line focus-within:border-acc/60 transition';
  const inputCls = 'flex-1 bg-transparent py-2.5 text-sm text-ink focus:outline-none';

  return (
    <div className="w-full bg-card/80 backdrop-blur-xl border border-line rounded-3xl p-6 md:p-7 shadow-2xl space-y-4 anim-fade-up">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-mut">Username</label>
          <div className={inputWrap + ' mt-1'}>
            <User className="h-4 w-4 text-mut shrink-0" />
            <input name="username" required placeholder="@username" className={inputCls} />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-mut">Password</label>
          <div className={inputWrap + ' mt-1'}>
            <Lock className="h-4 w-4 text-mut shrink-0" />
            <input name="password" required type={show ? 'text' : 'password'} placeholder="••••••••" className={inputCls} />
            <button type="button" onClick={() => setShow(!show)} className="p-1 text-mut hover:text-ink" aria-label="Tampilkan password">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{err}</div>}
        <button
          disabled={pending}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-acc to-teal-400 text-acc-ink text-sm font-bold hover:opacity-90 active:scale-[0.99] transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          Masuk
        </button>
      </form>

      <div className="flex items-center gap-3 text-[10px] text-mut">
        <div className="h-px flex-1 bg-line" />
        atau
        <div className="h-px flex-1 bg-line" />
      </div>

      <Link
        href="/guest"
        className="w-full py-2.5 rounded-xl border border-line bg-card-2 text-ink text-sm font-semibold hover:border-acc/40 transition flex items-center justify-center gap-2"
      >
        <GuestIcon className="h-4 w-4 text-acc" />
        Intip sebagai Guest
      </Link>
      <Link
        href="/portfolio"
        className="w-full py-2 rounded-xl text-mut text-xs hover:text-ink transition flex items-center justify-center gap-2"
      >
        <Globe className="h-3.5 w-3.5" />
        Lihat Portofolio Kelas
      </Link>
      <p className="text-center text-[10px] text-mut">Lupa password? Hubungi admin kelas kamu.</p>
    </div>
  );
}
