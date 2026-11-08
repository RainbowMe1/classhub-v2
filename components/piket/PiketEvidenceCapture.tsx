'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, Clock3, Loader2, RefreshCw, Send, X } from 'lucide-react';
import { submitPiketEvidence } from '@/lib/auth/piket-actions';

type Props = {
  entryId: string;
  studentName: string;
  weekday: string;
  groupMembers: string[];
  rejectionReason: string | null;
  onClose: () => void;
  onSubmitted: (warning?: string) => void;
};

function cameraErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Izin kamera ditolak. Izinkan akses kamera di pengaturan browser, lalu coba lagi.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Kamera tidak ditemukan pada perangkat ini.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.';
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'Browser tidak mendukung kamera atau halaman belum menggunakan koneksi HTTPS.';
  }
  return 'Kamera tidak dapat dibuka. Periksa izin kamera perangkat lalu coba lagi.';
}

export default function PiketEvidenceCapture({
  entryId,
  studentName,
  weekday,
  groupMembers,
  rejectionReason,
  onClose,
  onSubmitted,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [cameraError, setCameraError] = useState('');
  const [ready, setReady] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;

    async function startCamera() {
      setCameraError('');
      setReady(false);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('unsupported-camera');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (!video) {
          throw new Error('camera-preview-unavailable');
        }
        video.srcObject = stream;
        await video.play();
        if (!cancelled) setReady(true);
      } catch (cameraFailure) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (!cancelled) setCameraError(cameraErrorMessage(cameraFailure));
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
  }, [retryCount]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [busy, onClose]);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const scale = Math.min(1, 1280 / video.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      setError('Perangkat tidak dapat memproses foto.');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL('image/jpeg', 0.82);
    const encodedLength = image.length - image.indexOf(',') - 1;
    if (encodedLength > 2100000) {
      setError('Ukuran hasil foto terlalu besar. Ambil ulang dengan pencahayaan yang cukup.');
      return;
    }
    setError('');
    setPhoto(image);
  }

  async function submit() {
    if (!photo || busy) return;
    setBusy(true);
    setError('');
    let result: Awaited<ReturnType<typeof submitPiketEvidence>>;
    try {
      result = await submitPiketEvidence(entryId, photo);
    } catch {
      setBusy(false);
      setError('Bukti tidak dapat dikirim karena koneksi bermasalah. Coba lagi.');
      return;
    }
    setBusy(false);
    if ('error' in result && result.error) {
      setError(result.error);
      return;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    onSubmitted(result.warning);
  }

  const currentDate = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'full',
  }).format(now);
  const currentTime = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(now);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="piket-capture-title"
        className="max-h-[94dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-line bg-card p-4 shadow-2xl anim-fade-up sm:rounded-3xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-acc">Konfirmasi tugas</p>
            <h2 id="piket-capture-title" className="mt-1 text-xl font-bold">Lakukan Piket</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl p-2 text-mut transition hover:bg-line hover:text-ink disabled:opacity-50"
            aria-label="Tutup kamera"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-line bg-card-2 p-3 text-sm">
          <div>
            <div className="text-xs text-mut">Nama siswa</div>
            <div className="mt-0.5 truncate font-semibold">{studentName}</div>
          </div>
          <div>
            <div className="text-xs text-mut">Kelompok piket</div>
            <div className="mt-0.5 font-semibold">{weekday}</div>
          </div>
          <div className="col-span-2">
            <div className="text-xs text-mut">Anggota kelompok</div>
            <div className="mt-0.5 text-xs leading-relaxed">{groupMembers.join(', ') || studentName}</div>
          </div>
          <div className="col-span-2 flex items-center gap-2 border-t border-line pt-2 text-xs text-mut">
            <Clock3 className="h-3.5 w-3.5 text-acc" aria-hidden="true" />
            <time>{currentDate} · {currentTime} WIB</time>
          </div>
        </div>

        {rejectionReason && (
          <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
            <span className="font-semibold">Perlu dikirim ulang:</span> {rejectionReason}
          </div>
        )}
        {error && <div role="alert" className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={'h-full w-full object-cover ' + (photo || cameraError ? 'hidden' : '')}
            aria-label="Pratinjau kamera langsung"
          />
          {photo && <Image src={photo} alt="Pratinjau foto bukti piket" fill unoptimized className="object-contain" />}
          {!ready && !photo && !cameraError && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/70 text-sm text-white">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Meminta izin dan menyalakan kamera...
            </div>
          )}
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-white">
              <Camera className="h-8 w-8 text-acc" aria-hidden="true" />
              <p>{cameraError}</p>
              <button
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
                className="min-h-11 rounded-xl bg-acc px-4 font-semibold text-acc-ink"
              >
                Coba buka kamera lagi
              </button>
            </div>
          )}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-mut">
          Foto hanya dapat diambil melalui kamera. Bukti akan disimpan secara privat dan diperiksa oleh admin.
        </p>

        <div className="mt-4 flex gap-2">
          {photo ? (
            <>
              <button
                type="button"
                onClick={() => { setPhoto(null); setError(''); }}
                disabled={busy}
                className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-card-2 px-3 text-sm font-semibold transition hover:bg-line disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Ambil Ulang
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-acc px-3 text-sm font-bold text-acc-ink transition hover:bg-acc-strong disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                {busy ? 'Mengirim...' : 'Kirim Bukti'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={capture}
              disabled={!ready || Boolean(cameraError)}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-acc px-4 text-sm font-bold text-acc-ink transition hover:bg-acc-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              Ambil Foto
            </button>
          )}
        </div>

        <div className="sr-only" aria-live="polite">
          {busy ? 'Bukti sedang dikirim' : photo ? 'Foto siap untuk dikirim' : ready ? 'Kamera siap' : ''}
        </div>
      </section>
    </div>
  );
}
