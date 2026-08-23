/**
 * High-Quality Real Audio Streaming Service
 * Features:
 * - 6 Most Famous 24/7 Global Live Radios (Solo Piano, Lofi Study Beats, French Jazz Lounge, Paris Classic Jazz, Classic FM, SomaFM Ambient)
 * - 19 Studio-Recorded Continuous Nature Soundscapes (Rain, Waterfalls, Streams, Oceans, Wind, Forest)
 * - Synthesized Deep Brown Noise for deep concentration
 * - Zero Cache, Direct CORS Streaming via HTMLAudioElement
 */

export type AmbientSoundType =
  // The Top Curated 24/7 Radios (Solo Piano, Jazz, Lofi, Chill)
  | 'radio_piano'
  | 'radio_lofi'
  | 'radio_jazz_lounge'
  | 'radio_tsf_jazz'
  | 'radio_classic_fm'
  | 'radio_groove_salad'
  // Rain & Storms (Long Duration HQ Continuous)
  | 'rain_window'
  | 'rain_roof'
  | 'rain_leaves'
  | 'rain_heavy'
  | 'thunder_storm'
  // Water, Streams & Oceans (Long Duration HQ Continuous)
  | 'stream_river'
  | 'brook_meadow'
  | 'waterfall'
  | 'bamboo_fountain'
  | 'cave_water'
  | 'ocean_waves'
  | 'seashore_coast'
  // Wind, Forest & Wilderness (Long Duration HQ Continuous)
  | 'forest_breeze'
  | 'mountain_wind'
  | 'winter_blizzard'
  | 'meadow_morning'
  | 'crickets_night'
  | 'deep_wilderness'
  | 'wetland_frogs'
  // Focus & Noise
  | 'brown';

export interface IAmbientSoundItem {
  id: AmbientSoundType;
  label: string;
  category: 'radio' | 'rain' | 'water' | 'nature' | 'focus';
  description: string;
  audioUrl: string;
  emoji?: string;
  isLiveRadio?: boolean;
}

export const AMBIENT_SOUNDS: IAmbientSoundItem[] = [
  // --- Top 24/7 Iconic Live Radios (Lofi -> Jazz -> Piano) ---
  {
    id: 'radio_lofi',
    label: 'Lofi Study Beats 24/7',
    category: 'radio',
    description: 'Non-stop instrumental chillhop and relaxed lofi study beats radio',
    audioUrl: 'https://play.streamafrica.net/lofiradio',
    isLiveRadio: true,
  },
  {
    id: 'radio_jazz_lounge',
    label: 'Jazz Radio Lounge (France)',
    category: 'radio',
    description: 'Mellow smooth jazz, cafe bossa nova and relaxing lounge music',
    audioUrl: 'https://jazz-wr01.ice.infomaniak.ch/jazz-wr01-128.mp3',
    isLiveRadio: true,
  },
  {
    id: 'radio_tsf_jazz',
    label: 'TSF Jazz Paris 24/7',
    category: 'radio',
    description: 'Authentic classic Paris jazz, swing, bebop and live acoustic jazz',
    audioUrl: 'https://tsfjazz.ice.infomaniak.ch/tsfjazz-high.mp3',
    isLiveRadio: true,
  },
  {
    id: 'radio_piano',
    label: 'Klassik Radio – Solo Piano 24/7',
    category: 'radio',
    description: 'Pure peaceful solo piano, modern neoclassical and serene piano sonatas',
    audioUrl: 'https://stream.klassikradio.de/piano/mp3-128/',
    isLiveRadio: true,
  },
  {
    id: 'radio_classic_fm',
    label: 'Classic FM UK (Piano & Symphony)',
    category: 'radio',
    description: 'World’s greatest classical music, soothing piano concertos and strings',
    audioUrl: 'https://media-ssl.musicradio.com/ClassicFMMP3',
    isLiveRadio: true,
  },
  {
    id: 'radio_groove_salad',
    label: 'SomaFM Groove Salad',
    category: 'radio',
    description: 'The world-famous ambient/downtempo beats and grooves station',
    audioUrl: 'https://ice1.somafm.com/groovesalad-128-mp3',
    isLiveRadio: true,
  },

  // --- Rain & Storms ---
  {
    id: 'rain_window',
    label: 'Gentle Rain on Window',
    category: 'rain',
    description: 'Continuous soft rain and gentle drops pattering on glass',
    audioUrl: 'https://assets.mixkit.co/active_storage/sfx/1255/1255-preview.mp3',
  },
  {
    id: 'rain_roof',
    label: 'Rain on Tin Roof',
    category: 'rain',
    description: 'Steady soothing rainfall resonance on a rustic tin roof',
    audioUrl: 'https://assets.mixkit.co/active_storage/sfx/1250/1250-preview.mp3',
  },
  {
    id: 'rain_leaves',
    label: 'Rain in Woodland',
    category: 'rain',
    description: 'Calm raindrops falling through lush green forest leaves',
    audioUrl: 'https://assets.mixkit.co/active_storage/sfx/1253/1253-preview.mp3',
  },
  {
    id: 'rain_heavy',
    label: 'Heavy Pouring Rain',
    category: 'rain',
    description: 'Continuous deep rainstorm sound masking background room noise',
    audioUrl: 'https://assets.mixkit.co/active_storage/sfx/2515/2515-preview.mp3',
  },
  {
    id: 'thunder_storm',
    label: 'Real Heavy Thunderstorm',
    category: 'rain',
    description: 'Realistic rolling thunder rumble with continuous heavy pouring rain (5-min HQ)',
    audioUrl: 'https://raw.githubusercontent.com/chetAnrAo7/LofiPlayer-Data/main/5%20Minutes%20Of%20Nature/5%20Mins%20Of%20Thunderstorm%20-%20Raw.mp3',
  },

  // --- Water, Streams & Oceans ---
  {
    id: 'stream_river',
    label: 'Forest River Stream',
    category: 'water',
    description: 'Crystal clear running river stream rushing over smooth pebbles',
    audioUrl: 'https://assets.mixkit.co/active_storage/sfx/1220/1220-preview.mp3',
  },
  {
    id: 'brook_meadow',
    label: 'Gentle Meadow Brook',
    category: 'water',
    description: 'Soft babbling brook in peaceful open countryside grasses',
    audioUrl: 'https://assets.mixkit.co/active_storage/sfx/1222/1222-preview.mp3',
  },
  {
    id: 'waterfall',
    label: 'Forest Waterfall',
    category: 'water',
    description: 'Cascading clean white water falling into a natural plunge pool',
    audioUrl: 'https://assets.mixkit.co/active_storage/sfx/1190/1190-preview.mp3',
  },
  {
    id: 'bamboo_fountain',
    label: 'Bamboo Water Fountain',
    category: 'water',
    description: 'Relaxing Japanese bamboo fountain (Shishi-odoshi) garden stream',
    audioUrl: 'https://assets.mixkit.co/active_storage/sfx/1221/1221-preview.mp3',
  },
  {
    id: 'cave_water',
    label: 'Cavern Echo',
    category: 'water',
    description: 'Gentle water droplets echoing softly in a quiet stone cavern',
    audioUrl: 'https://assets.mixkit.co/active_storage/sfx/1191/1191-preview.mp3',
  },
  {
    id: 'ocean_waves',
    label: 'Ocean Waves & Surf',
    category: 'water',
    description: 'Rhythmic coastal ocean waves rolling gently onto the sandy beach',
    audioUrl: 'https://assets.mixkit.co/active_storage/sfx/1187/1187-preview.mp3',
  },
  {
    id: 'seashore_coast',
    label: 'Coastal Seashore Wind',
    category: 'water',
    description: 'Vast seaside coastal ambiance with distant marine breeze',
    audioUrl: 'https://assets.mixkit.co/active_storage/sfx/1189/1189-preview.mp3',
  },

  // --- Wind, Forest & Wilderness ---
  {
    id: 'forest_breeze',
    label: 'Autumn Forest Wind',
    category: 'nature',
    description: 'Rustling golden tree leaves in a peaceful autumn forest breeze',
    audioUrl: 'https://assets.mixkit.co/active_storage/sfx/1260/1260-preview.mp3',
  },
  {
    id: 'mountain_wind',
    label: 'High Mountain Breeze',
    category: 'nature',
    description: 'Continuous whistling mountain wind blowing through alpine pines',
    audioUrl: 'https://assets.mixkit.co/active_storage/sfx/1262/1262-preview.mp3',
  },
  {
    id: 'winter_blizzard',
    label: 'Winter Blizzard Gale',
    category: 'nature',
    description: 'Cold howling winter blizzard wind outside warm reading quarters',
    audioUrl: 'https://assets.mixkit.co/active_storage/sfx/1261/1261-preview.mp3',
  },
  {
    id: 'meadow_morning',
    label: 'Morning Sunny Meadow',
    category: 'nature',
    description: 'Peaceful morning countryside air and warm gentle meadow breeze',
    audioUrl: 'https://assets.mixkit.co/active_storage/sfx/1216/1216-preview.mp3',
  },
  {
    id: 'crickets_night',
    label: 'Summer Night Crickets',
    category: 'nature',
    description: 'Calming rhythmic night crickets in a tranquil summer field',
    audioUrl: 'https://assets.mixkit.co/active_storage/sfx/1214/1214-preview.mp3',
  },
  {
    id: 'deep_wilderness',
    label: 'Deep Forest Night',
    category: 'nature',
    description: 'Lush nighttime wilderness ambiance with serene nocturnal fauna',
    audioUrl: 'https://assets.mixkit.co/active_storage/sfx/1213/1213-preview.mp3',
  },
  {
    id: 'wetland_frogs',
    label: 'Twilight Swamp & Frogs',
    category: 'nature',
    description: 'Atmospheric dusk wetland chorus with gentle peeper frogs',
    audioUrl: 'https://assets.mixkit.co/active_storage/sfx/1217/1217-preview.mp3',
  },

  // --- Focus Noise ---
  {
    id: 'brown',
    label: 'Deep Brown Noise',
    category: 'focus',
    description: 'Heavy low-frequency smooth rumble synthesized for deep reading focus',
    audioUrl: '',
  },
];

export class AmbientSoundService {
  private static audioElement: HTMLAudioElement | null = null;
  private static audioCtx: AudioContext | null = null;
  private static synthNodes: { stop: () => void }[] = [];
  private static currentSound: AmbientSoundType | null = null;
  private static isPlaying: boolean = false;
  private static isLoading: boolean = false;
  private static getInitialVolume(): number {
    try {
      const saved = localStorage.getItem('velvet_ambient_volume');
      if (saved !== null) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 0 && val <= 1) {
          return val;
        }
      }
    } catch {}
    return 0.5;
  }

  private static currentVolume: number = AmbientSoundService.getInitialVolume(); // 0.0 -> 1.0
  private static listeners: Set<() => void> = new Set();

  static subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private static notify() {
    this.listeners.forEach((fn) => fn());
  }

  static getState() {
    return {
      isPlaying: this.isPlaying,
      isLoading: this.isLoading,
      currentSound: this.currentSound,
      volume: this.currentVolume,
    };
  }

  static setVolume(vol: number) {
    this.currentVolume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('velvet_ambient_volume', String(this.currentVolume));
    } catch {}
    if (this.audioElement) {
      this.audioElement.volume = this.currentVolume;
    }
    this.notify();
  }

  static async toggleSound(sound: AmbientSoundType) {
    if (this.isPlaying && this.currentSound === sound) {
      this.stop();
    } else {
      await this.play(sound);
    }
  }

  static async play(sound: AmbientSoundType) {
    this.stopImmediate();

    this.currentSound = sound;
    this.isPlaying = true;
    this.isLoading = sound !== 'brown';
    this.notify();

    // 1. If Brown Noise -> Synthesize with Web Audio
    if (sound === 'brown') {
      this.isLoading = false;
      this.playBrownNoiseSynth();
      this.notify();
      return;
    }

    // 2. Normal Ambient Nature or 24/7 Live Radio stream
    const soundItem = AMBIENT_SOUNDS.find((s) => s.id === sound);
    if (!soundItem || !soundItem.audioUrl) return;

    try {
      if (!this.audioElement) {
        this.audioElement = new Audio();
      }

      this.audioElement.preload = 'none'; // Only buffer live stream on demand, zero background prefetching
      this.audioElement.loop = !soundItem.isLiveRadio; // Live radio streams continuously, loops nature sfx
      this.audioElement.onended = null;
      this.audioElement.src = soundItem.audioUrl;
      this.audioElement.volume = this.currentVolume;

      this.audioElement.oncanplay = () => {
        this.isLoading = false;
        this.notify();
      };

      this.audioElement.onerror = (e) => {
        console.warn('Audio streaming error:', e);
        this.isLoading = false;
        this.notify();
      };

      await this.audioElement.play();
      this.isLoading = false;
      this.notify();
    } catch (err) {
      console.warn('Playback error:', err);
      this.isLoading = false;
      this.notify();
    }
  }

  private static stopImmediate() {
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.removeAttribute('src'); // Completely release audio stream and unload buffer
        this.audioElement.load();
        this.audioElement.currentTime = 0;
        this.audioElement.onended = null;
      } catch {}
    }

    this.synthNodes.forEach((node) => {
      try {
        node.stop();
      } catch {}
    });
    this.synthNodes = [];
  }

  static stop() {
    this.stopImmediate();
    this.currentSound = null;
    this.isPlaying = false;
    this.isLoading = false;
    this.notify();
  }

  // --- Brown Noise High Precision Web Audio Generator ---
  private static playBrownNoiseSynth() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const ctx = this.audioCtx;
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    const gain = ctx.createGain();
    gain.gain.value = Math.max(0.001, this.currentVolume);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(0);

    this.synthNodes.push({
      stop: () => {
        try {
          source.stop();
          source.disconnect();
          gain.disconnect();
        } catch {}
      },
    });
  }
}
