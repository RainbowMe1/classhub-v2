export function thumb(url: string, width: number): string {
  if (!url) return url;
  if (url.indexOf('/storage/v1/object/public/') === -1) return url;
  if (url.indexOf('.mp4') !== -1 || url.indexOf('.webm') !== -1) return url;
  const base = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  return base + (url.indexOf('?') === -1 ? '?' : '&') + 'width=' + width + '&quality=70';
}
