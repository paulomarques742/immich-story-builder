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

function ModalHeader({ title, onClose, onBack, backLabel }) {
  return (
    <div className="flex items-center gap-2 justify-between shrink-0 border-b border-border" style={{ padding: '14px 20px' }}>
      {onBack && (
        <button
          className="text-xs font-light text-ink-faint bg-transparent border-none cursor-pointer shrink-0 transition-colors hover:text-ink-muted"
          style={{ paddingRight: 8 }}
          onClick={onBack}
        >
          ← {backLabel}
        </button>
      )}
      <h3 className="font-display text-xl italic font-light text-ink flex-1">{title}</h3>
      <button className="btn btn-ghost btn-sm text-ink-faint" onClick={onClose}>✕</button>
    </div>
  );
}

export default function AiLayoutButton({ aiLayout, disabled, isMobile = false }) {
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
  const [isSmall, setIsSmall] = useState(() => window.innerWidth < 480);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 479px)');
    const h = (e) => setIsSmall(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoadingAlbums(true);
    setAlbumError('');
    api.get(`/api/immich/albums${sharedOnly ? '?shared=true' : ''}`)
      .then((r) => setAlbums(r.data))
      .catch(() => setAlbumError('Não foi possível carregar álbuns.'))
      .finally(() => setLoadingAlbums(false));
  }, [open, sharedOnly]);

  useEffect(() => {
    if (aiLayout.status === 'suggestions_ready' && screen !== 'suggestions') setScreen('suggestions');
    if ((aiLayout.status === 'applying' || aiLayout.status === 'processing') && screen !== 'progress') setScreen('progress');
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
    if (['done', 'error', 'suggestions_ready'].includes(aiLayout.status)) aiLayout.reset();
  }

  if (unavailable) {
    return (
      <button className="btn btn-secondary" disabled title="Adiciona GEMINI_API_KEY ao .env para activar AI Layout" style={{ opacity: 0.6 }}>
        ✨ AI Layout
        <span className="inline-block ml-1.5 text-2xs font-medium px-1.5 py-0.5 rounded-[3px] bg-accent-pale text-accent align-middle tracking-wide">Config</span>
      </button>
    );
  }

  const overlayStyle = isSmall
    ? {}
    : { background: 'rgba(26,24,20,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' };

  const modalStyle = isSmall
    ? { position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--paper)' }
    : {
        width: 520,
        maxWidth: 'calc(100vw - 2rem)',
        maxHeight: '84vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--paper)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(26,24,20,0.2)',
      };

  return (
    <>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen(true)} disabled={disabled} title="Gerar story automaticamente com IA">
        {isMobile ? '✨' : '✨ AI Layout'}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[300]"
          style={overlayStyle}
          onClick={isSmall ? undefined : handleClose}
        >
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>

            {/* ── SCREEN 1: Album selection ── */}
            {screen === 'albums' && (
              <>
                <ModalHeader title="✨ AI Layout" onClose={handleClose} />

                <div className="flex-1 overflow-y-auto" style={{ padding: '16px 20px' }}>
                  <p className="text-sm font-light text-ink-muted mb-4 leading-relaxed">
                    Selecciona álbuns. A IA analisa as fotos e sugere 3 formas de organizar a tua história.
                  </p>

                  <label className="flex items-center gap-2 text-sm font-light text-ink-muted mb-4 cursor-pointer select-none">
                    <input type="checkbox" checked={sharedOnly} onChange={(e) => setSharedOnly(e.target.checked)} />
                    Só álbuns partilhados
                  </label>

                  {loadingAlbums && <p className="text-sm font-light text-ink-faint text-center py-5">A carregar álbuns...</p>}
                  {albumError && (
                    <p className="text-sm font-light text-danger mb-3 px-3 py-2 bg-danger/6 border border-danger/20 rounded-sm">{albumError}</p>
                  )}

                  <div className="flex flex-col" style={{ gap: 1, marginBottom: 16 }}>
                    {albums.map((a) => (
                      <label
                        key={a.id}
                        className="flex items-center gap-3 rounded-sm cursor-pointer transition-colors hover:bg-paper-warm select-none"
                        style={{ padding: '9px 10px' }}
                      >
                        <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} className="shrink-0" />
                        <span className="flex-1 text-sm font-light text-ink-soft">{a.albumName}</span>
                        <span className="text-xs font-light text-ink-faint shrink-0">{a.assetCount ?? 0}</span>
                      </label>
                    ))}
                    {!loadingAlbums && albums.length === 0 && !albumError && (
                      <p className="text-sm font-light text-ink-faint text-center py-5">Sem álbuns disponíveis</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 border-t border-border" style={{ paddingTop: 14 }}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-light text-ink-muted">Idioma do texto</span>
                      <select className="field-select" style={{ width: 'auto' }} value={language} onChange={(e) => setLanguage(e.target.value)}>
                        <option value="pt">Português</option>
                        <option value="en">English</option>
                        <option value="es">Español</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-light text-ink-muted select-none">
                      <input type="checkbox" checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)} />
                      Substituir blocos existentes
                    </label>
                  </div>
                </div>

                <div className="flex gap-2 justify-end shrink-0 border-t border-border bg-paper-warm" style={{ padding: '10px 20px' }}>
                  <button className="btn btn-secondary" onClick={handleClose}>Cancelar</button>
                  <button className="btn btn-primary" onClick={handleAnalyse} disabled={selected.size === 0}>
                    {`Analisar${selected.size > 0 ? ` (${selected.size} álbum${selected.size > 1 ? 'ns' : ''})` : ' fotos'}`}
                  </button>
                </div>
              </>
            )}

            {/* ── SCREEN 2: Concept suggestions ── */}
            {screen === 'suggestions' && (
              <>
                <ModalHeader
                  title="Escolhe um conceito"
                  onClose={handleClose}
                  onBack={() => setScreen('albums')}
                  backLabel="Álbuns"
                />

                <div className="flex-1 overflow-y-auto" style={{ padding: '16px 20px' }}>
                  {(!aiLayout.suggestions || aiLayout.suggestions.length === 0) ? (
                    <p className="text-sm font-light text-ink-faint text-center py-5">Sem sugestões disponíveis.</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {aiLayout.suggestions.map((concept, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg overflow-hidden border transition-colors"
                          style={{
                            display: 'flex',
                            flexDirection: isSmall ? 'column' : 'row',
                            borderColor: chosenIdx === idx ? 'var(--mv-accent)' : 'var(--border)',
                            boxShadow: chosenIdx === idx ? '0 0 0 3px var(--mv-accent-pale)' : 'none',
                          }}
                        >
                          {concept.hero_asset_id && (
                            <div
                              className="shrink-0 overflow-hidden"
                              style={isSmall
                                ? { height: 110, background: 'var(--paper-deep)' }
                                : { width: 96, background: 'var(--paper-deep)' }}
                            >
                              <img
                                src={thumbUrl(concept.hero_asset_id, 'thumbnail')}
                                alt=""
                                className="w-full h-full object-cover block"
                              />
                            </div>
                          )}
                          <div className="flex flex-col gap-2" style={{ padding: '12px 14px', flex: 1 }}>
                            <div className="flex gap-1.5 flex-wrap items-center">
                              <span className="text-2xs font-medium px-1.5 py-0.5 rounded-full bg-accent-pale text-accent tracking-wide">
                                {STRATEGY_LABELS[concept.strategy] || concept.strategy}
                              </span>
                              {concept.tone && (
                                <span className="text-2xs font-light text-ink-muted px-1.5 py-0.5 rounded-full border border-border">
                                  {TONE_LABELS[concept.tone] || ''} {concept.tone}
                                </span>
                              )}
                              {concept.is_recommended && (
                                <span className="text-2xs font-medium px-1.5 py-0.5 rounded-full bg-success-pale text-success">Recomendado</span>
                              )}
                            </div>
                            <p className="font-display text-base italic font-light text-ink leading-snug m-0">{concept.title_pt}</p>
                            {concept.description_pt && (
                              <p className="text-xs font-light text-ink-muted leading-relaxed m-0">{concept.description_pt}</p>
                            )}
                            <button className="btn btn-primary btn-sm self-start" style={{ marginTop: 2 }} onClick={() => handleApply(idx)}>
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
                <ModalHeader
                  title={
                    aiLayout.status === 'applying' || (aiLayout.status === 'processing' && chosenIdx !== null)
                      ? '✨ A criar história…'
                      : '✨ A analisar fotos…'
                  }
                  onClose={handleClose}
                />

                <div className="flex-1 flex flex-col gap-4 items-center justify-center" style={{ padding: '32px 20px', minHeight: 180 }}>
                  {aiLayout.status === 'error' ? (
                    <p className="text-sm font-light text-danger px-3 py-2 bg-danger/6 border border-danger/20 rounded-sm w-full text-center">{aiLayout.error}</p>
                  ) : aiLayout.status === 'done' ? (
                    <div className="text-center">
                      <p className="mb-3" style={{ fontSize: 36 }}>🎉</p>
                      <p className="font-display text-xl italic font-light text-ink">História criada!</p>
                      <p className="text-sm font-light text-ink-muted mt-1">{aiLayout.blocksCreated} blocos adicionados</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: 'var(--paper-deep)' }}>
                        <div
                          className="h-full rounded-full transition-[width] duration-300"
                          style={{ width: `${aiLayout.progress}%`, background: 'var(--mv-accent)' }}
                        />
                      </div>
                      <p className="text-sm font-light text-ink-muted text-center">
                        {aiLayout.status === 'suggestions_ready'
                          ? 'Sugestões prontas!'
                          : aiLayout.total > 0
                          ? `${aiLayout.processed} / ${aiLayout.total} fotos`
                          : 'A processar…'}
                      </p>
                    </>
                  )}
                </div>

                {(aiLayout.status === 'done' || aiLayout.status === 'error') && (
                  <div className="flex gap-2 justify-end shrink-0 border-t border-border bg-paper-warm" style={{ padding: '10px 20px' }}>
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
