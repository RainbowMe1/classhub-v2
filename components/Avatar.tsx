export default function Avatar({ data, className }: { data: any; className?: string }) {
  const size = className || 'h-10 w-10';
  if (!data?.avatar_url) {
    return (
      <div className={'rounded-full bg-line-2 flex items-center justify-center font-bold shrink-0 ' + size}>
        {(data?.full_name || 'U').charAt(0)}
      </div>
    );
  }
  const z = data.avatar_zoom && Number(data.avatar_zoom) > 1 ? Number(data.avatar_zoom) : 1;
  const style =
    z > 1
      ? {
          transform:
            'scale(' + z + ') translate(' + ((0.5 - Number(data.avatar_x ?? 0.5)) * 100) + '%, ' + ((0.5 - Number(data.avatar_y ?? 0.5)) * 100) + '%)',
        }
      : undefined;
  return (
    <div className={'relative overflow-hidden rounded-full shrink-0 ' + size}>
      <img src={data.avatar_url} alt="" className="h-full w-full object-cover" style={style} />
    </div>
  );
}
