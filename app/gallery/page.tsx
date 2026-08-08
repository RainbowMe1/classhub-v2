import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import { Image as ImageIcon } from 'lucide-react';

export default async function GalleryPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: albums } = await supabase
    .from('gallery_albums')
    .select('*, gallery_media(media_url, caption, media_type)')
    .order('created_at', { ascending: false });

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        <h1 className="text-2xl font-bold">Galeri Kelas</h1>
        {(albums?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <ImageIcon className="h-12 w-12 mx-auto mb-4" />
            <p>Belum ada album galeri</p>
          </div>
        ) : (
          albums?.map((album) => (
            <div key={album.id}>
              <h2 className="text-lg font-semibold mb-1">{album.name}</h2>
              {album.description && <p className="text-sm text-gray-400 mb-3">{album.description}</p>}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {(album as any).gallery_media?.map((m: any, i: number) => (
                  <img key={i} src={m.media_url} alt={m.caption || ''} loading="lazy" className="rounded-xl w-full h-40 object-cover border border-[#2a2a2a]" />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </AppLayout>
  );
}
