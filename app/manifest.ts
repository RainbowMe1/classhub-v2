import type { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';

export const revalidate = 300;

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let name = 'ClassHub';
  let logo: string | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from('class_settings').select('*').limit(1);
    if (data && data.length > 0) {
      name = data[0].class_name || name;
      logo = data[0].logo_url || null;
    }
  } catch (e) {}

  const icons: any[] = [];
  if (logo) {
    icons.push({ url: logo, sizes: '192x192', type: 'image/png' });
    icons.push({ url: logo, sizes: '512x512', type: 'image/png' });
  }
  icons.push({ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' });
  icons.push({ url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' });

  return {
    name: name,
    short_name: name,
    description: 'Aplikasi kelas kamu',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: icons,
  };
}
