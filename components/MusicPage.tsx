'use client';
import { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Music } from 'lucide-react';

// Data dummy (nanti bisa diganti dari DB)
const TRACKS = [
  { id: 1, title: 'Laskar Pelangi', artist: 'Nidji', cover: 'https://i.scdn.co/image/ab67616d0000b273b061694f1b3b0541b6b55e05', color: 'from-blue-600 to-purple-600' },
  { id: 2, title: 'Menghitung Hari', artist: 'Kahitna', cover: 'https://i.scdn.co/image/ab67616d0000b2738b061694f1b3b0541b6b55e05', color: 'from-pink-600 to-red-600' },
  { id: 3, title: 'Semua Tentang Kita', artist: 'Peterpan', cover: 'https://i.scdn.co/image/ab67616d0000b273c061694f1b3b0541b6b55e05', color: 'from-green-600 to-teal-600' },
];

export default function MusicPage() {
  const [currentTrack, setCurrentTrack] = useState(TRACKS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(30);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Music className="h-6 w-6 text-acc" /> Musik Kelas
      </h1>

      {/* Player Card */}
      <div className={'relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br ' + currentTrack.color + ' shadow-2xl'}>
        <div className="absolute inset-0 bg-black/20 backdrop-blur-xl" />
        <div className="relative z-10 flex flex-col items-center text-center space-y-6">
          {/* Animated Thumbnail */}
          <div className="relative">
            <div className={'absolute inset-0 rounded-full bg-white/20 blur-2xl ' + (isPlaying ? 'animate-pulse' : '')} />
            <img 
              src={currentTrack.cover} 
              alt={currentTrack.title}
              className={'relative w-48 h-48 rounded-full object-cover border-4 border-white/20 shadow-2xl ' + (isPlaying ? 'animate-[spin_8s_linear_infinite]' : '')}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-md border border-white/20" />
            </div>
          </div>

          {/* Info */}
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white drop-shadow-lg">{currentTrack.title}</h2>
            <p className="text-sm text-white/80 font-medium">{currentTrack.artist}</p>
          </div>

          {/* Progress */}
          <div className="w-full max-w-xs space-y-2">
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-300" style={{ width: progress + '%' }} />
            </div>
            <div className="flex justify-between text-[10px] text-white/60 font-mono">
              <span>1:24</span>
              <span>3:45</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-6">
            <button className="text-white/80 hover:text-white transition"><SkipBack className="h-6 w-6" /></button>
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-xl"
            >
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-1" />}
            </button>
            <button className="text-white/80 hover:text-white transition"><SkipForward className="h-6 w-6" /></button>
          </div>
        </div>
      </div>

      {/* Playlist */}
      <div className="bg-card border border-line rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-mut uppercase tracking-wider">Playlist</h3>
        {TRACKS.map(track => (
          <button
            key={track.id}
            onClick={() => { setCurrentTrack(track); setIsPlaying(true); }}
            className={'w-full flex items-center gap-3 p-3 rounded-xl transition ' + (currentTrack.id === track.id ? 'bg-acc/10 border border-acc/30' : 'bg-card-2 border border-line hover:border-acc/30')}
          >
            <img src={track.cover} alt="" className="w-12 h-12 rounded-lg object-cover" />
            <div className="flex-1 text-left">
              <div className="text-sm font-bold truncate">{track.title}</div>
              <div className="text-xs text-mut truncate">{track.artist}</div>
            </div>
            {currentTrack.id === track.id && isPlaying && (
              <div className="flex gap-0.5 items-end h-4">
                <div className="w-1 bg-acc animate-[bounce_1s_infinite]" style={{ height: '60%' }} />
                <div className="w-1 bg-acc animate-[bounce_1.2s_infinite]" style={{ height: '100%' }} />
                <div className="w-1 bg-acc animate-[bounce_0.8s_infinite]" style={{ height: '40%' }} />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
