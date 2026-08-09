export default function AdminTag({ role, className }: { role: string; className?: string }) {
  if (role !== 'admin') return null;
  return <span className={'rainbow-text font-bold uppercase ' + (className || 'text-[10px]')}>The Admin</span>;
}
