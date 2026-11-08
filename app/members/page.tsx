'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import Avatar from '@/components/Avatar';
import AdminTag from '@/components/AdminTag';
import JabatanTag from '@/components/JabatanTag';
import { X, Users, AtSign, Edit3, CheckCircle2, Loader2, Upload, ZoomIn, ZoomOut } from 'lucide-react';
import { adminUpdateProfile } from '@/lib/auth/admin-profile-actions';

function igUrl(v: string) {
  if (v.startsWith('http')) return v;
  return 'https://instagram.com/' + v.replace(/^@/, '').trim();
}

// Komponen Crop Foto Custom (Sama seperti di profil)
function CropImageModal({ 
  file, 
  onClose, 
  onCropComplete 
}: { 
  file: File; 
  onClose: () => void; 
  onCropComplete: (croppedFile: File) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      if (imgRef.current) {
        imgRef.current.src = img.src;
      }
    };
  }, [file]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.min(Math.max(prev + delta, 1), 3));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const saveCrop = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size (512x512 untuk kualitas bagus)
    canvas.width = 512;
    canvas.height = 512;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Buat lingkaran clip
    ctx.beginPath();
    ctx.arc(256, 256, 256, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Gambar gambar dengan transformasi
    const imgSize = Math.max(img.width, img.height) * scale;
    const x = 256 - (img.width / 2) * scale + position.x;
    const y = 256 - (img.height / 2) * scale + position.y;

    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

    // Convert ke file
    canvas.toBlob((blob) => {
      if (blob) {
        const croppedFile = new File([blob], file.name, { type: 'image/jpeg' });
        onCropComplete(croppedFile);
      }
    }, 'image/jpeg', 0.9);
  }, [file, scale, position, onCropComplete]);

  return (
    <div className="fixed inset-0 z-[90] bg-black/90 flex items-center justify-center p-4">
      <div className="bg-card border border-line rounded-2xl p-5 max-w-sm w-full">
        <h3 className="text-lg font-bold mb-4">Atur Foto Profil</h3>
        
        {/* Preview Bulat */}
        <div className="relative flex items-center justify-center mb-4">
          <div className="w-48 h-48 rounded-full overflow-hidden border-2 border-acc relative">
            <img
              ref={imgRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={handleWheel}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                cursor: isDragging ? 'grabbing' : 'grab',
                touchAction: 'none'
              }}
              className="select-none"
              alt="Crop preview"
            />
          </div>
        </div>

        {/* Zoom Slider */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <ZoomOut className="h-4 w-4 text-mut" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="flex-1 h-1 bg-line rounded-lg appearance-none cursor-pointer accent-acc"
            />
            <ZoomIn className="h-4 w-4 text-mut" />
          </div>
          <p className="text-[10px] text-mut text-center">
            Geser buat atur posisi. Preview bulat = hasil akhir.
          </p>
        </div>

        {/* Tombol */}
        <div className="flex gap-2">
          <button 
            onClick={onClose} 
            className="flex-1 py-2.5 rounded-xl bg-line text-ink text-sm font-semibold"
          >
            Batal
          </button>
          <button 
            onClick={saveCrop} 
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-green-400 to-teal-400 text-acc-ink text-sm font-bold"
          >
            Simpan Foto
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MembersPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [sel, setSel] = useState<any | null>(null);

  // State untuk Edit
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  
  // State untuk Crop Gambar
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);

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
    setShowCropModal(false);
    setEditMsg(''); 
    setEditErr('');
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setShowCropModal(true);
    }
  };

  const handleCropComplete = (cropped: File) => {
    setCroppedFile(cropped);
    setShowCropModal(false);
  };

  async function saveEdit() {
    if (!editingMember) return;
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
    
    // Gunakan file yang sudah di-crop
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
    setEditingMember(null);
    setSel(null); 
    
    // Refresh data members
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

      {/* MODAL DETAIL ANGGOTA */}
      {sel && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4" onClick={() => setSel(null)}>
          <div role="dialog" aria-modal="true" className="bg-card border border-line rounded-2xl p-6 w-full max-w-sm space-y-4 text-center relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start absolute top-2 left-2 right-2">
              <button onClick={() => setSel(null)} className="p-2 text-mut hover:text-ink" aria-label="Tutup">
                <X className="h-5 w-5" />
              </button>
              <button onClick={() => { startEdit(sel); setSel(null); }} className="p-2 text-mut hover:text-acc transition" aria-label="Edit Anggota">
                <Edit3 className="h-5 w-5" />
              </button>
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

      {/* MODAL CROP FOTO */}
      {showCropModal && selectedFile && (
        <CropImageModal
          file={selectedFile}
          onClose={() => {
            setShowCropModal(false);
            setSelectedFile(null);
          }}
          onCropComplete={handleCropComplete}
        />
      )}

      {/* MODAL EDIT ANGGOTA */}
      {editingMember && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4" onClick={() => setEditingMember(null)}>
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
              
              {/* UPLOAD FOTO DENGAN PREVIEW */}
              <div>
                <label className="text-[10px] text-mut">Foto Profil</label>
                <label className="flex items-center gap-3 w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm cursor-pointer hover:border-acc/50 transition">
                  <Upload className="h-4 w-4 text-mut" />
                  <span className="text-mut truncate flex-1">
                    {croppedFile ? '✅ Foto sudah dipilih. Klik untuk ganti.' : 'Pilih file gambar...'}
                  </span>
                  <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                </label>
                {croppedFile && (
                  <div className="mt-2 flex items-center gap-2">
                    <img 
                      src={URL.createObjectURL(croppedFile)} 
                      alt="Preview" 
                      className="w-12 h-12 rounded-full object-cover border border-line"
                    />
                    <span className="text-[10px] text-acc">Foto siap diupload</span>
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
                <button onClick={() => setEditingMember(null)} className="flex-1 py-2 rounded-lg bg-line text-ink text-sm font-semibold">Batal</button>
                <button onClick={saveEdit} disabled={editBusy} className="flex-1 py-2 rounded-lg bg-acc text-acc-ink text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
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