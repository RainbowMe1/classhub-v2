'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import NotifBadge from '@/components/NotifBadge';
import ClassBrand from '@/components/ClassBrand';

export default function MobileNav({ items, userId }: { items: any[]; userId: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const bar = [items[0], items[1], items[2], items.find((i) => i.href === '/notifications')].filter(Boolean);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden glass border-t border-line">
        <div className="flex">
          {bar.map((item: any) => (
            <Link
              key={item.href}
              href={item.href}
              className={'flex-1 flex flex-col items-center gap-1 py-2.5 ' + (pathname === item.href ? 'text-acc' : 'text-mut')}
            >
              <span className="relative">
                <item.icon className="h-5 w-5" />
                {item.href === '/notifications' && (
                  <span className="absolute -top-1 -right-2">
                    <NotifBadge userId={userId} />
                  </span>
                )}
              </span>
              <span className="text-[10px]">{item.label}</span>
            </Link>
          ))}
          <button
            onClick={() => setOpen(true)}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 text-mut"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
            <span className="text-[10px]">Menu</span>
          </button>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 md:hidden" onClick={() => setOpen(false)}>
          <div
            className="absolute right-0 top-0 h-full w-72 bg-card border-l border-line p-5 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-line mb-4">
              <ClassBrand size="sm" />
              <button onClick={() => setOpen(false)} className="p-2 text-mut hover:text-ink" aria-label="Tutup">
                <X className="h-5 w-5" />
              </button>
            </div>
            {items.map((item: any) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ' +
                  (pathname === item.href ? 'bg-acc/10 text-acc' : 'text-mut hover:bg-line hover:text-ink')
                }
              >
                <item.icon className="h-5 w-5" />
                {item.label}
                {item.href === '/notifications' && <NotifBadge userId={userId} />}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
