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

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {(errAlbums || errMedia) && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm break-all">
            {errAlbums ? 'Error album: ' + errAlbums.message : 'Error media: ' + (errMedia ? errMedia.message : '')}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Galeri Kelas</h1>
          {isStaff && <CreateAlbumForm />}
        </div>

        {(albums?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <ImageIcon className="h-12 w-12 mx-auto mb-4" />
            <p>{isStaff ? 'Belum ada album. Buat album pertama!' : 'Belum ada album. Tunggu admin membuat album.'}</p>
          </div>
        ) : (
          (albums ?? []).map((a: any) => (
            <GalleryAlbum
              key={a.id}
              album={{ ...a, gallery_media: mediaByAlbum[a.id] ?? [] }}
              userId={user.id}
              isStaff={isStaff}
            />
          ))
        )}
      </div>
    </AppLayout>
  );
}
