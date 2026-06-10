/**
 * soundService.ts
 * Replaces SoundManager + MDSoundManager singletons from ObjC.
 *
 * Two channels:
 *   • Music  — looping background track; respects isMusicOn
 *   • Sounds — one-shot effects;          respects isSoundOn
 *
 * Animal sounds are loaded on demand from a full file path
 * (populated by server sync into Documents via the audio field).
 */
import Sound from 'react-native-sound';

Sound.setCategory('Playback');

// ─── Sound key → bundled filename ─────────────────────────────────────────────
// Keys mirror the original ObjC soundKey strings where possible.
const SOUND_FILES: Record<string, string> = {
  // Music tracks (played via playMusic, not play)
  menu_music:               'menu_music.wav',
  game_music:               'game_music.wav',

  // UI / navigation
  button_click:             'button_click.wav',
  transition_in:            'transition_in.wav',
  transition_out:           'transition_out.wav',
  settings_show_hide:       'settings_show_hide.wav',
  settings_buttons_appear:  'settings_buttons_appear.wav',

  // Spinny game
  correct:                  'correct.wav',
  ring_snap:                'ring_snap.wav',
  animal_reveal_ring_1:     'animal_reveal_ring_1.wav',
  animal_reveal_ring_2:     'animal_reveal_ring_2.wav',
  animal_reveal_ring_3:     'animal_reveal_ring_3.wav',
  animal_reveal_ring_4:     'animal_reveal_ring_4.wav',

  // Memory game
  memory_click1:            'memory_click1.wav',
  memory_click2:            'memory_click2.wav',
  memory_correct:           'memory_correct.wav',
  memory_level_complete:    'memory_level_complete.wav',
  memory_level_failed:      'memory_level_failed.wav',
};

export type SoundKey = keyof typeof SOUND_FILES;

const MUSIC_KEYS = new Set(['menu_music', 'game_music']);
const MUSIC_VOLUME = 0.5;
const GAME_MUSIC_VOLUME = 0.3;

// ─────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────

class SoundService {
  private sounds    = new Map<string, Sound>();
  private _isSoundOn = true;
  private _isMusicOn = true;

  private currentMusicKey: string | null = null;
  private currentMusic:    Sound  | null = null;

  /** Preload all bundled sounds. Call once at app start. */
  async loadAll(): Promise<void> {
    await Promise.all(
      Object.entries(SOUND_FILES).map(
        ([key, file]) =>
          new Promise<void>((resolve) => {
            const s = new Sound(file, Sound.MAIN_BUNDLE, (err) => {
              if (!err) this.sounds.set(key, s);
              resolve();
            });
          }),
      ),
    );
  }

  // ─── Music control ──────────────────────────────────────────────────────────

  get isMusicOn(): boolean { return this._isMusicOn; }
  set isMusicOn(v: boolean) {
    this._isMusicOn = v;
    if (!v) {
      this._stopCurrentMusic();
    } else if (this.currentMusicKey) {
      this._startMusic(this.currentMusicKey);
    }
  }

  /** Start looping background music. Stops whatever is playing first. */
  playMusic(key: string): void {
    if (this.currentMusicKey === key && this.currentMusic) return;
    this.currentMusicKey = key;
    if (!this._isMusicOn) return;
    this._startMusic(key);
  }

  stopMusic(): void {
    this._stopCurrentMusic();
  }

  private _startMusic(key: string): void {
    this._stopCurrentMusic();
    const s = this.sounds.get(key);
    if (!s) return;
    const vol = key === 'game_music' ? GAME_MUSIC_VOLUME : MUSIC_VOLUME;
    s.setVolume(vol);
    s.setNumberOfLoops(-1);
    s.play();
    this.currentMusic = s;
  }

  private _stopCurrentMusic(): void {
    this.currentMusic?.stop();
    this.currentMusic = null;
  }

  // ─── Sound effects control ───────────────────────────────────────────────────

  get isSoundOn(): boolean { return this._isSoundOn; }
  set isSoundOn(v: boolean) {
    this._isSoundOn = v;
    if (!v) this._stopAllSounds();
  }

  /** Play a one-shot sound effect by key. */
  play(key: string): void {
    if (!this._isSoundOn) return;
    if (MUSIC_KEYS.has(key)) return; // music keys must go through playMusic
    const s = this.sounds.get(key);
    if (!s) return;
    s.setNumberOfLoops(0);
    s.stop(() => s.play());
  }

  /** Play an animal sound from a full file path (downloaded from server). */
  playAnimalSound(filePath: string): void {
    if (!filePath) return;
    const s = new Sound(filePath, '', (err) => {
      if (err) return;
      s.setVolume(0.5);
      s.play(() => s.release());
    });
  }

  stop(key: string): void {
    this.sounds.get(key)?.stop();
  }

  stopAll(): void {
    this._stopCurrentMusic();
    this._stopAllSounds();
  }

  private _stopAllSounds(): void {
    this.sounds.forEach((s, k) => {
      if (!MUSIC_KEYS.has(k)) s.stop();
    });
  }

  isPlaying(key: string): boolean {
    return this.sounds.get(key)?.isPlaying() ?? false;
  }

  /** Volume duck for ads — mirror of MDSoundManagerKit.setMusicVolume(0). */
  setMusicVolume(v: number): void {
    this.currentMusic?.setVolume(v);
  }
}

export const soundService = new SoundService();