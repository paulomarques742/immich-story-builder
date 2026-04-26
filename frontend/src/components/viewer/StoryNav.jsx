export default function StoryNav({ blocks, visible }) {
  // Build nav from divider blocks (and text blocks starting with a heading)
  const sections = blocks
    .filter((b) => {
      if (b.type === 'divider') {
        const c = parse(b);
        return !!c.label;
      }
      if (b.type === 'text') {
        const c = parse(b);
        return c.markdown?.trimStart().startsWith('#');
      }
      return false;
    })
    .map((b) => {
      const c = parse(b);
      let label = '';
      if (b.type === 'divider') label = c.label;
      if (b.type === 'text') label = c.markdown.match(/^#+\s*(.+)/m)?.[1] || '';
      return { id: b.id, label };
    });

  if (!visible || sections.length === 0) return null;

  function scrollTo(id) {
    document.getElementById(`block-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <nav style={s.nav}>
      <p style={s.label}>Secções</p>
      {sections.map((sec) => (
        <button key={sec.id} style={s.item} onClick={() => scrollTo(sec.id)}>
          {sec.label}
        </button>
      ))}
    </nav>
  );
}

function parse(block) {
  try { return typeof block.content === 'string' ? JSON.parse(block.content) : block.content; }
  catch { return {}; }
}

const s = {
  nav: { position: 'fixed', left: 0, top: '50%', transform: 'translateY(-50%)', background: '#fff', border: '1px solid #eee', borderRadius: '0 10px 10px 0', boxShadow: '2px 2px 12px rgba(0,0,0,.07)', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 2, zIndex: 100, maxWidth: 180, maxHeight: '70vh', overflowY: 'auto' },
  label: { fontSize: 10, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1, padding: '0 14px 6px', borderBottom: '1px solid #f0f0f0', marginBottom: 4 },
  item: { background: 'none', border: 'none', textAlign: 'left', padding: '5px 14px', fontSize: 12, color: '#555', cursor: 'pointer', lineHeight: 1.4, wordBreak: 'break-word' },
};
