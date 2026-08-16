import { getClassSettings } from '@/lib/auth/settings-actions';
import LoginCard from '@/components/auth/LoginCard';

export default async function LoginPage() {
  const s = await getClassSettings();
  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden">
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-acc/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md space-y-6 py-10">
        <div className="text-center space-y-3 anim-fade-up">
          {s?.logo_url ? (
            <img
              src={s.logo_url}
              alt="Logo kelas"
              className="h-20 w-20 mx-auto rounded-3xl object-cover border border-line shadow-xl"
            />
          ) : (
            <div className="h-20 w-20 mx-auto rounded-3xl bg-acc/10 border border-acc/30 flex items-center justify-center text-3xl font-black text-acc">
              {(s?.class_name || 'C').charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-black text-grad">{s?.class_name || 'ClassHub'}</h1>
            <p className="text-sm text-mut mt-1">
              {s?.school_name ? s.school_name + ' • ' : ''}
              {s?.subtitle || 'Masuk ke kelas kamu'}
            </p>
          </div>
        </div>
        <LoginCard />
      </div>
    </div>
  );
}
