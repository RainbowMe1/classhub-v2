'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import {
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  Sticker as StickerIcon,
  Trash2,
  X,
} from 'lucide-react';
import Lightbox from '@/components/feed/Lightbox';
import AdminTag from '@/components/AdminTag';
import {
  deleteChatMessage,
  deleteOwnChatSticker,
  saveChatSticker,
  type ChatSticker,
} from '@/lib/auth/chat-actions';

type Msg = {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
};

const MAX_STICKERS = 5;
const MAX_STICKER_SIZE = 5 * 1024 * 1024;
const STICKER_EXTENSIONS: Record<string, { extension: string; mediaType: 'image' | 'gif' }> = {
  'image/jpeg': { extension: 'jpg', mediaType: 'image' },
  'image/png': { extension: 'png', mediaType: 'image' },
  'image/webp': { extension: 'webp', mediaType: 'image' },
  'image/gif': { extension: 'gif', mediaType: 'gif' },
};

export default function ChatRoom({
  userId,
  initial,
  names,
  roles,
  stickers: initialStickers,
  isAdmin,
}: {
  userId: string;
  initial: Msg[];
  names: Record<string, string>;
  roles: Record<string, string>;
  stickers: ChatSticker[];
  isAdmin: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [stickers, setStickers] = useState<ChatSticker[]>(initialStickers);
  const [signedMedia, setSignedMedia] = useState<Record<string, string>>({});
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingSticker, setUploadingSticker] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingStickerId, setDeletingStickerId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [stickerOpen, setStickerOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stickerFileRef = useRef<HTMLInputElement>(null);
  const signingPaths = useRef(new Set<string>());

  useEffect(() => {
    const channel = supabase
      .channel('chat-room')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload: { new: Msg }) => {
          const row = payload.new;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_messages' },
        (payload: { old: Partial<Msg> }) => {
          const id = payload.old.id;
          if (id) setMessages((prev) => prev.filter((message) => message.id !== id));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    const paths = [
      ...stickers.map((sticker) => sticker.file_path),
      ...messages
        .filter(
          (message): message is Msg & { media_url: string } =>
            message.media_type === 'sticker' && typeof message.media_url === 'string'
        )
        .map((message) => message.media_url),
    ];
    const missingPaths = [...new Set(paths)].filter(
      (path) => !signingPaths.current.has(path) && !signedMedia[path]
    );
    if (missingPaths.length === 0) return;

    missingPaths.forEach((path) => signingPaths.current.add(path));
    void Promise.all(
      missingPaths.map(async (path) => {
        const { data, error } = await supabase.storage.from('chat').createSignedUrl(path, 86400);
        return { path, url: data?.signedUrl, error };
      })
    ).then((results) => {
      const urls: Record<string, string> = {};
      let failed = false;
      for (const result of results) {
        if (result.url) urls[result.path] = result.url;
        if (result.error) failed = true;
      }
      if (Object.keys(urls).length > 0) {
        setSignedMedia((prev) => ({ ...prev, ...urls }));
      }
      if (failed) setErr('Sebagian stiker tidak dapat dimuat. Coba muat ulang halaman.');
    });
  }, [messages, signedMedia, stickers, supabase]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    if ((!text.trim() && !pendingFile) || sending) return;
    setSending(true);
    setErr('');
    try {
      let mediaUrl: string | null = null;
      if (pendingFile) {
        if (!pendingFile.type.startsWith('image/')) {
          setErr('Hanya file gambar.');
          return;
        }
        if (pendingFile.size > 10 * 1024 * 1024) {
          setErr('Foto maksimal 10MB.');
          return;
        }
        const id = crypto.randomUUID();
        const ext = pendingFile.name.split('.').pop() || 'jpg';
        const path = `${userId}/${id}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('chat')
          .upload(path, pendingFile, { upsert: true });
        if (uploadError) {
          setErr('Upload gagal: ' + uploadError.message);
          return;
        }
        mediaUrl = supabase.storage.from('chat').getPublicUrl(path).data.publicUrl;
      }

      const { error } = await supabase.from('chat_messages').insert({
        user_id: userId,
        content: text.trim() || null,
        media_url: mediaUrl,
        media_type: mediaUrl ? 'image' : null,
      });
      if (error) {
        setErr('Gagal kirim: ' + error.message);
        return;
      }
      setText('');
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Terjadi kesalahan saat mengirim pesan.');
    } finally {
      setSending(false);
    }
  }

  async function sendSticker(sticker: ChatSticker) {
    if (sending) return;
    setSending(true);
    setErr('');
    try {
      const { error } = await supabase.from('chat_messages').insert({
        user_id: userId,
        content: null,
        media_url: sticker.file_path,
        media_type: 'sticker',
      });
      if (error) {
        setErr('Gagal mengirim stiker: ' + error.message);
      } else {
        setStickerOpen(false);
      }
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Terjadi kesalahan saat mengirim stiker.');
    } finally {
      setSending(false);
    }
  }

  async function addSticker(file: File | undefined) {
    if (!file || uploadingSticker) return;
    setErr('');
    const fileInfo = STICKER_EXTENSIONS[file.type];
    if (!fileInfo) {
      setErr('Gunakan gambar PNG, JPG, WEBP, atau GIF.');
      return;
    }
    if (file.size > MAX_STICKER_SIZE) {
      setErr('Ukuran stiker maksimal 5MB.');
      return;
    }
    if (stickers.filter((sticker) => sticker.user_id === userId).length >= MAX_STICKERS) {
      setErr('Koleksi sudah penuh. Hapus salah satu stiker lama dulu.');
      return;
    }

    setUploadingSticker(true);
    const path = `${userId}/stickers/${crypto.randomUUID()}.${fileInfo.extension}`;
    try {
      const { error: uploadError } = await supabase.storage.from('chat').upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) {
        setErr('Upload stiker gagal: ' + uploadError.message);
        return;
      }

      const result = await saveChatSticker(path, fileInfo.mediaType);
      if ('error' in result) {
        setErr(result.error ?? 'Gagal menyimpan stiker.');
        return;
      }
      setStickers((prev) => [...prev, result.sticker]);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Terjadi kesalahan saat membuat stiker.');
    } finally {
      setUploadingSticker(false);
      if (stickerFileRef.current) stickerFileRef.current.value = '';
    }
  }

  async function removeSticker(sticker: ChatSticker) {
    if (deletingStickerId) return;
    setDeletingStickerId(sticker.id);
    setErr('');
    try {
      const result = await deleteOwnChatSticker(sticker.id);
      if (result.error) {
        setErr(result.error);
      } else {
        setStickers((prev) => prev.filter((item) => item.id !== sticker.id));
      }
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Terjadi kesalahan saat menghapus stiker.');
    } finally {
      setDeletingStickerId(null);
    }
  }

  async function removeMessage(message: Msg) {
    if (!isAdmin || deletingId) return;
    if (!window.confirm('Hapus pesan ini dari chat kelas?')) return;
    setDeletingId(message.id);
    setErr('');
    try {
      const result = await deleteChatMessage(message.id);
      if (result.error) {
        setErr(result.error);
      } else {
        setMessages((prev) => prev.filter((item) => item.id !== message.id));
      }
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Terjadi kesalahan saat menghapus pesan.');
    } finally {
      setDeletingId(null);
    }
  }

  const myStickers = stickers.filter((sticker) => sticker.user_id === userId);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="bg-card border border-line rounded-2xl flex flex-col h-[calc(100vh-140px)]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
          <MessageCircle className="h-5 w-5 text-acc" />
          <div>
            <div className="font-semibold text-ink text-sm">Chat Kelas</div>
            <div className="text-xs text-mut">Realtime • semua anggota</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-mut text-sm py-8">Belum ada pesan. Sapa kelas lu!</p>
          )}
          {messages.map((message) => {
            const own = message.user_id === userId;
            const mediaUrl =
              message.media_type === 'sticker' && message.media_url
                ? signedMedia[message.media_url]
                : message.media_url;
            return (
              <div key={message.id} className={'flex ' + (own ? 'justify-end' : 'justify-start')}>
                <div className="flex items-start gap-1">
                  <div
                    className={
                      'max-w-[75vw] sm:max-w-[75%] rounded-2xl px-3 py-2 ' +
                      (own
                        ? 'bg-acc text-acc-ink rounded-br-sm'
                        : 'bg-card-2 border border-line rounded-bl-sm')
                    }
                  >
                    {!own && (
                      <div className="text-xs font-semibold mb-0.5 text-acc flex items-center gap-2">
                        {names[message.user_id] || 'Warga Kelas'}
                        <AdminTag role={roles[message.user_id] || ''} />
                      </div>
                    )}
                    {message.media_url && mediaUrl && (
                      <button
                        onClick={() => setLightbox(mediaUrl)}
                        className="block mb-1 rounded-xl overflow-hidden"
                        aria-label={message.media_type === 'sticker' ? 'Lihat stiker' : 'Lihat foto'}
                      >
                        <Image
                          src={mediaUrl}
                          alt={message.media_type === 'sticker' ? 'Stiker' : ''}
                          width={640}
                          height={480}
                          unoptimized
                          loading="lazy"
                          className={
                            message.media_type === 'sticker'
                              ? 'h-32 w-32 object-contain rounded-xl'
                              : 'max-h-64 w-full object-contain rounded-xl'
                          }
                        />
                      </button>
                    )}
                    {message.media_type === 'sticker' && message.media_url && !mediaUrl && (
                      <Loader2 className="h-5 w-5 animate-spin" aria-label="Memuat stiker" />
                    )}
                    {message.content && (
                      <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
                    )}
                    <div className={'text-[10px] mt-1 ' + (own ? 'text-acc-ink/60' : 'text-mut')}>
                      {new Date(message.created_at).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => removeMessage(message)}
                      disabled={deletingId === message.id}
                      className="p-2 rounded-full text-mut hover:text-red-400 hover:bg-red-400/10 disabled:opacity-50"
                      aria-label="Hapus pesan"
                      title="Hapus pesan"
                    >
                      {deletingId === message.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <div className="p-3 border-t border-line">
          {err && <div role="alert" className="text-xs text-red-400 mb-2">{err}</div>}
          {pendingFile && (
            <div className="flex items-center gap-2 mb-2 text-xs text-mut">
              <ImageIcon className="h-4 w-4 text-acc" />
              <span className="truncate">{pendingFile.name}</span>
              <button
                onClick={() => {
                  setPendingFile(null);
                  if (fileRef.current) fileRef.current.value = '';
                }}
                className="text-mut hover:text-ink"
                aria-label="Hapus foto"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {stickerOpen && (
            <div className="mb-3 rounded-xl border border-line bg-card-2 p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-semibold text-ink">Stikerku</div>
                  <div className="text-xs text-mut">
                    {myStickers.length}/{MAX_STICKERS} stiker • Gambar atau GIF, maks. 5MB
                  </div>
                </div>
                <button
                  onClick={() => stickerFileRef.current?.click()}
                  disabled={uploadingSticker || myStickers.length >= MAX_STICKERS}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-2 text-xs text-ink hover:border-acc disabled:opacity-40"
                  aria-label="Buat stiker dari foto atau GIF"
                >
                  {uploadingSticker ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Buat stiker
                </button>
              </div>
              <input
                ref={stickerFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(event) => void addSticker(event.target.files?.[0])}
              />
              {myStickers.length === 0 ? (
                <p className="py-3 text-center text-xs text-mut">
                  Belum ada stiker. Pilih foto atau GIF untuk membuatnya.
                </p>
              ) : (
                <div className="grid grid-cols-5 gap-2">
                  {myStickers.map((sticker) => (
                    <div key={sticker.id} className="relative min-w-0">
                      <button
                        onClick={() => void sendSticker(sticker)}
                        disabled={sending || !signedMedia[sticker.file_path]}
                        className="flex h-16 w-full items-center justify-center rounded-lg border border-line bg-card p-1 hover:border-acc disabled:opacity-50"
                        aria-label="Kirim stiker"
                      >
                        {signedMedia[sticker.file_path] ? (
                          <Image
                            src={signedMedia[sticker.file_path]}
                            alt="Stiker"
                            width={128}
                            height={128}
                            unoptimized
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin text-mut" />
                        )}
                      </button>
                      <button
                        onClick={() => void removeSticker(sticker)}
                        disabled={deletingStickerId === sticker.id}
                        className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-card text-mut hover:text-red-400 disabled:opacity-50"
                        aria-label="Hapus stiker"
                        title="Hapus stiker"
                      >
                        {deletingStickerId === sticker.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {myStickers.length >= MAX_STICKERS && (
                <p className="mt-2 text-xs text-mut">Hapus stiker lama untuk membuat stiker baru.</p>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="p-2.5 rounded-full bg-card-2 border border-line text-mut hover:text-ink"
              aria-label="Kirim foto"
            >
              <ImageIcon className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => setPendingFile(event.target.files?.[0] || null)}
            />
            <button
              onClick={() => setStickerOpen((open) => !open)}
              className={
                'p-2.5 rounded-full border border-line hover:text-ink ' +
                (stickerOpen ? 'bg-acc text-acc-ink' : 'bg-card-2 text-mut')
              }
              aria-label="Buka stiker"
              aria-expanded={stickerOpen}
            >
              <StickerIcon className="h-4 w-4" />
            </button>
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void send()}
              placeholder="Tulis pesan..."
              className="flex-1 px-4 py-2.5 rounded-full bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50"
            />
            <button
              onClick={() => void send()}
              disabled={(!text.trim() && !pendingFile) || sending}
              className="p-2.5 rounded-full bg-acc text-acc-ink disabled:opacity-30"
              aria-label="Kirim pesan"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {lightbox && <Lightbox urls={[lightbox]} index={0} onClose={() => setLightbox(null)} />}
    </div>
  );
}
