'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Cropper, { type ReactCropperElement } from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import { createClient } from '@/lib/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import Avatar from '@/components/Avatar';
import AdminTag from '@/components/AdminTag';
import JabatanTag from '@/components/JabatanTag';
import { X, Users, AtSign, Edit3, CheckCircle2, Loader2, Upload } from 'lucide-react';
import { adminUpdateProfile } from '@/lib/auth/admin-profile-actions';

function igUrl(v: string) {
  if (v.startsWith('http')) return v;
  return 'https://instagram.com/' + v.replace(/^@/, '').trim();
}

export default function MembersPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [sel, setSel] = useState<any | null>(null);

  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);
  const cropperRef = useRef<ReactCropperElement>(null);

  const [editBusy, setEditBusy] = useState(false);
  const [editMsg, setEditMsg] = useState('');
  const [editErr, setEditErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (p) setProfile(p);
      const { data: m } = await supabase.from('profiles').select('*').eq('is_banned', false).order('full_name');
      setMembers(m ?? []);
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  useEffect(() => {
    return () => {
      if (croppedPreview) URL.revokeObjectURL(croppedPreview);
    };
  }, [croppedPreview]);

  function startEdit(member: any) {
    setEditingMember(member.user_id);
    setEditForm({ 
      full_name: member.full_name || '', 
      bio: member.bio || '', 
      jabatan: member.jabatan || '', 
      sesi_pendidikan: member.sesi_pendidikan || '', 
      role: member.role || 'student', 
      is_banned: member.is_banned || false 
    });
    setSelectedFile(null);
    setCroppedFile(null);
    setCropSrc(null);
    setCroppedPreview(null);
    setEditMsg(''); 
    setEditErr('');
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      if (!file.type.startsWith('image/')) {
        setEditErr('Pilih file gambar yang valid.');
        return;
      }
      setCropSrc(URL.createObjectURL(file));
      setSelectedFile(file);
      setCroppedFile(null);
      setCroppedPreview(null);
      setEditErr('');
    }
  };

  async function confirmCrop() {
    const canvas = cropperRef.current?.cropper.getCroppedCanvas({
      width: 512,
      height: 512,
      imageSmoothingQuality: 'high',
    });
    if (!canvas) {
      setEditErr('Gagal memproses crop foto. Silakan coba pilih foto lain.');
      return;
    }

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) {
      setEditErr('Gagal memproses crop foto. Silakan coba lagi.');
      return;
    }

    const file = new File([blob], 'profile-photo.jpg', { type: 'image/jpeg' });
    setCroppedFile(file);
    setCroppedPreview(URL.createObjectURL(file));
    setEditErr('');
  }

  function closeEdit() {
    setEditingMember(null);
    setSelectedFile(null);
    setCroppedFile(null);
    setCropSrc(null);
    setCroppedPreview(null);
  }

  async function saveEdit() {
    if (!editingMember) return;
    if (selectedFile && !croppedFile) {
      setEditErr('Sesuaikan dan konfirmasi crop foto sebelum menyimpan.');
      return;
    }
    setEditBusy(true); 
    setEditMsg(''); 
    setEditErr('');
    
    const formData = new FormData();
    formData.append('full_name', editForm.full_name);
    formData.append('bio', editForm.bio || '');
    formData.append('jabatan', editForm.jabatan || '');
    formData.append('sesi_pendidikan', editForm.sesi_pendidikan || '');
    formData.append('role', editForm.role);
    formData.append('is_banned', editForm.is_banned ? 'on' : 'off');
    
    if (croppedFile) {
      formData.append('avatar_file', croppedFile);
    }

    const res: any = await adminUpdateProfile(editingMember, formData);
    setEditBusy(false);
    
    if (res && res.error) { 
      setEditErr(res.error); 
      return; 
    }
    
    setEditMsg('Profil berhasil diperbarui ✓');
    closeEdit();
    setSel(null); 
    
    const { data: m } = await supabase.from('profiles').select('*').eq('is_banned', false).order('full_name');
    setMembers(m ?? []);
  }

  if (!profile) return <div className="min-h-screen" />;

  return (
    <AppLayout profile={profile}>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-acc" />
          Anggota Kelas
        </h1>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {members.map((m) => (
            <button
              key={m.user_id}
              onClick={() => setSel(m)}
              className="anim-fade-up bg-card border border-line rounded-2xl p-4 text-center hover:border-acc/40 active:scale-[0.98] transition"
            >
              <Avatar data={m} className="h-16 w-16 mx-auto text-xl" />
              <div className="font-semibold text-sm mt-2 truncate">{m.full_name}</div>
              <div className="text-xs text-mut">@{m.username}</div>
              {m.bio && <div className="text-[11px] text-mut mt-1 truncate">{m.bio}</div>}
              <div className="mt-1.5 flex items-center justify-center gap-1.5 flex-wrap">
                <AdminTag role={m.role} />
                <JabatanTag jabatan={m.jabatan} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {sel && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4" onClick={() => setSel(null)}>
          <div role="dialog" aria-modal="true" className="bg-card border border-line rounded-2xl p-6 w-full max-w-sm space-y-4 text-center relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start absolute top-2 left-2 right-2">
              <button onClick={() => setSel(null)} className="p-2 text-mut hover:text-ink" aria-label="Tutup">
                <X className="h-5 w-5" />
              </button>
              {(profile.role === 'admin' || profile.role === 'teacher') && (
                <button onClick={() => { startEdit(sel); setSel(null); }} className="p-2 text-mut hover:text-acc transition" aria-label="Edit Anggota">
                  <Edit3 className="h-5 w-5" />
                </button>
              )}
            </div>
            <div className="mt-8">
              <Avatar data={sel} className="h-24 w-24 mx-auto text-3xl" />
            </div>
            <div>
              <div className="text-lg font-bold flex items-center justify-center gap-2">
                {sel.full_name}
                <AdminTag role={sel.role} />
              </div>
              <div className="text-sm text-mut">@{sel.username}</div>
              <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
                <JabatanTag jabatan={sel.jabatan} />
                <span className="text-[10px] uppercase text-acc font-bold">{sel.role}</span>
              </div>
            </div>
            {sel.bio && <p className="text-sm text-mut whitespace-pre-wrap">{sel.bio}</p>}
            {sel.instagram && (
              <a href={igUrl(sel.instagram)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-400 hover:underline">
                <AtSign className="h-4 w-4" />
                {sel.instagram.startsWith('@') ? sel.instagram : '@' + sel.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\/?/, '')}
              </a>
            )}
            <div className="text-xs text-mut border-t border-line pt-3">
              Bergabung {new Date(sel.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
      )}

      {editingMember && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4" onClick={closeEdit}>
          <div className="bg-card border border-line rounded-2xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-acc" /> Edit Anggota
            </h2>
            {editMsg && <div className="p-2 rounded-lg bg-acc/10 border border-acc/30 text-acc text-xs mb-3">{editMsg}</div>}
            {editErr && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-3">{editErr}</div>}
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-mut">Nama Lengkap</label>
                <input value={editForm.full_name} onChange={(e) => setEditForm({...editForm, full_name: e.target.value})} className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm" />
              </div>
              
              <div>
                <label className="text-[10px] text-mut">Foto Profil</label>
                <label className="flex items-center gap-3 w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm cursor-pointer hover:border-acc/50 transition">
                  <Upload className="h-4 w-4 text-mut" />
                  <span className="text-mut truncate flex-1">
                    {selectedFile ? `✅ ${selectedFile.name}` : 'Pilih file gambar...'}
                  </span>
                  <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                </label>
                {cropSrc && !croppedFile && (
                  <div className="mt-3 space-y-3">
                    <div className="overflow-hidden rounded-xl border border-line bg-black/20">
                      <Cropper
                        ref={cropperRef}
                        src={cropSrc}
                        style={{ height: 280, width: '100%' }}
                        aspectRatio={1}
                        viewMode={1}
                        dragMode="move"
                        autoCropArea={1}
                        guides
                        background={false}
                        responsive
                        checkOrientation
                      />
                    </div>
                    <p className="text-[10px] text-mut">Geser dan atur ukuran foto agar pas di dalam lingkaran profil.</p>
                    <button
                      type="button"
                      onClick={confirmCrop}
                      className="w-full rounded-lg bg-acc/10 border border-acc/30 py-2 text-xs font-semibold text-acc hover:bg-acc/20 transition"
                    >
                      Gunakan hasil crop
                    </button>
                  </div>
                )}
                {croppedPreview && (
                  <div className="mt-2 flex items-center gap-2">
                    <Image src={croppedPreview} alt="Pratinjau foto profil yang sudah di-crop" width={48} height={48} unoptimized className="w-12 h-12 rounded-full object-cover border border-line" />
                    <span className="text-[10px] text-acc">Crop siap disimpan. Pilih file lagi untuk mengubah crop.</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-mut">Jabatan</label>
                  <input value={editForm.jabatan} onChange={(e) => setEditForm({...editForm, jabatan: e.target.value})} placeholder="Ketua Kelas" className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-mut">Sesi Pendidikan</label>
                  <input value={editForm.sesi_pendidikan} onChange={(e) => setEditForm({...editForm, sesi_pendidikan: e.target.value})} placeholder="Pagi/Siang" className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-mut">Bio</label>
                <textarea value={editForm.bio} onChange={(e) => setEditForm({...editForm, bio: e.target.value})} rows={2} className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm" />
              </div>
              <div className="flex gap-2 items-center">
                <label className="text-[10px] text-mut">Role</label>
                <select value={editForm.role} onChange={(e) => setEditForm({...editForm, role: e.target.value})} className="px-3 py-1.5 rounded-lg bg-card-2 border border-line text-xs flex-1">
                  <option value="student">Siswa</option>
                  <option value="teacher">Guru</option>
                  <option value="admin">Admin</option>
                </select>
                <label className="flex items-center gap-2 text-xs text-mut">
                  <input type="checkbox" checked={!!editForm.is_banned} onChange={(e) => setEditForm({...editForm, is_banned: e.target.checked})} />
                  Banned
                </label>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={closeEdit} className="flex-1 py-2 rounded-lg bg-line text-ink text-sm font-semibold">Batal</button>
                <button onClick={saveEdit} disabled={editBusy || (!!selectedFile && !croppedFile)} className="flex-1 py-2 rounded-lg bg-acc text-acc-ink text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                  {editBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}