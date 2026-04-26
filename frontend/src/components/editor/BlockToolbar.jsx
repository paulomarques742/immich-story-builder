export default function BlockToolbar({ onMoveUp, onMoveDown, onDelete }) {
  return (
    <div style={styles.bar} onClick={(e) => e.stopPropagation()}>
      <button style={styles.btn} title="Mover para cima" onClick={onMoveUp}>↑</button>
      <button style={styles.btn} title="Mover para baixo" onClick={onMoveDown}>↓</button>
      <button style={{ ...styles.btn, ...styles.btnDanger }} title="Apagar bloco" onClick={onDelete}>✕</button>
    </div>
  );
}

const styles = {
  bar: { position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4, zIndex: 10 },
  btn: { width: 28, height: 28, border: 'none', borderRadius: 6, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  btnDanger: { background: 'rgba(180,40,40,.75)' },
};
