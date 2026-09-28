import { useEffect, useRef, useState } from 'react';
import {
  Box,
  ChevronDown,
  Eye,
  EyeOff,
  Lightbulb,
  Lock,
  LockOpen,
  PanelLeft,
  ScanLine,
  Search,
  Sparkles,
  Sun,
  Grid2x2,
  Image as ImageIcon,
  FileText,
  Shapes,
} from 'lucide-react';
import type { LayerDef } from '../scene/engine';
import { Logo } from './Logo';

export interface LayerState extends LayerDef {
  visible: boolean;
  locked: boolean;
}

const kindIcon = {
  camera: ScanLine,
  dome: Sun,
  key: Lightbulb,
  area: Grid2x2,
  object: Box,
};

interface Props {
  layers: LayerState[];
  selected: string | null;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onFocus: (id: string) => void;
  onCollapse: () => void;
  projectName: string;
  onRename: (name: string) => void;
}

const ASSETS = [
  { name: 'Boy_character.glb', icon: Shapes, meta: '2.4 MB' },
  { name: 'Crossbody_bag.glb', icon: Shapes, meta: '380 KB' },
  { name: 'Studio_HDRI.exr', icon: ImageIcon, meta: '6.1 MB' },
  { name: 'Clay_skin.mat', icon: Sparkles, meta: 'Material' },
  { name: 'Brief.txt', icon: FileText, meta: '4 KB' },
];

export function LeftPanel(p: Props) {
  const [tab, setTab] = useState<'scene' | 'assets'>('scene');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const q = query.trim().toLowerCase();
  const layers = p.layers.filter((l) => l.name.toLowerCase().includes(q));
  const assets = ASSETS.filter((a) => a.name.toLowerCase().includes(q));

  return (
    <aside className="panel left-panel">
      <div className="panel-head">
        <div className="brand">
          <Logo />
          <button className="icon-btn ghost" onClick={p.onCollapse} aria-label="Collapse panel">
            <PanelLeft size={16} />
          </button>
        </div>
        {editing ? (
          <input
            className="project-input"
            autoFocus
            defaultValue={p.projectName}
            onBlur={(e) => {
              p.onRename(e.target.value || p.projectName);
              setEditing(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        ) : (
          <button className="project-name" onClick={() => setEditing(true)} title="Rename project">
            {p.projectName} <ChevronDown size={14} />
          </button>
        )}
        <div className="project-sub">3D Design Project</div>
      </div>

      <div className="divider" />

      <div className="segmented">
        <button className={tab === 'scene' ? 'active' : ''} onClick={() => setTab('scene')}>
          Scene
        </button>
        <button className={tab === 'assets' ? 'active' : ''} onClick={() => setTab('assets')}>
          Assets
        </button>
      </div>

      <div className="divider" />

      <div className="layer-list">
        {tab === 'scene' &&
          layers.map((l) => {
            const Icon = kindIcon[l.kind];
            const sel = p.selected === l.id;
            return (
              <div
                key={l.id}
                className={`layer ${sel ? 'selected' : ''} ${l.visible ? '' : 'hidden'}`}
                onClick={() => p.onSelect(l.id)}
                onDoubleClick={() => p.onFocus(l.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && p.onSelect(l.id)}
              >
                <span className="layer-icon">
                  <Icon size={14} strokeWidth={1.8} />
                </span>
                <span className="layer-name">{l.name}</span>
                <span className="layer-actions">
                  <button
                    className={`mini ${l.locked ? 'on' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      p.onToggleLock(l.id);
                    }}
                    aria-label={l.locked ? 'Unlock' : 'Lock'}
                  >
                    {l.locked ? <Lock size={13} /> : <LockOpen size={13} />}
                  </button>
                  <button
                    className={`mini ${!l.visible ? 'on' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      p.onToggleVisible(l.id);
                    }}
                    aria-label={l.visible ? 'Hide' : 'Show'}
                  >
                    {l.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <button
                    className="mini"
                    onClick={(e) => {
                      e.stopPropagation();
                      p.onFocus(l.id);
                    }}
                    aria-label="Focus"
                  >
                    <Sparkles size={13} />
                  </button>
                </span>
              </div>
            );
          })}
        {tab === 'assets' &&
          assets.map((a) => (
            <div key={a.name} className="layer asset">
              <span className="layer-icon">
                <a.icon size={14} strokeWidth={1.8} />
              </span>
              <span className="layer-name">{a.name}</span>
              <span className="asset-meta">{a.meta}</span>
            </div>
          ))}
        {((tab === 'scene' && !layers.length) || (tab === 'assets' && !assets.length)) && (
          <div className="empty">No results for “{query}”</div>
        )}
      </div>

      <label className="search">
        <Search size={14} />
        <input ref={searchRef} placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <kbd>⌘K</kbd>
      </label>
    </aside>
  );
}
