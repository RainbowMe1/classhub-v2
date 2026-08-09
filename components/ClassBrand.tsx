'use client';
import { useEffect, useState } from 'react';
import { getClassSettings } from '@/lib/auth/settings-actions';

export default function ClassBrand({ size }: { size: 'lg' | 'sm' }) {
  const [s, setS] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const d = await getClassSettings();
      setS(d);
    })();
  }, []);

  if (size === 'sm') {
    return (
      <span className="text-lg font-bold text-white flex items-center gap-2">
        {s?.logo_url ? <img src={s.logo_url} alt="" className="h-6 w-6 rounded-full object-cover" /> : null}
        {s?.class_name ? <span>{s.class_name}</span> : <span>Class<span className="text-[#a3e635]">Hub</span></span>}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {s?.logo_url && <img src={s.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover border border-[#2a2a2a]" />}
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-white truncate">
          {s?.class_name ? s.class_name : <span>Class<span className="text-[#a3e635]">Hub</span></span>}
        </h1>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{s?.subtitle || 'Kelas kamu, satu aplikasi'}</p>
      </div>
    </div>
  );
}
