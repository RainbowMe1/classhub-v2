export default function Avatar({ data, className }: { data: any; className?: string }) {
  const size = className || 'h-10 w-10';
  const adminGlow = data?.role === 'admin' && data?.glow_border !== false;

  const inner = data?.avatar_url ? (
    <img
      src={data.avatar_url}
      alt=""
      className="h-full w-full rounded-full object-cover"
      style={{ transform: 'scale(' + (data.avatar_zoom || 1) + ') translate(' + (data.avatar_x || 0) + '%, ' + (data.avatar_y || 0) + '%)' }}
    />
  ) : (
    <div className="h-full w-full rounded-full bg-line-2 flex items-center justify-center font-bold text-ink">
      {(data?.full_name || 'U').charAt(0)}
    </div>
  );

  if (!adminGlow) {
    return <div className={size + ' rounded-full overflow-hidden shrink-0'}>{inner}</div>;
  }
  return (
    <div className={size + ' rounded-full p-[2px] bg-gradient-to-tr from-acc via-teal-400 to-blue-500 shrink-0'}>
      <div className="h-full w-full rounded-full overflow-hidden border border-bg">{inner}</div>
    </div>
  );
}
