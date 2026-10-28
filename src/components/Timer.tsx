import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Timer as TimerIcon, X, RotateCcw } from 'lucide-react';
import { IconButton } from './UI';
export interface TimerValue {
  end: number | null;
  remaining: number;
  visible: boolean;
}
export const initialTimer = (): TimerValue => {
  try {
    return (
      JSON.parse(localStorage.getItem('streetlift-timer') || 'null') ?? {
        end: null,
        remaining: 180,
        visible: false,
      }
    );
  } catch {
    return { end: null, remaining: 180, visible: false };
  }
};
let audioContext: AudioContext | undefined;
export function unlockAudio() {
  try {
    audioContext ??= new AudioContext();
    void audioContext.resume();
  } catch {
    /* Browser without Web Audio. */
  }
}
function alertRest() {
  try {
    if (audioContext?.state === 'running') {
      for (let i = 0; i < 3; i++) {
        const oscillator = audioContext.createOscillator(),
          gain = audioContext.createGain();
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.frequency.value = 660;
        gain.gain.value = 0.12;
        const start = audioContext.currentTime + i * 0.25;
        oscillator.start(start);
        oscillator.stop(start + 0.14);
      }
    }
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* An alert may be blocked by the platform. */
  }
}
export function Timer({
  value,
  setValue,
  sound,
}: {
  value: TimerValue;
  setValue: React.Dispatch<React.SetStateAction<TimerValue>>;
  sound: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  const announced = useRef<number | null>(null);
  useEffect(() => {
    localStorage.setItem('streetlift-timer', JSON.stringify(value));
  }, [value]);
  useEffect(() => {
    if (!value.end) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [value.end]);
  const remaining = value.end ? Math.max(0, Math.ceil((value.end - now) / 1000)) : value.remaining;
  useEffect(() => {
    if (value.end && remaining === 0 && announced.current !== value.end) {
      announced.current = value.end;
      if (sound) alertRest();
      setValue((v) => ({ ...v, end: null, remaining: 0 }));
    }
  }, [remaining, value.end, sound, setValue]);
  if (!value.visible)
    return (
      <button
        className="timer-launch"
        aria-label="Ouvrir le chronomètre"
        onClick={() => setValue((v) => ({ ...v, visible: true }))}
      >
        <TimerIcon size={20} />
      </button>
    );
  return (
    <aside
      className={`timer ${remaining === 0 ? 'timer-done' : ''}`}
      aria-label="Chronomètre de repos"
    >
      <div className="timer-caption">
        <span>
          <TimerIcon size={14} />
          {remaining === 0 ? 'Repos terminé' : 'TEMPS DE REPOS'}
        </span>
        <IconButton
          label="Masquer le chronomètre"
          onClick={() => setValue((v) => ({ ...v, visible: false }))}
        >
          <X size={16} />
        </IconButton>
      </div>
      <div className="timer-controls">
        <button
          className="timer-adjust"
          onClick={() => {
            setNow(Date.now());
            setValue((v) => ({
              ...v,
              end: v.end ? Math.max(Date.now(), v.end - 30000) : null,
              remaining: Math.max(0, v.remaining - 30),
            }));
          }}
        >
          −30
        </button>
        <strong aria-live={remaining === 0 ? 'polite' : 'off'}>
          {String(Math.floor(remaining / 60)).padStart(2, '0')}
          <span>:</span>
          {String(remaining % 60).padStart(2, '0')}
        </strong>
        <button
          className="timer-adjust"
          onClick={() => {
            setNow(Date.now());
            setValue((v) => ({
              ...v,
              end: v.end ? v.end + 30000 : null,
              remaining: v.remaining + 30,
            }));
          }}
        >
          +30
        </button>
        <IconButton
          label={value.end ? 'Pause' : 'Démarrer le repos'}
          onClick={() => {
            unlockAudio();
            setNow(Date.now());
            setValue((v) =>
              v.end
                ? { ...v, end: null, remaining }
                : { ...v, end: Date.now() + (v.remaining || 180) * 1000 },
            );
          }}
        >
          {value.end ? <Pause size={19} /> : <Play size={19} />}
        </IconButton>
        <IconButton
          label="Réinitialiser le repos"
          onClick={() => setValue((v) => ({ ...v, end: null, remaining: 180 }))}
        >
          <RotateCcw size={17} />
        </IconButton>
      </div>
    </aside>
  );
}
