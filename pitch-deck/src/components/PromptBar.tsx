import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Box, ChevronDown, FileText, Mic, Plus, ScanLine, Sparkles, Loader2 } from 'lucide-react';

interface Props {
  onAddObject: () => void;
  onFiles: (kind: 'media' | 'doc', files: FileList) => void;
  onSubmit: (prompt: string, model: string) => void;
  busy: boolean;
}

const INSPIRATIONS = [
  'Make him wave at the camera',
  'Swap the bag for a yellow backpack',
  'Put him on a pastel city rooftop',
  'Add a soft rim light from behind',
];

const MODELS = ['Brainwave 2.5', 'Brainwave 2.0', 'Brainwave Lite'];

export function PromptBar(p: Props) {
  const [menu, setMenu] = useState<null | 'add' | 'inspire' | 'model'>(null);
  const [text, setText] = useState('');
  const [model, setModel] = useState(MODELS[0]);
  const [listening, setListening] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const media = useRef<HTMLInputElement>(null);
  const docs = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setMenu(null);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menu]);

  const submit = () => {
    if (!text.trim() || p.busy) return;
    p.onSubmit(text.trim(), model);
    setText('');
  };

  const toggle = (m: typeof menu) => setMenu((cur) => (cur === m ? null : m));

  return (
    <div className="prompt" ref={wrap}>
      <textarea
        rows={1}
        placeholder="Describe your scene..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <div className="prompt-row">
        <div className="prompt-left">
          <div className="anchor">
            <button className={`icon-btn outline ${menu === 'add' ? 'active' : ''}`} onClick={() => toggle('add')} aria-label="Add">
              <Plus size={16} />
            </button>
            {menu === 'add' && (
              <div className="menu add-menu" role="menu">
                <button role="menuitem" onClick={() => media.current?.click()}>
                  <ScanLine size={15} /> Add photos or videos
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    p.onAddObject();
                    setMenu(null);
                  }}
                >
                  <Box size={15} /> Add 3D objects
                </button>
                <button role="menuitem" onClick={() => docs.current?.click()}>
                  <FileText size={15} /> Add files (docs, txt...)
                </button>
              </div>
            )}
          </div>
          <div className="anchor">
            <button className={`chip ${menu === 'inspire' ? 'active' : ''}`} onClick={() => toggle('inspire')}>
              <Sparkles size={14} className="green" /> <span className="chip-label">Inspiration</span> <ChevronDown size={13} />
            </button>
            {menu === 'inspire' && (
              <div className="menu inspire-menu" role="menu">
                {INSPIRATIONS.map((s) => (
                  <button
                    key={s}
                    role="menuitem"
                    onClick={() => {
                      setText(s);
                      setMenu(null);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="prompt-right">
          <div className="anchor">
            <button className="model-btn" onClick={() => toggle('model')}>
              {model} <ChevronDown size={13} />
            </button>
            {menu === 'model' && (
              <div className="menu model-menu" role="menu">
                {MODELS.map((m) => (
                  <button
                    key={m}
                    role="menuitem"
                    className={m === model ? 'current' : ''}
                    onClick={() => {
                      setModel(m);
                      setMenu(null);
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className={`icon-btn ghost ${listening ? 'rec' : ''}`}
            onClick={() => setListening((l) => !l)}
            aria-label="Voice input"
            aria-pressed={listening}
          >
            <Mic size={16} />
          </button>
          <button className="icon-btn send" onClick={submit} disabled={!text.trim() || p.busy} aria-label="Send">
            {p.busy ? <Loader2 size={16} className="spin" /> : <ArrowUp size={16} />}
          </button>
        </div>
      </div>
      <input
        ref={media}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) p.onFiles('media', e.target.files);
          e.target.value = '';
          setMenu(null);
        }}
      />
      <input
        ref={docs}
        type="file"
        accept=".txt,.md,.pdf,.doc,.docx"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) p.onFiles('doc', e.target.files);
          e.target.value = '';
          setMenu(null);
        }}
      />
    </div>
  );
}
