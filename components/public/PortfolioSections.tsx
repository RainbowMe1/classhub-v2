import { ArrowRight, Image as ImageIcon, Music, MessageCircle, ClipboardList, Newspaper, Award, GraduationCap, MapPin } from 'lucide-react';
import Link from 'next/link';

export default function PortfolioSections({ s, media, mediaCount, teachers, achievements, journey, memberCount, postCount, albumCount, cta, moreHref }: any) {
  const extra = Math.max(0, (mediaCount ?? media?.length ?? 0) - (media?.length ?? 0));

  const features = [
    { Icon: Newspaper, t: 'Feed Kelas', d: 'Postingan, foto, like & komentar' },
    { Icon: MessageCircle, t: 'Chat Realtime', d: 'Ngobrol sekelas langsung' },
    { Icon: ClipboardList, t: 'Tugas & Nilai', d: 'Kumpul tugas, terima feedback' },
    { Icon: Music, t: 'Musik Kelas', d: 'Playlist bersama buat belajar' },
  ];

  return (
    <>
      <section className="py-14 text-center space-y-5">
        <div className="text-xs uppercase tracking-[0.3em] text-mut">{s?.subtitle || 'Website resmi kelas'}</div>
        <h1 className="text-4xl md:text-6xl font-bold text-grad leading-tight">{s?.class_name || 'ClassHub'}</h1>
        <p className="max-w-xl mx-auto text-mut">
          Satu tempat untuk feed, chat, tugas, galeri, dan musik kelas. Khusus warga kelas — pengunjung cukup menikmati portofolio ini.
        </p>
        {cta && (
          <div className="flex items-center justify-center gap-3">
            <Link href="/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-acc text-acc-ink font-semibold hover:bg-acc-strong">
              Masuk ke Kelas
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
        <div className="flex items-center justify-center gap-8 pt-4 text-center">
          <div>
            <div className="text-2xl font-bold">{memberCount ?? 0}</div>
            <div className="text-xs text-mut">Anggota</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{postCount ?? 0}</div>
            <div className="text-xs text-mut">Postingan</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{albumCount ?? 0}</div>
            <div className="text-xs text-mut">Album</div>
          </div>
        </div>
      </section>

      {s?.about && (
        <section className="pb-14 max-w-3xl mx-auto text-center">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-mut mb-3">Tentang Kelas</h2>
          <p className="text-mut whitespace-pre-wrap leading-relaxed">{s.about}</p>
        </section>
      )}

      {(teachers?.length ?? 0) > 0 && (
        <section className="pb-14">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-mut mb-3 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-acc" />
            Guru & Wali Kelas
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {(teachers ?? []).map((t: any, i: number) => (
              <div key={t.id} className="anim-fade-up bg-card border border-line rounded-2xl p-4" style={{ animationDelay: i * 60 + 'ms' }}>
                <div className="font-semibold text-sm">{t.name}</div>
                {t.role && <div className="text-xs text-acc mt-1">{t.role}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {(achievements?.length ?? 0) > 0 && (
        <section className="pb-14">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-mut mb-3 flex items-center gap-2">
            <Award className="h-4 w-4 text-acc" />
            Prestasi
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {(achievements ?? []).map((a: any, i: number) => (
              <div key={a.id} className="anim-fade-up flex items-center gap-3 bg-card border border-line rounded-2xl p-4" style={{ animationDelay: i * 60 + 'ms' }}>
                <Award className="h-5 w-5 text-acc shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{a.title}</div>
                  <div className="text-xs text-mut">{[a.year, a.level].filter(Boolean).join(' • ')}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(journey?.length ?? 0) > 0 && (
        <section className="pb-14">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-mut mb-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-acc" />
            Perjalanan Kelas
          </h2>
          <div className="border-l-2 border-line ml-2 pl-6 space-y-6">
            {(journey ?? []).map((j: any, i: number) => (
              <div key={j.id} className="anim-fade-up relative" style={{ animationDelay: i * 60 + 'ms' }}>
                <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-acc" />
                <div className="text-xs text-acc font-semibold">{j.period}</div>
                <div className="font-semibold text-sm mt-0.5">{j.title}</div>
                {j.story && <p className="text-sm text-mut mt-1 whitespace-pre-wrap">{j.story}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {(media?.length ?? 0) > 0 && (
        <section className="pb-14">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-mut mb-3 flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-acc" />
            Galeri Kelas
          </h2>
          <div className="columns-2 md:columns-4 gap-2">
            {(media ?? []).map((m: any, i: number) => (
              <div key={i} className="relative mb-2 break-inside-avoid">
                <img
                  src={m.media_url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  style={{ animationDelay: i * 60 + 'ms' }}
                  className="anim-fade-up w-full rounded-xl border border-line"
                />
                {i === (media?.length ?? 0) - 1 && extra > 0 && (
                  moreHref ? (
                    <Link
                      href={moreHref}
                      className="absolute inset-0 rounded-xl bg-black/60 flex items-center justify-center text-white text-sm font-semibold hover:bg-black/70"
                    >
                      +{extra} foto lagi
                    </Link>
                  ) : (
                    <div className="absolute inset-0 rounded-xl bg-black/60 flex items-center justify-center text-white text-sm font-semibold">
                      +{extra} foto lagi
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="pb-16 grid sm:grid-cols-2 md:grid-cols-4 gap-3">
        {features.map((f, i) => (
          <div key={f.t} className="anim-fade-up bg-card border border-line rounded-2xl p-4" style={{ animationDelay: i * 70 + 'ms' }}>
            <f.Icon className="h-5 w-5 text-acc mb-2" />
            <div className="font-semibold text-sm">{f.t}</div>
            <div className="text-xs text-mut mt-1">{f.d}</div>
          </div>
        ))}
      </section>
    </>
  );
}
