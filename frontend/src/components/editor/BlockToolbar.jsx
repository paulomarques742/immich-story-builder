export default function BlockToolbar({ onMoveUp, onMoveDown, onDelete }) {
  return (
    <div
      className="absolute top-2 right-2 flex gap-0.5 z-10 opacity-0 transition-opacity duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="block-tb-btn w-[30px] h-[30px] border border-paper-deep rounded bg-paper/90 backdrop-blur-sm text-ink-muted cursor-pointer flex items-center justify-center p-0 shadow-xs"
        title="Mover para cima"
        onClick={onMoveUp}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
      <button
        className="block-tb-btn w-[30px] h-[30px] border border-paper-deep rounded bg-paper/90 backdrop-blur-sm text-ink-muted cursor-pointer flex items-center justify-center p-0 shadow-xs"
        title="Mover para baixo"
        onClick={onMoveDown}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <button
        className="block-tb-btn tb-danger w-[30px] h-[30px] border border-paper-deep rounded bg-paper/90 backdrop-blur-sm text-ink-muted cursor-pointer flex items-center justify-center p-0 shadow-xs"
        title="Apagar bloco"
        onClick={onDelete}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
        </svg>
      </button>
    </div>
  );
}
