export default function AiProgressModal({ status, progress, processed, total, blocksCreated, error, onClose, onRetry }) {
  const isDone = status === 'done';
  const isError = status === 'error';
  const isActive = status === 'loading' || status === 'processing';

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.header}>
          <h3 style={s.title}>
            {isDone ? '✨ Story gerada' : isError ? 'Erro no AI Layout' : '✨ A gerar story…'}
          </h3>
        </div>

        <div style={s.body}>
          {isActive && (
            <>
              <div style={s.barTrack}>
                <div style={{ ...s.barFill, width: `${progress}%` }} />
              </div>
              <p style={s.counter}>
                {total > 0
                  ? `${processed} / ${total} fotos analisadas`
                  : 'A preparar…'}
              </p>
              <p style={s.hint}>Este processo pode demorar alguns minutos.</p>
            </>
          )}

          {isDone && (
            <>
              <div style={s.barTrack}>
                <div style={{ ...s.barFill, width: '100%', background: 'var(--success, #22c55e)' }} />
              </div>
              <p style={s.counter}>{blocksCreated} blocos criados</p>
              <p style={s.hint}>A story foi gerada. Podes editar qualquer bloco manualmente.</p>
            </>
          )}

          {isError && (
            <p style={s.error}>{error || 'Ocorreu um erro durante a análise.'}</p>
          )}
        </div>

        <div style={s.footer}>
          {isError && onRetry && (
            <button className="btn btn-secondary" onClick={onRetry}>Tentar novamente</button>
          )}
          {(isDone || isError) && (
            <button className="btn btn-primary" onClick={onClose}>
              {isDone ? 'Ver story' : 'Fechar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(26,24,20,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 400, backdropFilter: 'blur(3px)',
  },
  modal: {
    background: 'var(--paper)',
    borderRadius: 'var(--radius-lg)',
    width: 420, maxWidth: 'calc(100vw - 2rem)',
    display: 'flex', flexDirection: 'column',
    boxShadow: 'var(--shadow-lg)',
    border: '0.5px solid var(--border)',
    overflow: 'hidden',
  },
  header: {
    padding: '18px 22px 14px',
    borderBottom: '0.5px solid var(--border)',
    flexShrink: 0,
  },
  title: { fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 500, color: 'var(--ink)' },
  body: { padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10 },
  barTrack: {
    height: 3, borderRadius: 999,
    background: 'var(--paper-deep)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%', borderRadius: 999,
    background: 'var(--mv-accent)',
    transition: 'width 0.4s ease',
  },
  counter: { fontSize: 13, fontWeight: 400, color: 'var(--ink)', textAlign: 'center' },
  hint: { fontSize: 12, fontWeight: 300, color: 'var(--ink-faint)', textAlign: 'center' },
  error: {
    fontSize: 13, fontWeight: 300, color: 'var(--danger)',
    padding: '10px 14px',
    background: 'rgba(176,80,80,0.06)',
    border: '0.5px solid rgba(176,80,80,0.2)',
    borderRadius: 'var(--radius-sm)', lineHeight: 1.5,
  },
  footer: {
    padding: '12px 20px',
    borderTop: '1px solid var(--border)',
    display: 'flex', gap: 8, justifyContent: 'flex-end',
    flexShrink: 0,
    minHeight: 56,
  },
};
