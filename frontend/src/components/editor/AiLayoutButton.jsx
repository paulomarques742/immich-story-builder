import { useState, useEffect } from 'react';
import api from '../../lib/api.js';
import { thumbUrl } from '../../lib/immich.js';

const STRATEGY_LABELS = {
  chronological: 'Cronológico',
  by_person: 'Por pessoas',
  by_location: 'Por localização',
  by_theme: 'Por tema',
  mixed: 'Misto',
  location: 'Por localização',
  day: 'Dia a dia',
  theme: 'Por tema',
};

const TONE_LABELS = {
  nostálgico: '🌅',
  aventureiro: '🧭',
  íntimo: '🤍',
  documental: '📷',
  lírico: '✨',
};

export default function AiLayoutButton({ aiLayout, disabled, isMobile = false }) {
  // screen: 'albums' | 'suggestions' | 'progress'
  const [screen, setScreen] = useState('albums');
  const [open, setOpen] = useState(false);
  const [albums, setAlbums] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [language, setLanguage] = useState('pt');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [sharedOnly, setSharedOnly] = useState(true);
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  const [albumError, setAlbumError] = useState('');
  const [chosenIdx, setChosenIdx] = useState(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingAlbums(true);
    setAlbumError('');
    api.get(`/api/immich/albums${sharedOnly ? '?shared=true' : ''}`)
      .then((r) => setAlbums(r.data))
      .catch(() => setAlbumError('Não foi possível carregar álbuns.'))
      .finally(() => setLoadingAlbums(false));
  }, [open, sharedOnly]);

  // When suggestions arrive, switch to suggestions screen
  useEffect(() => {
    if (aiLayout.status === 'suggestions_ready' && screen !== 'suggestions') {
      setScreen('suggestions');
    }
    if (aiLayout.status === 'applying' || aiLayout.status === 'processing') {
      if (screen !== 'progress') setScreen('progress');
    }
  }, [aiLayout.status, screen]);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleAnalyse() {
    if (selected.size === 0) return;
    try {
      setScreen('progress');
      await aiLayout.triggerSuggestAiLayout({ albumIds: [...selected], language });
    } catch (err) {
      if (err?.response?.status === 501) setUnavailable(true);
    }
  }

  async function handleApply(idx) {
    setChosenIdx(idx);
    setScreen('progress');
    await aiLayout.applySelectedSuggestion({ suggestionIdx: idx, replaceExisting });
  }

  function handleClose() {
    setOpen(false);
    setScreen('albums');
    setChosenIdx(null);
    if (aiLayout.status === 'done' || aiLayout.status === 'error' || aiLayout.status === 'suggestions_ready') {
      aiLayout.reset();
    }
  }

  if (unavailable) {
    return (
      <button className="btn btn-secondary" disabled title="Adiciona GEMINI_API_KEY ao .env para activar AI Layout" style={{ opacity: 0.6 }}>
        ✨ AI Layout
        <span style={s.badge}>Config</span>
      </button>
    );
  }

  return (
    <>
      <button
        className="btn btn-secondary"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title="Gerar story automaticamente com IA"
      >
        {isMobile ? '✨' : '✨ AI Layout'}
      </button>

      {open && (
        <div style={s.overlay} onClick={handleClose}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>

            {/* ── SCREEN 1: Album selection ── */}
            {screen === 'albums' && (
              <>
                <div style={s.header}>
                  <h3 style={s.title}>✨ AI Layout</h3>
                  <button style={s.closeBtn} onClick={handleClose}>✕</button>
                </div>
                <div style={s.body}>
                  <p style={s.desc}>
                    Selecciona álbuns. A IA analisa as fotos e sugere 3 formas de organizar a tua história.
                  </p>
                  <label style={s.filterRow}>
                    <input type="checkbox" checked={sharedOnly} onChange={(e) => setSharedOnly(e.target.checked)} />
                    Só álbuns partilhados
                  </label>
                  {loadingAlbums && <p style={s.hint}>A carregar álbuns...</p>}
                  {albumError && <p style={s.error}>{albumError}</p>}
                  <div style={s.list}>
                    {albums.map((a) => (
                      <label key={a.id} style={s.item}>
                        <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} style={{ flexShrink: 0 }} />
                        <span style={s.albumName}>{a.albumName}</span>
                        <span style={s.albumCount}>{a.assetCount ?? 0} fotos</span>
                      </label>
                    ))}
                    {!loadingAlbums && albums.length === 0 && !albumError && (
                      <p style={s.hint}>Sem álbuns disponíveis</p>
                    )}
                  </div>
                  <div style={s.options}>
                    <label style={s.optionRow}>
                      <span style={s.optionLabel}>Idioma do texto</span>
                      <select value={language} onChange={(e) => setLanguage(e.target.value)} style={s.select}>
                        <option value="pt">Português</option>
                        <option value="en">English</option>
                        <option value="es">Español</option>
                      </select>
                    </label>
                    <label style={s.checkRow}>
                      <input type="checkbox" checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)} />
                      <span style={{ fontSize: 13 }}>Substituir blocos existentes</span>
                    </label>
                  </div>
                </div>
                <div style={s.footer}>
                  <button className="btn btn-secondary" onClick={handleClose}>Cancelar</button>
                  <button
                    className="btn btn-primary"
                    onClick={handleAnalyse}
                    disabled={selected.size === 0}
                  >
                    {`Analisar fotos${selected.size > 0 ? ` (${selected.size} álbum${selected.size > 1 ? 'ns' : ''})` : ''}`}
                  </button>
                </div>
              </>
            )}

            {/* ── SCREEN 2: Concept suggestions ── */}
            {screen === 'suggestions' && (
              <>
                <div style={s.header}>
                  <button style={{ ...s.backBtn }} onClick={() => setScreen('albums')}>← Álbuns</button>
                  <h3 style={s.title}>Escolhe um conceito</h3>
                  <button style={s.closeBtn} onClick={handleClose}>✕</button>
                </div>
                <div style={{ ...s.body, padding: '16px 20px' }}>
                  {(!aiLayout.suggestions || aiLayout.suggestions.length === 0) ? (
                    <p style={s.hint}>Sem sugestões disponíveis.</p>
                  ) : (
                    <div style={s.conceptList}>
                      {aiLayout.suggestions.map((concept, idx) => (
                        <div key={idx} style={{ ...s.conceptCard, ...(chosenIdx === idx ? s.conceptCardActive : {}) }}>
                          {concept.hero_asset_id && (
                            <div style={s.conceptThumb}>
                              <img
                                src={thumbUrl(concept.hero_asset_id, 'thumbnail')}
                                alt=""
                                style={s.conceptImg}
                              />
                            </div>
                          )}
                          <div style={s.conceptBody}>
                            <div style={s.conceptMeta}>
                              <span style={s.strategyBadge}>
                                {STRATEGY_LABELS[concept.strategy] || concept.strategy}
                              </span>
                              {concept.tone && (
                                <span style={s.toneBadge}>
                                  {TONE_LABELS[concept.tone] || ''} {concept.tone}
                                </span>
                              )}
                              {concept.is_recommended && (
                                <span style={s.recommendedBadge}>Recomendado</span>
                              )}
                            </div>
                            <p style={s.conceptTitle}>{concept.title_pt}</p>
                            {concept.description_pt && (
                              <p style={s.conceptDesc}>{concept.description_pt}</p>
                            )}
                            <button
                              className="btn btn-primary"
                              style={s.applyBtn}
                              onClick={() => handleApply(idx)}
                            >
                              Usar este conceito
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── SCREEN 3: Progress ── */}
            {screen === 'progress' && (
              <>
                <div style={s.header}>
                  <h3 style={s.title}>
                    {aiLayout.status === 'applying' || (aiLayout.status === 'processing' && chosenIdx !== null)
                      ? '✨ A criar história...'
                      : '✨ A analisar fotos...'}
                  </h3>
                  <button style={s.closeBtn} onClick={handleClose}>✕</button>
                </div>
                <div style={{ ...s.body, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
                  {aiLayout.status === 'error' ? (
                    <p style={s.error}>{aiLayout.error}</p>
                  ) : aiLayout.status === 'done' ? (
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: 32, marginBottom: 8 }}>🎉</p>
                      <p style={{ fontSize: 14, fontWeight: 600 }}>História criada com {aiLayout.blocksCreated} blocos!</p>
                    </div>
                  ) : (
                    <>
                      <div style={s.progressBar}>
                        <div style={{ ...s.progressFill, width: `${aiLayout.progress}%` }} />
                      </div>
                      <p style={s.progressLabel}>
                        {aiLayout.status === 'suggestions_ready'
                          ? 'Sugestões prontas!'
                          : aiLayout.total > 0
                          ? `${aiLayout.processed} / ${aiLayout.total} fotos`
                          : 'A processar...'}
                      </p>
                    </>
                  )}
                </div>
                {(aiLayout.status === 'done' || aiLayout.status === 'error') && (
                  <div style={s.footer}>
                    <button className="btn btn-primary" onClick={handleClose}>Fechar</button>
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      )}
    </>
  );
}

const s = {
  badge: {
    display: 'inline-block', marginLeft: 6, fontSize: 10, fontWeight: 500,
    padding: '1px 5px', borderRadius: 3,
    background: 'var(--mv-accent-pale)', color: 'var(--mv-accent)',
    verticalAlign: 'middle', letterSpacing: '0.02em',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(26,24,20,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 300, backdropFilter: 'blur(3px)',
  },
  modal: {
    background: 'var(--paper)', borderRadius: 'var(--radius-lg)',
    width: 520, maxWidth: 'calc(100vw - 2rem)', maxHeight: '82vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: 'var(--shadow-lg)', border: '0.5px solid var(--border)', overflow: 'hidden',
  },
  header: {
    padding: '14px 20px', borderBottom: '0.5px solid var(--border)',
    display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexShrink: 0,
  },
  title: { fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 500, color: 'var(--ink)', flex: 1 },
  backBtn: {
    background: 'none', border: 'none', fontSize: 12, fontWeight: 300, cursor: 'pointer',
    color: 'var(--ink-muted)', padding: '0 8px 0 0', flexShrink: 0,
  },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 16, cursor: 'pointer',
    color: 'var(--ink-faint)', width: 28, height: 28,
    display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)',
  },
  body: { padding: '16px 20px', flex: 1, overflowY: 'auto' },
  desc: { fontSize: 13, fontWeight: 300, color: 'var(--ink-muted)', marginBottom: 14, lineHeight: 1.6 },
  hint: { color: 'var(--ink-faint)', fontSize: 13, fontWeight: 300, textAlign: 'center', padding: '20px 0' },
  error: {
    color: 'var(--danger)', fontSize: 13, fontWeight: 300, marginBottom: 8,
    padding: '8px 12px',
    background: 'rgba(176,80,80,0.06)',
    border: '0.5px solid rgba(176,80,80,0.2)',
    borderRadius: 'var(--radius-sm)',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 16 },
  item: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 10px', borderRadius: 'var(--radius-sm)',
    cursor: 'pointer', fontSize: 13, transition: 'background 0.1s',
  },
  albumName: { flex: 1, fontWeight: 400, fontSize: 13, color: 'var(--ink-soft)' },
  albumCount: { fontSize: 12, fontWeight: 300, color: 'var(--ink-faint)' },
  filterRow: {
    display: 'flex', alignItems: 'center', gap: 7,
    fontSize: 12, fontWeight: 300, color: 'var(--ink-muted)', marginBottom: 14, cursor: 'pointer',
  },
  options: { borderTop: '0.5px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 },
  optionRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 },
  optionLabel: { color: 'var(--ink-soft)', fontWeight: 400 },
  select: {
    fontSize: 13, fontWeight: 300, padding: '4px 8px', borderRadius: 'var(--radius-sm)',
    border: '0.5px solid var(--border)', background: 'var(--paper-warm)', color: 'var(--ink-soft)', cursor: 'pointer',
  },
  checkRow: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--ink-muted)', fontSize: 13, fontWeight: 300 },
  footer: {
    padding: '12px 20px', borderTop: '0.5px solid var(--border)',
    background: 'var(--paper-warm)',
    display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0,
  },
  // Concept cards
  conceptList: { display: 'flex', flexDirection: 'column', gap: 10 },
  conceptCard: {
    border: '0.5px solid var(--border)', borderRadius: 'var(--radius)',
    overflow: 'hidden', display: 'flex', flexDirection: 'row',
    transition: 'border-color 0.15s', cursor: 'default',
  },
  conceptCardActive: { borderColor: 'var(--mv-accent)' },
  conceptThumb: { width: 90, flexShrink: 0, background: 'var(--paper-deep)' },
  conceptImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  conceptBody: { padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 },
  conceptMeta: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  strategyBadge: {
    fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 20,
    background: 'var(--mv-accent-pale)', color: 'var(--mv-accent)',
    letterSpacing: '0.03em',
  },
  toneBadge: {
    fontSize: 10, fontWeight: 300, color: 'var(--ink-muted)', padding: '2px 6px',
    borderRadius: 20, border: '0.5px solid var(--border)',
  },
  recommendedBadge: {
    fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 20,
    background: 'var(--success-pale)', color: 'var(--success)',
  },
  conceptTitle: { fontSize: 13, fontWeight: 400, color: 'var(--ink)', lineHeight: 1.3, margin: 0 },
  conceptDesc: { fontSize: 12, fontWeight: 300, color: 'var(--ink-muted)', lineHeight: 1.5, margin: 0 },
  applyBtn: { alignSelf: 'flex-start', marginTop: 4, fontSize: 12, padding: '5px 12px' },
  // Progress
  progressBar: {
    width: '100%', height: 3, background: 'var(--paper-deep)',
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', background: 'var(--mv-accent)',
    transition: 'width 0.4s ease', borderRadius: 3,
  },
  progressLabel: { fontSize: 13, fontWeight: 300, color: 'var(--ink-muted)', textAlign: 'center' },
};
