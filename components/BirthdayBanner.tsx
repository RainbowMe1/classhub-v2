'use client';
import { useEffect, useState } from 'react';
import { getBirthdays } from '@/lib/auth/birthday-actions';
import { PartyPopper } from 'lucide-react';

export default function BirthdayBanner() {
  const [today, setToday] = useState<any[] | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const r: any = await getBirthdays();
        if (r && Array.isArray(r.today) && r.today.length) setToday(r.today);
      } catch (e) {}
    })();
  }, []);
  if (!today) return null;
  return (
    <div className="max-w-5xl mx-auto px-4 pt-4">
      <div className="p-4 rounded-2xl bg-gradient-to-r from-acc/20 to-teal-500/10 border border-acc/40 flex items-center gap-3 anim-fade-up">
        <PartyPopper className="h-6 w-6 text-acc shrink-0" />
        <div className="text-sm">
          <span className="font-bold">🎉 Hari ini ulang tahun {today.map((t) => t.name).join(', ')}!</span>{' '}
          <span className="text-mut">Ucapin dong di feed atau chat 💬</span>
        </div>
      </div>
    </div>
  );
}
