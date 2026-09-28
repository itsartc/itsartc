import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, Crop, Hand, MessageSquare, MousePointer2, Play, Square } from 'lucide-react';

export type Tool = 'select' | 'orbit' | 'comment' | 'crop';

interface Props {
  tool: Tool;
  onTool: (t: Tool) => void;
  zoom: number;
  onZoom: (z: number) => void;
  onFit: () => void;
  playing: boolean;
  onPlay: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
}

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function Toolbar(p: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  const tools: { id: Tool; icon: typeof Hand; label: string }[] = [
    { id: 'select', icon: MousePointer2, label: 'Select (V)' },
    { id: 'orbit', icon: Hand, label: 'Orbit (H)' },
    { id: 'comment', icon: MessageSquare, label: 'Comment (C)' },
    { id: 'crop', icon: Crop, label: 'Frame (F)' },
  ];

  return (
    <div className="toolbar">
      <div className="tool-group">
        {tools.map((t) => (
          <button
            key={t.id}
            className={`icon-btn ${p.tool === t.id ? 'active' : ''}`}
            onClick={() => p.onTool(t.id)}
            title={t.label}
            aria-label={t.label}
          >
            <t.icon size={16} strokeWidth={1.8} />
          </button>
        ))}
        <button className={`icon-btn ${p.playing ? 'active' : ''}`} onClick={p.onPlay} title="Play turntable" aria-label="Play">
          {p.playing ? <Square size={14} strokeWidth={2} /> : <Play size={16} strokeWidth={1.8} />}
        </button>
      </div>

      <div className="zoom" ref={ref}>
        <button className="zoom-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
          {Math.round(p.zoom * 100)}% <ChevronDown size={13} />
        </button>
        {open && (
          <div className="menu zoom-menu" role="menu">
            {ZOOMS.map((z) => (
              <button
                key={z}
                role="menuitem"
                onClick={() => {
                  p.onZoom(z);
                  setOpen(false);
                }}
              >
                {z * 100}%
              </button>
            ))}
            <button
              role="menuitem"
              onClick={() => {
                p.onFit();
                setOpen(false);
              }}
            >
              Zoom to fit
            </button>
          </div>
        )}
      </div>

      <div className="tool-group history">
        <button className="icon-btn" disabled={!p.canUndo} onClick={p.onUndo} aria-label="Undo">
          <ArrowLeft size={16} />
        </button>
        <button className="icon-btn" disabled={!p.canRedo} onClick={p.onRedo} aria-label="Redo">
          <ArrowRight size={16} />
        </button>
      </div>

      <button className="btn export" onClick={p.onExport}>
        Export
      </button>
    </div>
  );
}
