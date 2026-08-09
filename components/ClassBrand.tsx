'use client';
import { useEffect, useState } from 'react';
import { getClassSettings } from '@/lib/auth/settings-actions';

export default function ClassBrand({ size, initial }: { size: 'lg' | 'sm'; initial?: any }) {
  const [s, setS] = useState<any>(initial || null);

  useEffect(() => {
    if (initial) return;
    (async () => {
      const d = await getClassSettings();
      setS(d);
    })();
  }, []);

  if (size === 'sm') {
    return (
      <span className="text-lg font-bold flex items-center gap-2">
        {s?.logo_url ? <img src={s.logo_url} alt="" className="h-6 w-6 rounded-full object-cover" /> : null}
        {s?.class_name ? <span className="text-grad">{s.class_name}</span> : <span className="text-grad">ClassHub</span>}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {s?.logo_url && <img src={s.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover border border-line" />}
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight truncate">
          {s?.class_name ? <span className="text-grad">{s.class_name}</span> : <span className="text-grad">ClassHub</span>}
        </h1>
        <p className="text-xs text-mut mt-0.5 truncate">{s?.subtitle || 'Kelas kamu, satu aplikasi'}</p>
      </div>
    </div>
  );
}
