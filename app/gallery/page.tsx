import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import GalleryAlbum from '@/components/gallery/GalleryAlbum';
import CreateAlbumForm from '@/components/gallery/CreateAlbumForm';
import { Image as ImageIcon } from 'lucide-react';

export default async function GalleryPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const isStaff = user.profile.role !== 'student';

  const [{ data: albums, error: errAlbums }, { data: media, error: errMedia }] = await Promise.all([
    supabase.from('gallery_albums').select('*').order('created_at', { ascending: false }),
    supabase.from('gallery_media').select('*').order('created_at'),
  ]);

  const mediaByAlbum: Record<string, any[]> = {};
  for (const m of media ?? []) {
    if (!mediaByAlbum[m.album_id]) mediaByAlbum[m.album_id] = [];
    mediaByAlbum[m.album_id].push(m);
  }
  const myCount = (media ?? []).filter((m: any) => m.user_id === user.id).length;

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {(errAlbums || errMedia) && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {errAlbums ? 'Error album: ' + errAlbums.message : 'Error media: ' + (errMedia ? errMedia.message : '')}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ImageIcon className="h-6 w-6 text-acc" />
            Galeri Kelas
          </h1>
          <CreateAlbumForm />
        </div>

        {(albums?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-mut">Belum ada album. Buat album pertama!</div>
        ) : (
          (albums ?? []).map((a: any) => (
            <GalleryAlbum
              key={a.id}
              album={{ ...a, gallery_media: mediaByAlbum[a.id] ?? [] }}
              userId={user.id}
              isStaff={isStaff}
              myCount={myCount}
            />
          ))
        )}
      </div>
    </AppLayout>
  );
}
