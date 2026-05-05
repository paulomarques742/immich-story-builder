export default function AiProgressModal({ status, progress, processed, total, blocksCreated, error, onClose, onRetry }) {
  const isDone = status === 'done';
  const isError = status === 'error';
  const isActive = status === 'loading' || status === 'processing';

  return (
    <div className="fixed inset-0 bg-ink/45 flex items-center justify-center z-[400] backdrop-blur-sm">
      <div className="bg-paper border border-border rounded-lg flex flex-col shadow-lg overflow-hidden" style={{ width: 420, maxWidth: 'calc(100vw - 2rem)' }}>

        <div className="px-[22px] pt-[18px] pb-[14px] border-b border-border shrink-0">
          <h3 className="font-display text-[19px] font-medium text-ink">
            {isDone ? '✨ Story gerada' : isError ? 'Erro no AI Layout' : '✨ A gerar story…'}
          </h3>
        </div>

        <div className="px-[22px] py-5 flex flex-col gap-2.5">
          {isActive && (
            <>
              <div className="h-[3px] rounded-full bg-paper-deep overflow-hidden">
                <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-sm font-normal text-ink text-center">
                {total > 0 ? `${processed} / ${total} fotos analisadas` : 'A preparar…'}
              </p>
              <p className="text-xs font-light text-ink-faint text-center">Este processo pode demorar alguns minutos.</p>
            </>
          )}

          {isDone && (
            <>
              <div className="h-[3px] rounded-full bg-paper-deep overflow-hidden">
                <div className="h-full rounded-full transition-[width] duration-300" style={{ width: '100%', background: 'var(--success, #22c55e)' }} />
              </div>
              <p className="text-sm font-normal text-ink text-center">{blocksCreated} blocos criados</p>
              <p className="text-xs font-light text-ink-faint text-center">A story foi gerada. Podes editar qualquer bloco manualmente.</p>
            </>
          )}

          {isError && (
            <p className="text-sm font-light text-danger px-3 py-2.5 bg-danger/6 border border-danger/20 rounded-sm leading-relaxed">{error || 'Ocorreu um erro durante a análise.'}</p>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex gap-2 justify-end shrink-0 min-h-[56px]">
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
