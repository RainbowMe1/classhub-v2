import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/actions';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import PortfolioSections from '@/components/public/PortfolioSections';

export default async function LandingPage() {
  const user = await getUser();
  if (user) redirect('/dashboard');
  const supabase = await createClient();
  const [
    { data: settings },
    { data: media, count: mediaCount },
    { count: memberCount },
    { count: postCount },
    { count: albumCount },
    { data: teachers },
    { data: achievements },
    { data: journey },
  ] = await Promise.all([
    supabase.from('class_settings').select('*').limit(1),
    supabase.from('gallery_media').select('media_url', { count: 'exact' }).order('created_at', { ascending: false }).limit(5),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('is_hidden', false),
    supabase.from('gallery_albums').select('*', { count: 'exact', head: true }),
    supabase.from('class_teachers').select('*').order('created_at'),
    supabase.from('class_achievements').select('*').order('created_at'),
    supabase.from('class_journey').select('*').order('created_at'),
  ]);
  const s = settings && settings.length > 0 ? settings[0] : null;

  return (
    <div className="min-h-screen text-ink">
      <header className="max-w-5xl mx-auto flex items-center justify-between px-4 py-5">
        <div className="flex items-center gap-3">
          {s?.logo_url && <img src={s.logo_url} alt="" className="h-9 w-9 rounded-xl object-cover border border-line" />}
          <span className="text-lg font-bold text-grad">{s?.class_name || 'ClassHub'}</span>
        </div>
        <Link href="/login" className="px-4 py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong">
          Masuk
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-4">
        <PortfolioSections
          s={s}
          media={media}
          mediaCount={mediaCount ?? 0}
          teachers={teachers}
          achievements={achievements}
          journey={journey}
          memberCount={memberCount}
          postCount={postCount}
          albumCount={albumCount}
          cta={true}
        />
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-mut">
        © {new Date().getFullYear()} {s?.class_name || 'ClassHub'}{s?.school_name ? ' • ' + s.school_name : ''}
      </footer>
    </div>
  );
}
