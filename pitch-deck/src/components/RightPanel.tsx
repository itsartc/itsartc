import { useState } from 'react';
import { Clock, Plus, X, Pause, Play } from 'lucide-react';
import type { CameraMode, MaterialPreset, StylePreset } from '../scene/engine';

interface Props {
  material: MaterialPreset | null;
  onMaterial: (m: MaterialPreset) => void;
  style: StylePreset;
  onStyle: (s: StylePreset) => void;
  bg: string;
  bgOpacity: number;
  onBg: (hex: string, opacity: number) => void;
  cameraMode: CameraMode;
  onCameraMode: (m: CameraMode) => void;
  distortion: number;
  onDistortion: (v: number) => void;
  duration: number;
  onDuration: (s: number) => void;
  animations: { idle: boolean; wave: boolean };
  onAnimation: (k: 'idle' | 'wave', v: boolean) => void;
  playing: boolean;
  onPlay: () => void;
  onShare: () => void;
  onClose?: () => void;
  selectedName: string | null;
}

const MATERIALS: { id: MaterialPreset; label: string }[] = [
  { id: 'matte', label: 'Matte clay' },
  { id: 'copper', label: 'Copper' },
  { id: 'rubber', label: 'Rubber' },
  { id: 'gloss', label: 'Gloss black' },
];

export function RightPanel(p: Props) {
  const [tab, setTab] = useState<'design' | 'animation'>('design');
  const [hexDraft, setHexDraft] = useState<string | null>(null);

  const commitHex = (v: string) => {
    const clean = v.replace('#', '').trim();
    if (/^[0-9a-fA-F]{6}$/.test(clean)) p.onBg('#' + clean.toUpperCase(), p.bgOpacity);
    setHexDraft(null);
  };

  return (
    <aside className="panel right-panel">
      <div className="right-top">
        <div className="avatars">
          <span className="avatar a1">SA</span>
          <span className="avatar a2">JK</span>
        </div>
        <div className="right-top-actions">
          <button className="btn" onClick={p.onShare}>
            Share
          </button>
          {p.onClose && (
            <button className="icon-btn ghost drawer-close" onClick={p.onClose} aria-label="Close panel">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="segmented">
        <button className={tab === 'design' ? 'active' : ''} onClick={() => setTab('design')}>
          Design
        </button>
        <button className={tab === 'animation' ? 'active' : ''} onClick={() => setTab('animation')}>
          Animation
        </button>
      </div>

      {tab === 'design' ? (
        <div className="right-scroll">
          <section className="section">
            <header>
              <h4>Materials</h4>
              <button className="icon-btn ghost sm" aria-label="Add material">
                <Plus size={14} />
              </button>
            </header>
            <div className="swatch-grid">
              {MATERIALS.map((m) => (
                <button
                  key={m.id}
                  className={`swatch ${p.material === m.id ? 'active' : ''}`}
                  onClick={() => p.onMaterial(m.id)}
                  title={`${m.label}${p.selectedName ? ` → ${p.selectedName}` : ''}`}
                  aria-label={m.label}
                >
                  <span className={`sphere ${m.id}`} />
                </button>
              ))}
            </div>
            <p className="hint">{p.selectedName ? `Applies to ${p.selectedName}` : 'Select an object to apply'}</p>
          </section>

          <section className="section">
            <header>
              <h4>Styles</h4>
              <button className="icon-btn ghost sm" aria-label="Add style">
                <Plus size={14} />
              </button>
            </header>
            <div className="style-grid">
              <button
                className={`style-card pastel ${p.style === 'pastel' ? 'active' : ''}`}
                onClick={() => p.onStyle(p.style === 'pastel' ? 'none' : 'pastel')}
                aria-label="Pastel architecture style"
              >
                <span className="blk b1" />
                <span className="blk b2" />
                <span className="blk b3" />
                <span className="blk b4" />
              </button>
              <button
                className={`style-card sunset ${p.style === 'sunset' ? 'active' : ''}`}
                onClick={() => p.onStyle(p.style === 'sunset' ? 'none' : 'sunset')}
                aria-label="Synth sunset style"
              >
                <span className="sun" />
                <span className="sea" />
                <svg className="sil" viewBox="0 0 40 30" aria-hidden>
                  <path d="M14 30c0-6 1-9 3-11 1-1 1-3 0-4-1-2 0-5 3-5s4 3 3 5c-1 1-1 3 1 4 3 2 4 6 4 11z" fill="#241634" />
                </svg>
              </button>
            </div>
          </section>

          <section className="section">
            <header>
              <h4>Background</h4>
              <button className="icon-btn ghost sm" aria-label="Add background">
                <Plus size={14} />
              </button>
            </header>
            <div className="field-row">
              <label className="color-chip" style={{ background: p.bg }}>
                <input type="color" value={p.bg} onChange={(e) => p.onBg(e.target.value.toUpperCase(), p.bgOpacity)} aria-label="Background color" />
              </label>
              <input
                className="hex"
                value={hexDraft ?? p.bg.replace('#', '')}
                onChange={(e) => setHexDraft(e.target.value)}
                onBlur={(e) => commitHex(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                maxLength={7}
                aria-label="Hex color"
              />
              <span className="sep" />
              <input
                className="pct"
                type="number"
                min={0}
                max={100}
                value={Math.round(p.bgOpacity * 100)}
                onChange={(e) => p.onBg(p.bg, Math.max(0, Math.min(100, Number(e.target.value))) / 100)}
                aria-label="Opacity"
              />
              <span className="unit">%</span>
            </div>
          </section>

          <section className="section">
            <header>
              <h4>Camera</h4>
              <button className="icon-btn ghost sm" aria-label="Add camera">
                <Plus size={14} />
              </button>
            </header>
            <div className="segmented small">
              <button className={p.cameraMode === 'isometric' ? 'active' : ''} onClick={() => p.onCameraMode('isometric')}>
                Isometric
              </button>
              <button className={p.cameraMode === 'perspective' ? 'active' : ''} onClick={() => p.onCameraMode('perspective')}>
                Perspective
              </button>
            </div>
            <div className="label">Distortion</div>
            <div className="field-row">
              <label className={`slider ${p.cameraMode === 'isometric' ? 'disabled' : ''}`}>
                <span className="fill" style={{ width: `${p.distortion * 100}%` }} />
                <span className="thumb" style={{ left: `${p.distortion * 100}%` }} />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={p.distortion}
                  onChange={(e) => p.onDistortion(Number(e.target.value))}
                  aria-label="Distortion"
                />
              </label>
              <button
                className="time-chip"
                onClick={() => p.onDuration(p.duration === 4 ? 8 : p.duration === 8 ? 12 : 4)}
                title="Turntable duration"
              >
                <Clock size={12} /> {p.duration}s
              </button>
            </div>
          </section>
        </div>
      ) : (
        <div className="right-scroll">
          <section className="section">
            <header>
              <h4>Turntable</h4>
            </header>
            <button className="btn wide" onClick={p.onPlay}>
              {p.playing ? <Pause size={14} /> : <Play size={14} />} {p.playing ? 'Stop' : `Play ${p.duration}s spin`}
            </button>
          </section>
          <section className="section">
            <header>
              <h4>Motion</h4>
            </header>
            <label className="toggle-row">
              <span>Idle breathing</span>
              <input type="checkbox" checked={p.animations.idle} onChange={(e) => p.onAnimation('idle', e.target.checked)} />
              <span className="switch" />
            </label>
            <label className="toggle-row">
              <span>Wave hello</span>
              <input type="checkbox" checked={p.animations.wave} onChange={(e) => p.onAnimation('wave', e.target.checked)} />
              <span className="switch" />
            </label>
          </section>
          <section className="section">
            <header>
              <h4>Timeline</h4>
            </header>
            <div className="timeline">
              {Array.from({ length: 12 }).map((_, i) => (
                <span key={i} className={`tick ${i % 3 === 0 ? 'key' : ''}`} />
              ))}
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}
