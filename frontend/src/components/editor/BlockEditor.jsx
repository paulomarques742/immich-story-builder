import { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import AssetPicker from './AssetPicker.jsx';

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

  if (block.type === 'hero') return <HeroEditor content={content} update={update} />;
  if (block.type === 'grid') return <GridEditor content={content} update={update} />;
  if (block.type === 'text') return <TextEditor content={content} update={update} />;
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
function GridEditor({ content, update }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  function handlePickerSelect(ids) {
    update('asset_ids', ids);
  }

  return (
    <div style={s.form}>
      <h3 style={s.heading}>Grid</h3>

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
          style={{ ...s.input, height: 80, resize: 'vertical', fontFamily: 'monospace', fontSize: 11, marginTop: 8 }}
          value={(content.asset_ids || []).join('\n')}
          onChange={(e) => update('asset_ids', e.target.value.split('\n').map((l) => l.trim()).filter(Boolean))}
          placeholder="Ou cola asset IDs (um por linha)"
        />
      </Field>

      <Field label="Colunas">
        <select style={s.input} value={content.columns || 3} onChange={(e) => update('columns', Number(e.target.value))}>
          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </Field>

      <Field label="Gap">
        <select style={s.input} value={content.gap || 'sm'} onChange={(e) => update('gap', e.target.value)}>
          <option value="sm">Pequeno</option>
          <option value="md">Médio</option>
          <option value="lg">Grande</option>
        </select>
      </Field>

      <Field label="Proporção">
        <select style={s.input} value={content.aspect || 'square'} onChange={(e) => update('aspect', e.target.value)}>
          <option value="square">Quadrado</option>
          <option value="landscape">Paisagem</option>
          <option value="portrait">Retrato</option>
        </select>
      </Field>

      {pickerOpen && (
        <AssetPicker
          multiple={true}
          initialSelected={content.asset_ids || []}
          onSelect={handlePickerSelect}
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

/* ── styles ──────────────────────────────────────────────────── */
const s = {
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  heading: { fontSize: 14, fontWeight: 700, textTransform: 'capitalize', marginBottom: 2 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: .5 },
  input: { padding: '7px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, width: '100%' },
  assetRow: { display: 'flex', gap: 6 },
  btnPick: { padding: '7px 10px', border: '1px solid #ddd', borderRadius: 6, background: '#f5f5f5', fontSize: 14, cursor: 'pointer', flexShrink: 0 },
  btnPickFull: { padding: '8px 12px', border: '1px dashed #bbb', borderRadius: 6, background: '#f9f9f9', fontSize: 13, color: '#555', cursor: 'pointer', width: '100%', textAlign: 'center' },
  preview: { width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 6, marginTop: 6, background: '#eee' },
  thumbRow: { display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 },
  miniThumb: { width: 36, height: 36, objectFit: 'cover', borderRadius: 4 },
  moreCount: { width: 36, height: 36, background: '#f0f0f0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#888' },
  checkLabel: { fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 },
  hint: { color: '#aaa', fontSize: 13, textAlign: 'center', marginTop: 16 },
};
