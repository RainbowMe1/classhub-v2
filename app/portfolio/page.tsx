import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import PortfolioSections from '@/components/public/PortfolioSections';

export default async function PortfolioPage() {
  const user = await requireUser();
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
    <AppLayout profile={user.profile}>
      <div className="max-w-5xl mx-auto px-4 py-6">
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
          cta={false}
          moreHref="/gallery"
        />
      </div>
    </AppLayout>
  );
}
