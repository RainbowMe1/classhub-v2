'use client';
import { useEffect, useRef, useState } from 'react';
import { submitAttendance } from '@/lib/auth/attendance-actions';
import { Camera, RefreshCw, Send, Loader2, MapPin, FlipHorizontal, Maximize, SwitchCamera } from 'lucide-react';

const FILTERS = [
  { name: 'Normal', css: 'none' },
  { name: 'Cerah', css: 'brightness(1.15) saturate(1.2)' },
  { name: 'Hangat', css: 'sepia(0.25) saturate(1.3) brightness(1.05)' },
  { name: 'Sejuk', css: 'hue-rotate(15deg) saturate(1.1) brightness(1.05)' },
  { name: 'Vivid', css: 'saturate(1.6) contrast(1.1)' },
  { name: 'Soft', css: 'brightness(1.1) contrast(0.92) saturate(0.9)' },
  { name: 'Mono', css: 'grayscale(1) contrast(1.05)' },
  { name: 'Vintage', css: 'sepia(0.45) contrast(0.9) brightness(1.05)' },
];

function cameraErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Izin kamera ditolak. Izinkan akses kamera di pengaturan browser, lalu coba lagi.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Kamera yang dipilih tidak ditemukan. Coba ganti kamera.';
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return 'Kamera depan/belakang yang dipilih tidak tersedia di perangkat ini.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.';
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'Browser tidak mendukung kamera atau halaman belum menggunakan koneksi HTTPS.';
  }
  return 'Kamera tidak dapat dibuka. Periksa izin kamera perangkat lalu coba lagi.';
}

export default function AttendanceCamera({ schoolName, className }: { schoolName: string; className: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraSide, setCameraSide] = useState<'user' | 'environment'>('user');
  const [ready, setReady] = useState(false);
  const [camErr, setCamErr] = useState('');
  const [filter, setFilter] = useState(0);
  const [mirror, setMirror] = useState(true);
  const [orient, setOrient] = useState<'portrait' | 'landscape'>('portrait');
  const [shot, setShot] = useState<string | null>(null);
  const [loc, setLoc] = useState(schoolName || '');
  const [status, setStatus] = useState('hadir');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;

    async function startCamera() {
      setReady(false);
      setCamErr('');
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Kamera tidak didukung browser ini.');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: cameraSide } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (!video) {
          throw new Error('Pratinjau kamera tidak tersedia.');
        }
        video.srcObject = stream;
        await video.play();
        if (!cancelled) setReady(true);
      } catch (error) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (!cancelled) setCamErr(cameraErrorMessage(error));
      }
    }

    void startCamera();
    return () => {
      cancelled = true;
      if (video) {
        video.pause();
        video.srcObject = null;
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [cameraSide]);

  function switchCamera() {
    const nextSide = cameraSide === 'user' ? 'environment' : 'user';
    setCameraSide(nextSide);
    setMirror(nextSide === 'user');
  }

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const maxW = orient === 'landscape' ? 960 : 720;
    const scale = Math.min(1, maxW / v.videoWidth);
    const w = Math.round(v.videoWidth * scale);
    const h = Math.round(v.videoHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try { (ctx as any).filter = FILTERS[filter].css; } catch (e) {}
    ctx.save();
    if (mirror) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, w, h);
    ctx.restore();
    try { (ctx as any).filter = 'none'; } catch (e) {}
    const barH = Math.round(h * 0.17);
    const grad = ctx.createLinearGradient(0, h - barH, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.4, 'rgba(0,0,0,0.65)');
    grad.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h - barH, w, barH);
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'bottom';
    const fs1 = Math.max(12, Math.round(w * 0.034));
    const fs2 = Math.max(10, Math.round(w * 0.027));
    ctx.font = '700 ' + fs1 + 'px sans-serif';
    ctx.fillText('ABSENSI • ' + String(className || 'KELAS').toUpperCase(), Math.round(w * 0.03), h - barH + Math.round(barH * 0.4));
    ctx.font = '400 ' + fs2 + 'px sans-serif';
    ctx.fillText(dateStr + ' • ' + timeStr, Math.round(w * 0.03), h - barH + Math.round(barH * 0.7));
    ctx.fillText('Lokasi: ' + (loc || '-'), Math.round(w * 0.03), h - barH + Math.round(barH * 0.96));
    setShot(canvas.toDataURL('image/jpeg', 0.82));
  }

  async function submit() {
    if (!shot) return;
    setBusy(true);
    setErr('');
    const res: any = await submitAttendance(shot, loc, status, note, orient);
    setBusy(false);
    if (res && res.error) { setErr(res.error); return; }
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('attendance-done'));
  }

  return (
    <div className="bg-card border border-line rounded-2xl p-5 space-y-3">
      <div className="text-sm font-semibold flex items-center gap-2">
        <Camera className="h-4 w-4 text-acc" />
        Absen Pakai Kamera (foto langsung, tanpa upload)
      </div>

      {camErr && (
        <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          {camErr}
        </div>
      )}
      {err && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{err}</div>}

      {!shot && (
        <>
          <div className="flex gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 rounded-xl bg-card-2 border border-line text-sm">
              <option value="hadir">Hadir</option>
              <option value="sakit">Sakit</option>
              <option value="izin">Izin</option>
            </select>
            <div className="flex-1 flex items-center gap-2 px-3 rounded-xl bg-card-2 border border-line">
              <MapPin className="h-4 w-4 text-mut shrink-0" />
              <input
                value={loc}
                onChange={(e) => setLoc(e.target.value)}
                placeholder="Lokasi absen"
                className="flex-1 bg-transparent py-2 text-sm focus:outline-none"
              />
            </div>
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Keterangan (opsional, max 500 karakter)"
            maxLength={500}
            className="w-full px-3 py-2 rounded-xl bg-card-2 border border-line text-sm focus:outline-none focus:border-acc/50"
          />
          <div className="relative rounded-xl overflow-hidden border border-line bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={'w-full ' + (camErr ? 'hidden' : '')}
              style={{ transform: mirror ? 'scaleX(-1)' : 'scaleX(1)', filter: FILTERS[filter].css }}
            />
            {!ready && !camErr && <div className="absolute inset-0 flex items-center justify-center text-xs text-mut">Menyalakan kamera...</div>}
            {camErr && (
              <div className="flex min-h-40 flex-col items-center justify-center gap-3 p-4 text-center">
                <Camera className="h-7 w-7 text-mut" />
                <button
                  type="button"
                  onClick={switchCamera}
                  className="min-h-11 rounded-xl bg-acc px-4 text-sm font-semibold text-acc-ink flex items-center gap-2"
                >
                  <SwitchCamera className="h-4 w-4" />
                  Coba kamera {cameraSide === 'user' ? 'belakang' : 'depan'}
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={switchCamera}
              className="min-h-11 px-3 py-1.5 rounded-full text-xs font-semibold border transition flex items-center gap-1 bg-card-2 text-mut border-line hover:border-acc/40"
              aria-label={`Ganti ke kamera ${cameraSide === 'user' ? 'belakang' : 'depan'}`}
            >
              <SwitchCamera className="h-3.5 w-3.5" />
              Kamera {cameraSide === 'user' ? 'depan' : 'belakang'}
            </button>
            <button onClick={() => setMirror(!mirror)} className={'px-3 py-1.5 rounded-full text-xs font-semibold border transition flex items-center gap-1 ' + (mirror ? 'bg-acc text-acc-ink border-acc' : 'bg-card-2 text-mut border-line')}>
              <FlipHorizontal className="h-3 w-3" />
              Mirror {mirror ? 'ON' : 'OFF'}
            </button>
            <button onClick={() => setOrient(orient === 'portrait' ? 'landscape' : 'portrait')} className={'px-3 py-1.5 rounded-full text-xs font-semibold border transition flex items-center gap-1 ' + (orient === 'landscape' ? 'bg-acc text-acc-ink border-acc' : 'bg-card-2 text-mut border-line')}>
              <Maximize className="h-3 w-3" />
              {orient === 'portrait' ? 'Portrait' : 'Landscape'}
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map(function (f, i) {
              return (
                <button
                  key={f.name}
                  onClick={() => setFilter(i)}
                  className={'shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ' + (filter === i ? 'bg-acc text-acc-ink border-acc' : 'bg-card-2 text-mut border-line hover:border-acc/40')}
                >
                  {f.name}
                </button>
              );
            })}
          </div>
          <button onClick={capture} disabled={!ready || !!camErr} className="w-full py-2.5 rounded-xl bg-acc text-acc-ink text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            <Camera className="h-4 w-4" />
            Jepret
          </button>
        </>
      )}

      {shot && (
        <>
          <img src={shot} alt="Preview absensi" className="w-full rounded-xl border border-line" />
          <div className="text-[11px] text-mut">Template tanggal, waktu WIB, dan lokasi udah kebakar di foto. Pastikan wajah kamu keliatan jelas.</div>
          <div className="flex gap-2">
            <button onClick={() => setShot(null)} className="flex-1 py-2.5 rounded-xl bg-line text-ink text-sm font-semibold flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Ulangi
            </button>
            <button onClick={submit} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-acc text-acc-ink text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Kirim Absen
            </button>
          </div>
        </>
      )}
    </div>
  );
}
