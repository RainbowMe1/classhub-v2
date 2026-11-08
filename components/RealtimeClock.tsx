'use client';
import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

export default function RealtimeClock() {
  const [time, setTime] = useState('00:00');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false, 
        timeZone: 'Asia/Jakarta' 
      }) + ' WIB');
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-line bg-card-2 px-2.5 py-1.5 text-xs font-medium text-mut">
      <Clock className="h-3.5 w-3.5 shrink-0 text-acc" />
      <span className="tabular-nums" suppressHydrationWarning>{time}</span>
    </div>
  );
}
