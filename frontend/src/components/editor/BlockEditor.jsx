import { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import AssetPicker from './AssetPicker.jsx';
import api from '../../lib/api.js';

export default function BlockEditor({ block, onChange }) {
  const [content, setContent] = useState({});

  useEffect(() => {
    setContent(typeof block.content === 'string' ? JSON.parse(block.content) : block.content);
  }, [block.id]);

  function update(key, value) {
    const next = { ...content, [key]: value };
    setContent(next);
    onChange(next);
  }

  function updateMany(patch) {
    const next = { ...content, ...patch };
    setContent(next);
    onChange(next);
  }

  if (block.type === 'hero') return <HeroEditor content={content} update={update} />;
  if (block.type === 'grid') return <GridEditor content={content} update={update} updateMany={updateMany} />;
  if (block.type === 'text') return <TextEditor content={content} update={update} />;
  if (block.type === 'quote') return <QuoteEditor content={content} update={update} />;
  if (block.type === 'map') return <MapEditor content={content} update={update} onChange={onChange} setContent={setContent} />;
  if (block.type === 'video') return <VideoEditor content={content} update={update} />;
  if (block.type === 'divider') return <DividerEditor content={content} update={update} />;
  if (block.type === 'spacer') return <SpacerEditor content={content} update={update} />;
  return <p style={s.hint}>Sem editor para tipo "{block.type}"</p>;
}

/* ── shared field wrapper ───────────────────────────────────── */
function Field({ label, children }) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  );
}

/* ── Hero editor ─────────────────────────────────────────────── */
function HeroEditor({ content, update }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div style={s.form}>
      <h3 style={s.heading}>Hero</h3>

      <Field label="Imagem">
        <div style={s.assetRow}>
          <input style={s.input} value={content.asset_id || ''} placeholder="asset_id Immich"
            onChange={(e) => update('asset_id', e.target.value)} />
          <button style={s.btnPick} onClick={() => setPickerOpen(true)} title="Escolher da biblioteca">
            🖼
          </button>
        </div>
        {content.asset_id && (
          <img
            src={`/api/immich/assets/${content.asset_id}/thumb`}
            alt=""
            style={s.preview}
          />
        )}
      </Field>

      <Field label="Caption">
        <input style={s.input} value={content.caption || ''}
          onChange={(e) => update('caption', e.target.value)} placeholder="Texto opcional" />
      </Field>

      <Field label="Altura">
        <select style={s.input} value={content.height || 'full'} onChange={(e) => update('height', e.target.value)}>
          <option value="full">Full (100vh)</option>
          <option value="half">Half (50vh)</option>
          <option value="medium">Medium (340px)</option>
        </select>
      </Field>

      <Field label="Overlay">
        <label style={s.checkLabel}>
          <input type="checkbox" checked={!!content.overlay}
            onChange={(e) => update('overlay', e.target.checked)} />
          {' '}Gradiente por cima
        </label>
      </Field>

      {pickerOpen && (
        <AssetPicker
          multiple={false}
          initialSelected={content.asset_id ? [content.asset_id] : []}
          onSelect={(id) => update('asset_id', id)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

/* ── Grid editor ─────────────────────────────────────────────── */
const GRID_LAYOUTS = [
  { key: 'single',     label: 'Único',        icon: '▬',    cols: 1, aspect: 'landscape', hint: null },
  { key: 'duo',        label: 'Duo',          icon: '▮▮',   cols: 2, aspect: 'portrait',  hint: '2+ fotos' },
  { key: 'asymmetric', label: 'Assimétrico',  icon: '▬▪',   cols: 2, aspect: 'landscape', hint: '3+ fotos' },
  { key: 'grid3',      label: '3 colunas',    icon: '▪▪▪',  cols: 3, aspect: 'square',    hint: null },
  { key: 'grid4',      label: '4 colunas',    icon: '▪▪▪▪', cols: 4, aspect: 'square',    hint: null },
];

function getLayoutKey(columns, aspect) {
  if (columns === 1) return 'single';
  if (columns === 2 && aspect === 'portrait') return 'duo';
  if (columns === 2) return 'asymmetric';
  if (columns === 3) return 'grid3';
  return 'grid4';
}

function GridEditor({ content, update, updateMany }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const activeLayout = getLayoutKey(content.columns || 3, content.aspect || 'square');

  return (
    <div style={s.form}>
      <h3 style={s.heading}>Grid</h3>

      <Field label="Layout">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
          {GRID_LAYOUTS.map((l) => (
            <button
              key={l.key}
              title={l.hint ? `${l.label} (${l.hint})` : l.label}
              onClick={() => updateMany({ columns: l.cols, aspect: l.aspect })}
              style={{
                padding: '6px 2px',
                border: `1px solid ${activeLayout === l.key ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
                background: activeLayout === l.key ? 'var(--accent-pale, #f3f0ff)' : 'var(--surface)',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              }}
            >
              <span style={{ fontSize: 11, letterSpacing: '0.04em', color: activeLayout === l.key ? 'var(--accent)' : 'var(--text-muted)' }}>{l.icon}</span>
              <span style={{ fontSize: 9, color: 'var(--text-faint)', lineHeight: 1 }}>{l.label}</span>
            </button>
          ))}
        </div>
        {activeLayout === 'asymmetric' && (
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Requer 3 ou mais fotos para activar o layout assimétrico</p>
        )}
      </Field>

      <Field label={`Imagens (${(content.asset_ids || []).length})`}>
        <button style={s.btnPickFull} onClick={() => setPickerOpen(true)}>
          Seleccionar da biblioteca…
        </button>
        {(content.asset_ids || []).length > 0 && (
          <div style={s.thumbRow}>
            {content.asset_ids.slice(0, 6).map((id) => (
              <img key={id} src={`/api/immich/assets/${id}/thumb`} alt="" style={s.miniThumb} />
            ))}
            {content.asset_ids.length > 6 && (
              <span style={s.moreCount}>+{content.asset_ids.length - 6}</span>
            )}
          </div>
        )}
        <textarea
          style={{ ...s.input, height: 60, resize: 'vertical', fontFamily: 'monospace', fontSize: 11, marginTop: 8 }}
          value={(content.asset_ids || []).join('\n')}
          onChange={(e) => update('asset_ids', e.target.value.split('\n').map((l) => l.trim()).filter(Boolean))}
          placeholder="Ou cola asset IDs (um por linha)"
        />
      </Field>

      <Field label="Gap">
        <select style={s.input} value={content.gap || 'sm'} onChange={(e) => update('gap', e.target.value)}>
          <option value="sm">Pequeno</option>
          <option value="md">Médio</option>
          <option value="lg">Grande</option>
        </select>
      </Field>

      {pickerOpen && (
        <AssetPicker
          multiple={true}
          initialSelected={content.asset_ids || []}
          onSelect={(ids) => update('asset_ids', ids)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

/* ── Text editor ─────────────────────────────────────────────── */
function TextEditor({ content, update }) {
  return (
    <div style={s.form}>
      <h3 style={s.heading}>Texto</h3>

      <Field label="Markdown">
        <div data-color-mode="light">
          <MDEditor
            value={content.markdown || ''}
            onChange={(val) => update('markdown', val || '')}
            height={280}
            preview="edit"
          />
        </div>
      </Field>

      <Field label="Alinhamento">
        <select style={s.input} value={content.align || 'left'} onChange={(e) => update('align', e.target.value)}>
          <option value="left">Esquerda</option>
          <option value="center">Centro</option>
          <option value="right">Direita</option>
        </select>
      </Field>

      <Field label="Largura máxima">
        <select style={s.input} value={content.max_width || 'prose'} onChange={(e) => update('max_width', e.target.value)}>
          <option value="narrow">Estreita (45ch)</option>
          <option value="prose">Prose (65ch)</option>
          <option value="wide">Larga (100%)</option>
        </select>
      </Field>
    </div>
  );
}

/* ── Map editor ──────────────────────────────────────────────── */
function MapEditor({ content, update, onChange, setContent }) {
  const [resolving, setResolving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  async function resolveGPS() {
    const assetIds = content.asset_ids || [];
    if (!assetIds.length) return;
    setResolving(true);
    try {
      const results = await Promise.all(
        assetIds.map((id) => api.get(`/api/immich/assets/${id}/exif`).then((r) => ({ asset_id: id, ...r.data })).catch(() => ({ asset_id: id, lat: null, lng: null })))
      );
      const next = { ...content, resolved_markers: results.filter((r) => r.lat != null) };
      setContent(next);
      onChange(next);
    } finally {
      setResolving(false);
    }
  }

  return (
    <div style={s.form}>
      <h3 style={s.heading}>Mapa</h3>

      <Field label="Modo">
        <select style={s.input} value={content.mode || 'manual'} onChange={(e) => update('mode', e.target.value)}>
          <option value="manual">Manual (pin único)</option>
          <option value="auto">Auto (GPS dos assets)</option>
        </select>
      </Field>

      {(content.mode || 'manual') === 'manual' && (
        <>
          <Field label="Latitude">
            <input style={s.input} type="number" step="any" value={content.lat ?? ''} onChange={(e) => update('lat', parseFloat(e.target.value) || null)} placeholder="38.7169" />
          </Field>
          <Field label="Longitude">
            <input style={s.input} type="number" step="any" value={content.lng ?? ''} onChange={(e) => update('lng', parseFloat(e.target.value) || null)} placeholder="-9.1399" />
          </Field>
          <Field label="Zoom">
            <input style={s.input} type="number" min="1" max="18" value={content.zoom ?? 12} onChange={(e) => update('zoom', parseInt(e.target.value) || 12)} />
          </Field>
          <Field label="Etiqueta">
            <input style={s.input} value={content.label || ''} onChange={(e) => update('label', e.target.value)} placeholder="Lisboa" />
          </Field>
        </>
      )}

      {content.mode === 'auto' && (
        <>
          <Field label={`Assets GPS (${(content.asset_ids || []).length})`}>
            <button style={s.btnPickFull} onClick={() => setPickerOpen(true)}>Seleccionar assets…</button>
            {(content.resolved_markers || []).length > 0 && (
              <p style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{content.resolved_markers.length} ponto(s) resolvido(s)</p>
            )}
          </Field>
          <button style={s.btnPickFull} onClick={resolveGPS} disabled={resolving || !(content.asset_ids || []).length}>
            {resolving ? 'A resolver GPS...' : '📍 Resolver coordenadas GPS'}
          </button>
          <Field label="Mostrar rota">
            <label style={s.checkLabel}>
              <input type="checkbox" checked={!!content.show_route} onChange={(e) => update('show_route', e.target.checked)} />
              {' '}Ligar pontos com linha
            </label>
          </Field>
          <Field label="Cor da rota">
            <input style={{ ...s.input, padding: 2, height: 34 }} type="color" value={content.route_color || '#E07B54'} onChange={(e) => update('route_color', e.target.value)} />
          </Field>
        </>
      )}

      {pickerOpen && (
        <AssetPicker multiple={true} initialSelected={content.asset_ids || []}
          onSelect={(ids) => update('asset_ids', ids)} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  );
}

/* ── Video editor ─────────────────────────────────────────────── */
function VideoEditor({ content, update }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div style={s.form}>
      <h3 style={s.heading}>Vídeo</h3>
      <Field label="Asset ID">
        <div style={s.assetRow}>
          <input style={s.input} value={content.asset_id || ''} onChange={(e) => update('asset_id', e.target.value)} placeholder="asset_id Immich" />
          <button style={s.btnPick} onClick={() => setPickerOpen(true)} title="Escolher">🎬</button>
        </div>
      </Field>
      <Field label="Caption">
        <input style={s.input} value={content.caption || ''} onChange={(e) => update('caption', e.target.value)} placeholder="Legenda opcional" />
      </Field>
      <Field label="Opções">
        <label style={s.checkLabel}>
          <input type="checkbox" checked={!!content.autoplay} onChange={(e) => update('autoplay', e.target.checked)} />
          {' '}Autoplay
        </label>
        <label style={{ ...s.checkLabel, marginTop: 6 }}>
          <input type="checkbox" checked={!!content.loop} onChange={(e) => update('loop', e.target.checked)} />
          {' '}Loop
        </label>
      </Field>
      {pickerOpen && (
        <AssetPicker multiple={false} initialSelected={content.asset_id ? [content.asset_id] : []}
          onSelect={(id) => update('asset_id', id)} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  );
}

/* ── Quote editor ─────────────────────────────────────────────── */
function QuoteEditor({ content, update }) {
  return (
    <div style={s.form}>
      <h3 style={s.heading}>Citação</h3>
      <Field label="Texto da citação">
        <textarea
          style={{ ...s.input, height: 100, resize: 'vertical' }}
          value={content.quote || ''}
          onChange={(e) => update('quote', e.target.value)}
          placeholder="Uma frase memorável…"
        />
      </Field>
      <Field label="Autor (opcional)">
        <input
          style={s.input}
          value={content.author || ''}
          onChange={(e) => update('author', e.target.value)}
          placeholder="Nome do autor"
        />
      </Field>
    </div>
  );
}

/* ── Spacer editor ────────────────────────────────────────────── */
function SpacerEditor({ content, update }) {
  return (
    <div style={s.form}>
      <h3 style={s.heading}>Espaço</h3>
      <Field label="Altura">
        <select style={s.input} value={content.height || 'md'} onChange={(e) => update('height', e.target.value)}>
          <option value="sm">Pequeno (40px)</option>
          <option value="md">Médio (80px)</option>
          <option value="lg">Grande (140px)</option>
        </select>
      </Field>
    </div>
  );
}

/* ── Divider editor ───────────────────────────────────────────── */
function DividerEditor({ content, update }) {
  return (
    <div style={s.form}>
      <h3 style={s.heading}>Divisor</h3>
      <Field label="Etiqueta">
        <input style={s.input} value={content.label || ''} onChange={(e) => update('label', e.target.value)} placeholder="2024 · Verão" />
      </Field>
      <Field label="Estilo">
        <select style={s.input} value={content.style || 'line'} onChange={(e) => update('style', e.target.value)}>
          <option value="line">Linha</option>
          <option value="space">Espaço</option>
        </select>
      </Field>
    </div>
  );
}

/* ── styles ──────────────────────────────────────────────────── */
const s = {
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  heading: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    textTransform: 'capitalize',
    marginBottom: 2,
    color: 'var(--text)',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: {
    fontSize: 10,
    color: 'var(--text-faint)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    fontWeight: 600,
  },
  input: {
    padding: '7px 10px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 13,
    width: '100%',
    background: 'var(--surface)',
    color: 'var(--text)',
    outline: 'none',
    transition: 'border-color 0.12s, box-shadow 0.12s',
  },
  assetRow: { display: 'flex', gap: 6 },
  btnPick: {
    padding: '7px 10px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: '#f9fafb',
    fontSize: 14,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 0.12s',
  },
  btnPickFull: {
    padding: '8px 12px',
    border: '1px dashed var(--border-strong)',
    borderRadius: 'var(--radius-sm)',
    background: '#f9fafb',
    fontSize: 12,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'center',
    fontWeight: 500,
    transition: 'background 0.12s, border-color 0.12s',
  },
  preview: {
    width: '100%',
    aspectRatio: '16/9',
    objectFit: 'cover',
    borderRadius: 'var(--radius-sm)',
    marginTop: 6,
    background: '#f3f4f6',
  },
  thumbRow: { display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 },
  miniThumb: { width: 36, height: 36, objectFit: 'cover', borderRadius: 5 },
  moreCount: {
    width: 36,
    height: 36,
    background: '#f3f4f6',
    borderRadius: 5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  checkLabel: { fontSize: 13, display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text)' },
  hint: { color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', marginTop: 16 },
};
