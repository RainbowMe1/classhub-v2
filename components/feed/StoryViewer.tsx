'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X } from 'lucide-react';

type Story = { id: string; media_url: string; caption: string | null; user_id: string };
type Group = { profile: any; stories: Story[] };

export default function StoryViewer({ groups, start, onClose }: { groups: Group[]; start: number; onClose: () => void }) {
  const supabase = createClient();
  const [gi, setGi] = useState(start);
  const [si, setSi] = useState(0);
  const [prog, setProg] = useState(0);
  const group = groups[gi];
  const story = group ? group.stories[si] : null;

  function next() {
    if (!group) return onClose();
    if (si < group.stories.length - 1) setSi(si + 1);
    else if (gi < groups.length - 1) { setGi(gi + 1); setSi(0); }
    else onClose();
  }

  function prev() {
    if (si > 0) setSi(si - 1);
    else if (gi > 0) { setGi(gi - 1); setSi(0); }
  }

  useEffect(() => {
    setProg(0);
    const t = setInterval(() => setProg((p) => Math.min(100, p + 2)), 100);
    return () => clearInterval(t);
  }, [gi, si]);

  useEffect(() => {
    if (prog >= 100) next();
  }, [prog]);

  useEffect(() => {
    if (!story) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('story_views').insert({ story_id: story.id, user_id: user.id });
    })();
  }, [story ? story.id : '']);

  if (!group || !story) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black flex items-center justify-center">
      <div className="relative w-full h-full max-w-md mx-auto">
        <div className="absolute top-0 left-0 right-0 z-20 p-3 space-y-2 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex gap-1">
            {group.stories.map((s, i) => (
              <div key={s.id} className="flex-1 h-0.5 rounded bg-white/25 overflow-hidden">
                <div
                  className="h-full bg-acc"
                  style={{ width: (i < si ? 100 : i === si ? prog : 0) + '%' }}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-line-2 flex items-center justify-center text-xs font-bold text-ink">
                {group.profile?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="text-sm font-semibold text-ink">{group.profile?.full_name}</div>
            </div>
            <button onClick={onClose} className="p-2 text-ink/70 hover:text-ink" aria-label="Tutup">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <button className="absolute left-0 top-0 bottom-0 w-1/3 z-10" onClick={prev} aria-label="Sebelumnya" />
        <button className="absolute right-0 top-0 bottom-0 w-1/3 z-10" onClick={next} aria-label="Berikutnya" />

        <img src={story.media_url} alt="" className="w-full h-full object-contain" />

        {story.caption && (
          <div className="absolute bottom-4 left-4 right-4 z-20 text-center text-sm text-ink bg-black/50 rounded-xl px-3 py-2">
            {story.caption}
          </div>
        )}
      </div>
    </div>
  );
}
