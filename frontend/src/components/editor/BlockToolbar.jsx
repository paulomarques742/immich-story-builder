export default function BlockToolbar({ onMoveUp, onMoveDown, onDelete }) {
  return (
    <div style={s.bar} onClick={(e) => e.stopPropagation()}>
      <button className="block-tb-btn" style={s.btn} title="Mover para cima" onClick={onMoveUp}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
      <button className="block-tb-btn" style={s.btn} title="Mover para baixo" onClick={onMoveDown}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <button className="block-tb-btn tb-danger" style={s.btn} title="Apagar bloco" onClick={onDelete}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
        </svg>
      </button>
    </div>
  );
}

const s = {
  bar: {
    position: 'absolute',
    top: 8,
    right: 8,
    display: 'flex',
    gap: 4,
    zIndex: 10,
    opacity: 0,
    transition: 'opacity 0.15s',
  },
  btn: {
    width: 30,
    height: 30,
    border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.88)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(8px)',
    boxShadow: 'var(--shadow-sm)',
    padding: 0,
  },
};
