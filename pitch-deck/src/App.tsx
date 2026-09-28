import { useCallback, useEffect, useRef, useState } from 'react';
import { Layers, SlidersHorizontal, PanelLeft, X } from 'lucide-react';
import { SceneEngine, type CameraMode, type LayerDef, type MaterialPreset, type StylePreset } from './scene/engine';
import { LeftPanel, type LayerState } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { Toolbar, type Tool } from './components/Toolbar';
import { PromptBar } from './components/PromptBar';

const INITIAL_LAYERS: LayerState[] = (
  [
    { id: 'camera', name: 'Camera 1', kind: 'camera' },
    { id: 'dome', name: 'Dome Light', kind: 'dome' },
    { id: 'key', name: 'Key Light', kind: 'key' },
    { id: 'area', name: 'Area Light', kind: 'area' },
    { id: 'object2', name: 'Object 2', kind: 'object' },
    { id: 'bg2', name: 'Background 2', kind: 'object' },
    { id: 'character', name: 'Character', kind: 'object' },
    { id: 'bg1', name: 'Background 1', kind: 'object' },
  ] as LayerDef[]
).map((l) => ({ ...l, visible: true, locked: false }));

/** Everything that participates in undo / redo. */
interface Look {
  layers: LayerState[];
  materials: Record<string, MaterialPreset | null>;
  style: StylePreset;
  bg: string;
  bgOpacity: number;
  cameraMode: CameraMode;
  distortion: number;
}

const INITIAL_LOOK: Look = {
  layers: INITIAL_LAYERS,
  materials: {},
  style: 'none',
  bg: '#F8F7F7',
  bgOpacity: 1,
  cameraMode: 'isometric',
  distortion: 0.3,
};

interface Toast {
  id: number;
  text: string;
}

interface Pin {
  id: number;
  x: number;
  y: number;
  text: string;
}

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SceneEngine | null>(null);

  const [hist, setHist] = useState<{ past: Look[]; present: Look; future: Look[] }>({
    past: [],
    present: INITIAL_LOOK,
    future: [],
  });
  const look = hist.present;
  const past = hist.past;
  const future = hist.future;
  /** Update the look without recording history (e.g. while dragging a slider). */
  const setLook = useCallback((fn: (l: Look) => Look) => setHist((h) => ({ ...h, present: fn(h.present) })), []);

  const [selected, setSelected] = useState<string | null>('object2');
  const [projectName, setProjectName] = useState('3D Boy Character');
  const [tool, setTool] = useState<Tool>('select');
  const [zoom, setZoom] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(8);
  const [animations, setAnimations] = useState({ idle: true, wave: false });
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  /** Commit a new look, recording history. */
  const commit = useCallback((fn: (l: Look) => Look) => {
    setHist((h) => {
      const next = fn(h.present);
      if (next === h.present) return h;
      return { past: [...h.past.slice(-49), h.present], present: next, future: [] };
    });
  }, []);

  // ---------- Engine lifecycle ----------
  useEffect(() => {
    const engine = new SceneEngine(hostRef.current!);
    engineRef.current = engine;
    engine.onSelect = (id) => setSelected(id);
    engine.onTurntableEnd = () => setPlaying(false);
    const syncZoom = () => setZoom(engine.zoom);
    engine.controls.addEventListener('change', syncZoom);
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // ---------- Sync look → engine ----------
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    look.layers.forEach((l) => {
      e.setVisible(l.id, l.visible);
      e.setLocked(l.id, l.locked);
    });
  }, [look.layers]);

  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    for (const l of look.layers) {
      e.setLocked(l.id, false);
      e.applyMaterial(l.id, look.materials[l.id] ?? null);
      e.setLocked(l.id, l.locked);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [look.materials]);

  useEffect(() => engineRef.current?.setStyle(look.style), [look.style]);
  useEffect(() => engineRef.current?.setBackground(look.bg, look.bgOpacity), [look.bg, look.bgOpacity]);
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    e.setCameraMode(look.cameraMode);
    e.controls.addEventListener('change', () => setZoom(e.zoom));
    e.setZoom(zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [look.cameraMode]);
  useEffect(() => engineRef.current?.setDistortion(look.distortion), [look.distortion]);
  useEffect(() => {
    if (engineRef.current) engineRef.current.animations = { ...animations };
  }, [animations]);
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    e.controls.enableRotate = tool === 'select' || tool === 'orbit';
    e.controls.enablePan = tool === 'orbit';
  }, [tool, look.cameraMode]);

  // ---------- Actions ----------
  const undo = useCallback(
    () =>
      setHist((h) =>
        h.past.length
          ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] }
          : h,
      ),
    [],
  );

  const redo = useCallback(
    () =>
      setHist((h) =>
        h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h,
      ),
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea')) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (!mod) {
        const map: Record<string, Tool> = { v: 'select', h: 'orbit', c: 'comment', f: 'crop' };
        if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
        if (e.key === 'Escape') {
          setLeftOpen(false);
          setRightOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const updateLayer = (id: string, patch: Partial<LayerState>) =>
    commit((l) => ({ ...l, layers: l.layers.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

  const selectedLayer = look.layers.find((l) => l.id === selected) ?? null;
  const materialTarget =
    selectedLayer && !['camera', 'dome', 'key', 'area', 'bg1', 'bg2'].includes(selectedLayer.id) ? selectedLayer : null;

  const onMaterial = (m: MaterialPreset) => {
    if (!materialTarget) return toast('Select an object layer first');
    if (materialTarget.locked) return toast(`${materialTarget.name} is locked`);
    commit((l) => ({
      ...l,
      materials: { ...l.materials, [materialTarget.id]: l.materials[materialTarget.id] === m ? null : m },
    }));
  };

  const togglePlay = () => {
    const e = engineRef.current;
    if (!e) return;
    if (playing) {
      e.stopTurntable();
      setPlaying(false);
    } else {
      e.playTurntable(duration);
      setPlaying(true);
    }
  };

  const onExport = () => {
    const e = engineRef.current;
    if (!e) return;
    const a = document.createElement('a');
    a.href = e.exportPNG();
    a.download = `${projectName.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
    toast('Exported PNG');
  };

  const onShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: projectName, url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Link copied to clipboard');
      }
    } catch {
      /* dismissed */
    }
  };

  const onAddObject = () => {
    const e = engineRef.current;
    if (!e) return;
    const def = e.addObject();
    commit((l) => ({ ...l, layers: [...l.layers, { ...def, visible: true, locked: false }] }));
    setSelected(def.id);
    toast(`${def.name} added to scene`);
  };

  const onSubmit = (prompt: string, model: string) => {
    setBusy(true);
    const lower = prompt.toLowerCase();
    setTimeout(() => {
      setBusy(false);
      if (/wave|hello|hi\b/.test(lower)) {
        setAnimations((a) => ({ ...a, wave: true }));
        toast(`${model}: he's waving 👋`);
      } else if (/sunset|pink|evening/.test(lower)) {
        commit((l) => ({ ...l, style: 'sunset' }));
        toast(`${model}: applied sunset style`);
      } else if (/pastel|city|rooftop|architect/.test(lower)) {
        commit((l) => ({ ...l, style: 'pastel' }));
        toast(`${model}: applied pastel style`);
      } else if (/spin|turn|rotate/.test(lower)) {
        togglePlay();
      } else if (/object|add|cube|sphere/.test(lower)) {
        onAddObject();
      } else {
        toast(`${model}: scene updated`);
      }
    }, 1100);
  };

  const onViewportClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (tool !== 'comment') return;
    if ((e.target as HTMLElement).closest('.pin, .prompt, .toolbar, .mobile-bar')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setPins((p) => [...p, { id: Date.now(), x: e.clientX - rect.left, y: e.clientY - rect.top, text: '' }]);
  };

  const closeDrawers = () => {
    setLeftOpen(false);
    setRightOpen(false);
  };

  return (
    <div className={`app ${leftCollapsed ? 'left-collapsed' : ''} ${leftOpen ? 'left-open' : ''} ${rightOpen ? 'right-open' : ''}`}>
      <div className="left-slot">
        <LeftPanel
          layers={look.layers}
          selected={selected}
          onSelect={(id) => {
            setSelected(id);
            if (window.matchMedia('(max-width: 1099px)').matches) setLeftOpen(false);
          }}
          onToggleVisible={(id) => {
            const l = look.layers.find((x) => x.id === id)!;
            updateLayer(id, { visible: !l.visible });
          }}
          onToggleLock={(id) => {
            const l = look.layers.find((x) => x.id === id)!;
            updateLayer(id, { locked: !l.locked });
          }}
          onFocus={(id) => {
            setSelected(id);
            engineRef.current?.resetView();
          }}
          onCollapse={() => {
            if (window.matchMedia('(max-width: 1099px)').matches) setLeftOpen(false);
            else setLeftCollapsed(true);
          }}
          projectName={projectName}
          onRename={setProjectName}
        />
      </div>

      <main className={`stage tool-${tool}`} onClick={onViewportClick}>
        <div className="viewport" ref={hostRef} />

        {leftCollapsed && (
          <button className="icon-btn floating expand-left" onClick={() => setLeftCollapsed(false)} aria-label="Show layers">
            <PanelLeft size={16} />
          </button>
        )}

        <div className="mobile-bar">
          <button className="icon-btn floating" onClick={() => setLeftOpen(true)} aria-label="Open layers">
            <Layers size={16} />
          </button>
          <div className="mobile-title">{projectName}</div>
          <button className="icon-btn floating" onClick={() => setRightOpen(true)} aria-label="Open design panel">
            <SlidersHorizontal size={16} />
          </button>
        </div>

        <Toolbar
          tool={tool}
          onTool={setTool}
          zoom={zoom}
          onZoom={(z) => {
            engineRef.current?.setZoom(z);
            setZoom(z);
          }}
          onFit={() => {
            engineRef.current?.setZoom(1);
            engineRef.current?.resetView();
            setZoom(1);
          }}
          playing={playing}
          onPlay={togglePlay}
          canUndo={past.length > 0}
          canRedo={future.length > 0}
          onUndo={undo}
          onRedo={redo}
          onExport={onExport}
        />

        {tool === 'crop' && (
          <div className="frame-guide" aria-hidden>
            <span className="corner tl" />
            <span className="corner tr" />
            <span className="corner bl" />
            <span className="corner br" />
            <span className="frame-label">4 : 5 · Social</span>
          </div>
        )}

        {pins.map((pin, i) => (
          <div key={pin.id} className="pin" style={{ left: pin.x, top: pin.y }}>
            <span className="pin-dot">{i + 1}</span>
            <div className="pin-card">
              <input
                autoFocus={!pin.text}
                placeholder="Add a comment…"
                value={pin.text}
                onChange={(e) => setPins((ps) => ps.map((p) => (p.id === pin.id ? { ...p, text: e.target.value } : p)))}
              />
              <button className="mini" onClick={() => setPins((ps) => ps.filter((p) => p.id !== pin.id))} aria-label="Delete comment">
                <X size={12} />
              </button>
            </div>
          </div>
        ))}

        <PromptBar
          busy={busy}
          onAddObject={onAddObject}
          onSubmit={onSubmit}
          onFiles={(kind, files) =>
            toast(`${files.length} ${kind === 'media' ? 'media file' : 'document'}${files.length > 1 ? 's' : ''} attached`)
          }
        />

        <div className="toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="toast">
              {t.text}
            </div>
          ))}
        </div>
      </main>

      <div className="right-slot">
        <RightPanel
          material={materialTarget ? look.materials[materialTarget.id] ?? null : null}
          onMaterial={onMaterial}
          style={look.style}
          onStyle={(s) => commit((l) => ({ ...l, style: s }))}
          bg={look.bg}
          bgOpacity={look.bgOpacity}
          onBg={(hex, o) => commit((l) => (l.bg === hex && l.bgOpacity === o ? l : { ...l, bg: hex, bgOpacity: o }))}
          cameraMode={look.cameraMode}
          onCameraMode={(m) => commit((l) => (l.cameraMode === m ? l : { ...l, cameraMode: m }))}
          distortion={look.distortion}
          onDistortion={(v) => setLook((l) => ({ ...l, distortion: v }))}
          duration={duration}
          onDuration={setDuration}
          animations={animations}
          onAnimation={(k, v) => setAnimations((a) => ({ ...a, [k]: v }))}
          playing={playing}
          onPlay={togglePlay}
          onShare={onShare}
          onClose={() => setRightOpen(false)}
          selectedName={materialTarget?.name ?? null}
        />
      </div>

      <div className="scrim" onClick={closeDrawers} />
    </div>
  );
}
