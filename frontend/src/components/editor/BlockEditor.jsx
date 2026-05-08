import { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import AssetPicker from './AssetPicker.jsx';
import api from '../../lib/api.js';
import { thumbUrl } from '../../lib/immich.js';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function BlockEditor({ block, onChange, storyId }) {
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

  if (block.type === 'hero') return <HeroEditor content={content} update={update} storyId={storyId} />;
  if (block.type === 'grid') return <GridEditor content={content} update={update} updateMany={updateMany} storyId={storyId} />;
  if (block.type === 'text') return <TextEditor content={content} update={update} />;
  if (block.type === 'quote') return <QuoteEditor content={content} update={update} />;
  if (block.type === 'map') return <MapEditor content={content} update={update} onChange={onChange} setContent={setContent} />;
  if (block.type === 'video') return <VideoEditor content={content} update={update} storyId={storyId} />;
  if (block.type === 'divider') return <DividerEditor content={content} update={update} />;
  if (block.type === 'spacer') return <SpacerEditor content={content} update={update} />;
  return <p className="text-ink-faint text-sm text-center mt-2">Sem editor para tipo "{block.type}"</p>;
}

/* ── shared field wrapper ───────────────────────────────────── */
function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1 mb-3">
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

/* ── toggle switch ───────────────────────────────────────────── */
function Toggle({ checked, onChange, label }) {
  return (
    <div className="flex items-center gap-2 cursor-pointer py-0.5 select-none" onClick={() => onChange(!checked)}>
      <div className={`w-7 h-4 rounded-full relative transition-colors shrink-0 ${checked ? 'bg-accent' : 'bg-border-strong'}`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-3' : 'translate-x-0'}`} style={{ left: 2 }} />
      </div>
      <span className="text-sm font-light text-ink-soft">{label}</span>
    </div>
  );
}

/* ── Hero editor ─────────────────────────────────────────────── */
function HeroEditor({ content, update, storyId }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display italic font-medium text-lg text-ink mb-1 pb-2.5 border-b border-border">Hero</h3>

      <Field label="Imagem">
        {content.asset_id ? (
          <div className="flex gap-2.5 items-center">
            <img src={thumbUrl(content.asset_id, 'thumbnail')} alt="" className="w-12 h-12 object-cover rounded-sm shrink-0 border border-border" />
            <div className="flex flex-col gap-1 min-w-0">
              <p className="text-2xs font-light text-ink-faint font-mono overflow-hidden text-ellipsis whitespace-nowrap">{content.asset_id.substring(0, 8)}…</p>
              <button className="text-xs font-normal text-accent bg-transparent border-none cursor-pointer text-left p-0" onClick={() => setPickerOpen(true)}>Alterar →</button>
            </div>
          </div>
        ) : (
          <button className="px-3 py-2 border border-dashed border-border-strong rounded-sm bg-paper-warm text-xs font-normal text-ink-muted cursor-pointer w-full text-center transition-colors hover:bg-paper-deep hover:border-border-strong" onClick={() => setPickerOpen(true)}>
            Escolher da biblioteca…
          </button>
        )}
      </Field>

      <div className="flex flex-col gap-2.5 pt-2.5 border-t border-border">
        <Field label="Título">
          <input className="field-input" value={content.title || ''} onChange={(e) => update('title', e.target.value)} placeholder="Título opcional" />
        </Field>
        <Field label="Caption">
          <input className="field-input" value={content.caption || ''} onChange={(e) => update('caption', e.target.value)} placeholder="Subtítulo / legenda" />
        </Field>
      </div>

      <div className="flex flex-col gap-2.5 pt-2.5 border-t border-border">
        <Field label="Altura">
          <select className="field-select" value={content.height || 'full'} onChange={(e) => update('height', e.target.value)}>
            <option value="full">Full (100vh)</option>
            <option value="half">Half (50vh)</option>
            <option value="medium">Medium (340px)</option>
          </select>
        </Field>
        <Toggle checked={!!content.overlay} onChange={(v) => update('overlay', v)} label="Gradiente por cima" />
      </div>

      {pickerOpen && (
        <AssetPicker
          multiple={false}
          initialSelected={content.asset_id ? [content.asset_id] : []}
          onSelect={(id) => update('asset_id', id)}
          onClose={() => setPickerOpen(false)}
          storyId={storyId}
        />
      )}
    </div>
  );
}

/* ── Sortable thumbnail ──────────────────────────────────────── */
function SortableThumb({ id, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      className="thumb-wrap"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
        position: 'relative',
        width: 62,
        height: 62,
        borderRadius: 6,
        overflow: 'hidden',
        flexShrink: 0,
        cursor: 'grab',
        touchAction: 'none',
      }}
      {...attributes}
      {...listeners}
    >
      <img src={thumbUrl(id, 'thumbnail')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} draggable={false} />
      <button
        className="thumb-remove absolute top-0.5 right-0.5 w-[18px] h-[18px] rounded-full border-none bg-black/60 text-white text-[10px] cursor-pointer flex items-center justify-center p-0 leading-none"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onRemove(id); }}
        title="Remover"
      >✕</button>
    </div>
  );
}

/* ── Grid editor ─────────────────────────────────────────────── */

function LayoutIcon({ type }) {
  const fill = 'currentColor';
  if (type === 'single') return <svg viewBox="0 0 32 24" width="28" height="21" fill="none"><rect x="1" y="1" width="30" height="22" rx="2" fill={fill} opacity="0.9"/></svg>;
  if (type === 'duo') return <svg viewBox="0 0 32 24" width="28" height="21" fill="none"><rect x="1" y="1" width="13.5" height="22" rx="2" fill={fill}/><rect x="17.5" y="1" width="13.5" height="22" rx="2" fill={fill} opacity="0.6"/></svg>;
  if (type === 'asymmetric') return <svg viewBox="0 0 32 24" width="28" height="21" fill="none"><rect x="1" y="1" width="19" height="22" rx="2" fill={fill}/><rect x="22" y="1" width="9" height="10" rx="1.5" fill={fill} opacity="0.65"/><rect x="22" y="13" width="9" height="10" rx="1.5" fill={fill} opacity="0.65"/></svg>;
  if (type === 'grid3') return <svg viewBox="0 0 32 24" width="28" height="21" fill="none"><rect x="1" y="1" width="8.5" height="22" rx="2" fill={fill}/><rect x="11.75" y="1" width="8.5" height="22" rx="2" fill={fill} opacity="0.7"/><rect x="22.5" y="1" width="8.5" height="22" rx="2" fill={fill} opacity="0.45"/></svg>;
  if (type === 'grid4') return <svg viewBox="0 0 32 24" width="28" height="21" fill="none"><rect x="1" y="1" width="5.75" height="22" rx="1.5" fill={fill}/><rect x="8.75" y="1" width="5.75" height="22" rx="1.5" fill={fill} opacity="0.75"/><rect x="15.75" y="1" width="5.75" height="22" rx="1.5" fill={fill} opacity="0.55"/><rect x="22.75" y="1" width="8.25" height="22" rx="1.5" fill={fill} opacity="0.35"/></svg>;
  return null;
}

function AspectIcon({ type }) {
  const fill = 'currentColor';
  if (type === 'square') return <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><rect x="2" y="2" width="20" height="20" rx="2.5" fill={fill}/></svg>;
  if (type === 'landscape') return <svg viewBox="0 0 24 24" width="24" height="18" fill="none"><rect x="1" y="2" width="22" height="14" rx="2.5" fill={fill}/></svg>;
  if (type === 'portrait') return <svg viewBox="0 0 24 24" width="16" height="22" fill="none"><rect x="2" y="1" width="14" height="22" rx="2.5" fill={fill}/></svg>;
  return null;
}

const GRID_LAYOUTS = [
  { key: 'single',     label: 'Único',       cols: 1, aspect: 'landscape', hint: null },
  { key: 'duo',        label: 'Duo',         cols: 2, aspect: 'portrait',  hint: '2+ fotos' },
  { key: 'asymmetric', label: 'Assimétrico', cols: 2, aspect: 'landscape', hint: '3+ fotos' },
  { key: 'grid3',      label: '3 colunas',   cols: 3, aspect: 'square',    hint: null },
  { key: 'grid4',      label: '4 colunas',   cols: 4, aspect: 'square',    hint: null },
];

const ASPECT_OPTIONS = [
  { key: 'square',    label: 'Quadrado' },
  { key: 'landscape', label: 'Landscape' },
  { key: 'portrait',  label: 'Portrait' },
];

function getLayoutKey(columns, aspect, layout) {
  if (layout === 'duo') return 'duo';
  if (layout === 'asymmetric') return 'asymmetric';
  if (columns === 1) return 'single';
  if (columns === 2 && aspect === 'portrait') return 'duo';
  if (columns === 2) return 'asymmetric';
  if (columns === 3) return 'grid3';
  return 'grid4';
}

function GridEditor({ content, update, updateMany, storyId }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const activeLayout = getLayoutKey(content.columns || 3, content.aspect || 'square', content.layout);
  const showAspectPicker = activeLayout === 'duo' || activeLayout === 'grid3' || activeLayout === 'grid4';
  const assetIds = content.asset_ids || [];

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const oldIdx = assetIds.indexOf(active.id);
    const newIdx = assetIds.indexOf(over.id);
    update('asset_ids', arrayMove(assetIds, oldIdx, newIdx));
  }

  function removePhoto(id) {
    update('asset_ids', assetIds.filter((a) => a !== id));
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display italic font-medium text-lg text-ink mb-1 pb-2.5 border-b border-border">Grid</h3>

      <Field label="Layout">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
          {GRID_LAYOUTS.map((l) => {
            const active = activeLayout === l.key;
            return (
              <button
                key={l.key}
                title={l.hint ? `${l.label} — ${l.hint}` : l.label}
                onClick={() => updateMany({ columns: l.cols, aspect: l.aspect, layout: l.key })}
                style={{
                  padding: '10px 4px 8px',
                  border: `1.5px solid ${active ? 'var(--mv-accent)' : 'var(--paper-deep)'}`,
                  borderRadius: 8,
                  background: active ? 'var(--mv-accent-pale)' : 'var(--paper-warm)',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  color: active ? 'var(--mv-accent)' : 'var(--ink-faint)',
                  transition: 'border-color 0.15s, background 0.15s, color 0.15s',
                  boxShadow: active ? '0 0 0 3px var(--mv-accent-pale)' : '0 1px 2px rgba(26,24,20,0.05)',
                }}
              >
                <LayoutIcon type={l.key} />
                <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.03em', lineHeight: 1, color: 'inherit' }}>{l.label}</span>
              </button>
            );
          })}
        </div>
        {activeLayout === 'asymmetric' && (
          <p className="text-2xs text-ink-faint mt-1 leading-snug">Requer 3+ fotos</p>
        )}
      </Field>

      {showAspectPicker && (
        <Field label="Orientação">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
            {ASPECT_OPTIONS.map((a) => {
              const active = (content.aspect || 'square') === a.key;
              return (
                <button
                  key={a.key}
                  title={a.label}
                  onClick={() => update('aspect', a.key)}
                  style={{
                    padding: '12px 4px 10px',
                    border: `1.5px solid ${active ? 'var(--mv-accent)' : 'var(--paper-deep)'}`,
                    borderRadius: 8,
                    background: active ? 'var(--mv-accent-pale)' : 'var(--paper-warm)',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7,
                    color: active ? 'var(--mv-accent)' : 'var(--ink-faint)',
                    minHeight: 64,
                    transition: 'border-color 0.15s, background 0.15s, color 0.15s',
                    boxShadow: active ? '0 0 0 3px var(--mv-accent-pale)' : '0 1px 2px rgba(26,24,20,0.05)',
                  }}
                >
                  <AspectIcon type={a.key} />
                  <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.03em', lineHeight: 1, color: 'inherit' }}>{a.label}</span>
                </button>
              );
            })}
          </div>
        </Field>
      )}

      <Field label={`Imagens (${assetIds.length})`}>
        <button className="px-3 py-2 border border-dashed border-border-strong rounded-sm bg-paper-warm text-xs font-normal text-ink-muted cursor-pointer w-full text-center transition-colors hover:bg-paper-deep" onClick={() => setPickerOpen(true)}>
          Seleccionar da biblioteca…
        </button>
        {assetIds.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={assetIds} strategy={rectSortingStrategy}>
              <div className="flex flex-wrap gap-1 mt-2">
                {assetIds.map((id) => (
                  <SortableThumb key={id} id={id} onRemove={removePhoto} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </Field>

      <Field label="Gap">
        <select className="field-select" value={content.gap || 'sm'} onChange={(e) => update('gap', e.target.value)}>
          <option value="sm">Pequeno</option>
          <option value="md">Médio</option>
          <option value="lg">Grande</option>
        </select>
      </Field>

      {pickerOpen && (
        <AssetPicker
          multiple={true}
          initialSelected={assetIds}
          onSelect={(ids) => update('asset_ids', ids)}
          onClose={() => setPickerOpen(false)}
          storyId={storyId}
        />
      )}
    </div>
  );
}

/* ── Text editor ─────────────────────────────────────────────── */
function TextEditor({ content, update }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display italic font-medium text-lg text-ink mb-1 pb-2.5 border-b border-border">Texto</h3>

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

      <div className="grid grid-cols-2 gap-2">
        <Field label="Alinhamento">
          <select className="field-select" value={content.align || 'left'} onChange={(e) => update('align', e.target.value)}>
            <option value="left">Esquerda</option>
            <option value="center">Centro</option>
            <option value="right">Direita</option>
          </select>
        </Field>
        <Field label="Largura">
          <select className="field-select" value={content.max_width || 'prose'} onChange={(e) => update('max_width', e.target.value)}>
            <option value="narrow">Estreita</option>
            <option value="prose">Prose</option>
            <option value="wide">Larga</option>
          </select>
        </Field>
      </div>
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
    <div className="flex flex-col gap-3">
      <h3 className="font-display italic font-medium text-lg text-ink mb-1 pb-2.5 border-b border-border">Mapa</h3>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Estilo">
          <select className="field-select" value={content.skin || 'standard'} onChange={(e) => update('skin', e.target.value)}>
            <option value="standard">Standard</option>
            <option value="memoire">Mémoire</option>
            <option value="ghost">Ghost</option>
          </select>
        </Field>
        <Field label="Modo">
          <select className="field-select" value={content.mode || 'manual'} onChange={(e) => update('mode', e.target.value)}>
            <option value="manual">Pin manual</option>
            <option value="auto">GPS auto</option>
          </select>
        </Field>
      </div>

      {(content.mode || 'manual') === 'manual' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Latitude">
              <input className="field-input" type="number" step="any" value={content.lat ?? ''} onChange={(e) => update('lat', parseFloat(e.target.value) || null)} placeholder="38.7169" />
            </Field>
            <Field label="Longitude">
              <input className="field-input" type="number" step="any" value={content.lng ?? ''} onChange={(e) => update('lng', parseFloat(e.target.value) || null)} placeholder="-9.1399" />
            </Field>
          </div>
          <Field label="Zoom">
            <input className="field-input" type="number" min="1" max="18" value={content.zoom ?? 12} onChange={(e) => update('zoom', parseInt(e.target.value) || 12)} />
          </Field>
          <Field label="Etiqueta">
            <input className="field-input" value={content.label || ''} onChange={(e) => update('label', e.target.value)} placeholder="Lisboa" />
          </Field>
        </>
      )}

      {content.mode === 'auto' && (
        <>
          <Field label={`Assets GPS (${(content.asset_ids || []).length})`}>
            <button className="px-3 py-2 border border-dashed border-border-strong rounded-sm bg-paper-warm text-xs font-normal text-ink-muted cursor-pointer w-full text-center transition-colors hover:bg-paper-deep" onClick={() => setPickerOpen(true)}>Seleccionar assets…</button>
            {(content.resolved_markers || []).length > 0 && (
              <p className="text-2xs text-ink-faint font-light mt-1">{content.resolved_markers.length} ponto(s) resolvido(s)</p>
            )}
          </Field>
          <button className="px-3 py-2 border border-dashed border-border-strong rounded-sm bg-paper-warm text-xs font-normal text-ink-muted cursor-pointer w-full text-center transition-colors hover:bg-paper-deep" onClick={resolveGPS} disabled={resolving || !(content.asset_ids || []).length}>
            {resolving ? 'A resolver GPS...' : '📍 Resolver coordenadas GPS'}
          </button>
          <Toggle checked={!!content.show_route} onChange={(v) => update('show_route', v)} label="Ligar pontos com linha" />
          <Field label="Cor da rota">
            <input className="field-input" style={{ padding: 2, height: 34 }} type="color" value={content.route_color || '#E07B54'} onChange={(e) => update('route_color', e.target.value)} />
          </Field>
          <Field label="Zoom inicial">
            <input className="field-input" type="number" min="1" max="18" value={content.zoom ?? 10} onChange={(e) => update('zoom', parseInt(e.target.value) || 10)} />
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
function VideoEditor({ content, update, storyId }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display italic font-medium text-lg text-ink mb-1 pb-2.5 border-b border-border">Vídeo</h3>
      <Field label="Vídeo">
        {content.asset_id ? (
          <div className="flex gap-2.5 items-center">
            <div className="w-12 h-12 shrink-0 rounded-sm bg-ink flex items-center justify-center border border-border">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="var(--paper)"><polygon points="3,2 10,6 3,10"/></svg>
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <p className="text-2xs font-light text-ink-faint font-mono overflow-hidden text-ellipsis whitespace-nowrap">{content.asset_id.substring(0, 8)}…</p>
              <button className="text-xs font-normal text-accent bg-transparent border-none cursor-pointer text-left p-0" onClick={() => setPickerOpen(true)}>Alterar →</button>
            </div>
          </div>
        ) : (
          <button className="px-3 py-2 border border-dashed border-border-strong rounded-sm bg-paper-warm text-xs font-normal text-ink-muted cursor-pointer w-full text-center transition-colors hover:bg-paper-deep" onClick={() => setPickerOpen(true)}>Escolher vídeo…</button>
        )}
      </Field>
      <Field label="Caption">
        <input className="field-input" value={content.caption || ''} onChange={(e) => update('caption', e.target.value)} placeholder="Legenda opcional" />
      </Field>
      <div className="flex flex-col gap-2.5 pt-2.5 border-t border-border">
        <Toggle checked={!!content.autoplay} onChange={(v) => update('autoplay', v)} label="Autoplay" />
        <Toggle checked={!!content.loop} onChange={(v) => update('loop', v)} label="Loop" />
      </div>
      {pickerOpen && (
        <AssetPicker multiple={false} initialSelected={content.asset_id ? [content.asset_id] : []}
          onSelect={(id) => update('asset_id', id)} onClose={() => setPickerOpen(false)} typeFilter="VIDEO" storyId={storyId} />
      )}
    </div>
  );
}

/* ── Quote editor ─────────────────────────────────────────────── */
function QuoteEditor({ content, update }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display italic font-medium text-lg text-ink mb-1 pb-2.5 border-b border-border">Citação</h3>
      <Field label="Texto da citação">
        <textarea
          className="field-textarea"
          style={{ height: 100 }}
          value={content.quote || ''}
          onChange={(e) => update('quote', e.target.value)}
          placeholder="Uma frase memorável…"
        />
      </Field>
      <Field label="Autor (opcional)">
        <input className="field-input" value={content.author || ''} onChange={(e) => update('author', e.target.value)} placeholder="Nome do autor" />
      </Field>
    </div>
  );
}

/* ── Spacer editor ────────────────────────────────────────────── */
function SpacerEditor({ content, update }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display italic font-medium text-lg text-ink mb-1 pb-2.5 border-b border-border">Espaço</h3>
      <Field label="Altura">
        <select className="field-select" value={content.height || 'md'} onChange={(e) => update('height', e.target.value)}>
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
    <div className="flex flex-col gap-3">
      <h3 className="font-display italic font-medium text-lg text-ink mb-1 pb-2.5 border-b border-border">Divisor</h3>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Etiqueta">
          <input className="field-input" value={content.label || ''} onChange={(e) => update('label', e.target.value)} placeholder="2024 · Verão" />
        </Field>
        <Field label="Estilo">
          <select className="field-select" value={content.style || 'line'} onChange={(e) => update('style', e.target.value)}>
            <option value="line">Linha</option>
            <option value="space">Espaço</option>
          </select>
        </Field>
      </div>
    </div>
  );
}
