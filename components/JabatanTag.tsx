export default function JabatanTag({ jabatan, className }: { jabatan: string | null; className?: string }) {
  if (!jabatan) return null;
  return (
    <span className={'inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold ' + (className || '')}>
      {jabatan}
    </span>
  );
}
