export default function BlockToolbar({ onMoveUp, onMoveDown, onDelete }) {
  return (
    <div style={s.bar} onClick={(e) => e.stopPropagation()}>
      <button style={s.btn} title="Mover para cima" onClick={onMoveUp}>↑</button>
      <button style={s.btn} title="Mover para baixo" onClick={onMoveDown}>↓</button>
      <button style={{ ...s.btn, ...s.btnDanger }} title="Apagar bloco" onClick={onDelete}>✕</button>
    </div>
  );
}

const s = {
  bar: {
    position: 'absolute',
    top: 8,
    right: 8,
    display: 'flex',
    gap: 3,
    zIndex: 10,
    opacity: 0,
    transition: 'opacity 0.15s',
  },
  btn: {
    width: 26,
    height: 26,
    border: 'none',
    borderRadius: 6,
    background: 'rgba(17,24,39,0.65)',
    color: '#fff',
    fontSize: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(4px)',
    transition: 'background 0.12s',
  },
  btnDanger: { background: 'rgba(185,28,28,0.75)' },
};
