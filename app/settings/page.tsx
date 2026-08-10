'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import Avatar from '@/components/Avatar';
import AdminTag from '@/components/AdminTag';
import { UserCog, KeyRound, Camera, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

const S = 640;

function CropModal({ file, onDone, onCrop, onClose }: { file: File; onDone: (f: File) => void; onCrop: (p: { zoom: number; x: number; y: number }) => void; onClose: () => void }) {
  const isGif = file.type === 'image/gif';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  const [previewUrl, setPreviewUrl] = useState(function () { return URL.createObjectURL(file); });

  useEffect(() => {
    const url = previewUrl;
    setPreviewUrl(url);
    const i = new Image();
    i.onload = function () {
      imgRef.current = i;
      draw();
    };
    i.src = url;
  }, [file]);

  function draw() {
    const c = canvasRef.current;
    const img = imgRef.current;
    if (!c || !img || isGif) return;
    c.width = S;
    c.height = S;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const base = Math.max(S / img.width, S / img.height);
    const scale = base * zoom;
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = S / 2 - pos.x * dw;
    const dy = S / 2 - pos.y * dh;
    ctx.clearRect(0, 0, S, S);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  useEffect(() => {
    draw();
  }, [zoom, pos]);

  function down(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y };
  }
  function move(e: React.PointerEvent) {
    const d = dragRef.current;
    const img = imgRef.current;
    if (!d || !img) return;
    const base = Math.max(S / img.width, S / img.height);
    const dw = img.width * base * zoom;
    const dh = img.height * base * zoom;
    setPos({
      x: Math.min(1, Math.max(0, d.px - (e.clientX - d.sx) / dw)),
      y: Math.min(1, Math.max(0, d.py - (e.clientY - d.sy) / dh)),
    });
  }
  function up() {
    dragRef.current = null;
  }

  const gifStyle = {
    transform: 'scale(' + zoom + ') translate(' + ((0.5 - pos.x) * 100) + '%, ' + ((0.5 - pos.y) * 100) + '%)',
  };

  function save() {
    if (isGif) {
      onCrop({ zoom, x: pos.x, y: pos.y });
      return;
    }
    const c = canvasRef.current;
    if (!c) return;
    c.toBlob(function (b) {
      if (b) onDone(new File([b], 'avatar.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-card border border-line rounded-2xl p-4 space-y-3 w-full max-w-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-ink">Atur Foto (1:1){isGif ? ' — GIF' : ''}</h3>
          <button onClick={onClose} className="p-2 text-mut hover:text-ink" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="relative">
          {isGif ? (
            <div className="w-full aspect-square rounded-xl border border-line overflow-hidden bg-card-2">
              <img
                src={previewUrl}
                alt=""
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                className="h-full w-full object-cover touch-none cursor-move"
                style={gifStyle}
              />
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              className="w-full aspect-square rounded-xl border border-line touch-none cursor-move"
            />
          )}
          <div className="absolute inset-0 pointer-events-none rounded-full border-2 border-white/80 z-10" />
        </div>
        <div className="relative z-20 flex items-center gap-3">
          <span className="text-xs text-mut shrink-0">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-acc"
          />
        </div>
        <p className="relative z-20 text-xs text-mut">Geser foto buat atur posisi di dalam lingkaran, zoom buat ukuran.</p>
        <button onClick={save} className="relative z-20 w-full py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold">
          {isGif ? 'Simpan GIF' : 'Simpan Foto'}
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState('');
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (p) { setProfile(p); setName(p.full_name || ''); }
    })();
  }, []);

  async function uploadAvatar(file: File, ext: string, params: { zoom: number; x: number; y: number } | null) {
    if (!profile) return;
    setBusy(true); setMsg(''); setErr('');
    const path = profile.user_id + '/avatar.' + ext;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setErr('Upload gagal: ' + upErr.message); setBusy(false); return; }
    const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
    const payload: any = { avatar_url: url };
    if (params) {
      payload.avatar_zoom = params.zoom;
      payload.avatar_x = params.x;
      payload.avatar_y = params.y;
    } else {
      payload.avatar_zoom = 1;
      payload.avatar_x = 0.5;
      payload.avatar_y = 0.5;
    }
    const { error } = await supabase.from('profiles').update(payload).eq('user_id', profile.user_id);
    setBusy(false);
    if (error) { setErr('Gagal simpan foto: ' + error.message); return; }
    setProfile({ ...profile, ...payload });
    setMsg('Foto profil tersimpan ✓');
    router.refresh();
  }

  function onPick(f: File) {
    setErr('');
    if (f.type === 'image/gif') {
      if (profile.role !== 'admin') { setErr('GIF khusus role admin.'); return; }
      if (f.size > 5 * 1024 * 1024) { setErr('GIF maksimal 5MB.'); return; }
    } else if (!f.type.startsWith('image/')) {
      setErr('File harus gambar.');
      return;
    }
    setCropFile(f);
  }

  async function saveName() {
    if (!profile || !name.trim()) return;
    setBusy(true); setMsg(''); setErr('');
    const { error } = await supabase.from('profiles').update({ full_name: name.trim() }).eq('user_id', profile.user_id);
    setBusy(false);
    if (error) setErr('Gagal simpan nama: ' + error.message);
    else setMsg('Nama tersimpan ✓');
  }

  async function savePw() {
    setBusy(true); setMsg(''); setErr('');
    if (pw.length < 8 || !/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) { setErr('Password minimal 8 karakter, kombinasi huruf dan angka.'); setBusy(false); return; }
    if (pw !== pw2) { setErr('Konfirmasi password tidak sama.'); setBusy(false); return; }
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setErr('Gagal ganti password: ' + error.message);
    else { setMsg('Password diganti ✓'); setPw(''); setPw2(''); }
  }

  if (!profile) return <div className="min-h-screen" />;

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50';

  return (
    <AppLayout profile={profile}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserCog className="h-6 w-6 text-acc" />
          Profil Saya
        </h1>
        {msg && <div className="p-2 rounded-lg bg-acc/10 border border-acc/30 text-acc text-sm">{msg}</div>}
        {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}

        <div className="bg-card border border-line rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-4">
            <Avatar data={profile} className="h-16 w-16" />
            <div className="flex-1">
              <div className="text-sm font-semibold flex items-center gap-2">
                {profile.full_name}
                <AdminTag role={profile.role} className="text-xs" />
              </div>
              <div className="text-xs text-mut">@{profile.username} • <span className="uppercase text-acc">{profile.role}</span></div>
            </div>
          </div>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-line text-ink text-xs font-semibold cursor-pointer hover:bg-line-2">
            <Camera className="h-4 w-4" />
            Ganti Foto Profil (GIF khusus admin)
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPick(f);
              }}
            />
          </label>
          {busy && <div className="text-xs text-mut">Menyimpan...</div>}
        </div>

        <div className="bg-card border border-line rounded-2xl p-4 space-y-3">
          <div className="text-sm font-semibold">Nama Tampilan</div>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          <button onClick={saveName} disabled={busy} className="w-full py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold disabled:opacity-50">
            Simpan Nama
          </button>
        </div>

        <div className="bg-card border border-line rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-acc" />
            Ganti Password
          </div>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password baru (min. 6 karakter)" className={inputCls} />
          <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Ulangi password baru" className={inputCls} />
          <button onClick={savePw} disabled={busy} className="w-full py-2 rounded-lg bg-line text-ink text-sm font-semibold hover:bg-line-2 disabled:opacity-50">
            Ganti Password
          </button>
        </div>
      </div>

      {cropFile && (
        <CropModal
          file={cropFile}
          onClose={() => setCropFile(null)}
          onDone={(f) => {
            setCropFile(null);
            uploadAvatar(f, 'jpg', null);
          }}
          onCrop={(p) => {
            const f = cropFile;
            setCropFile(null);
            uploadAvatar(f, 'gif', p);
          }}
        />
      )}
    </AppLayout>
  );
}
