import HeroBlock from '../blocks/HeroBlock.jsx';
import GridBlock from '../blocks/GridBlock.jsx';
import TextBlock from '../blocks/TextBlock.jsx';
import MapBlock from '../blocks/MapBlock.jsx';
import VideoBlock from '../blocks/VideoBlock.jsx';

function parse(block) {
  try { return typeof block.content === 'string' ? JSON.parse(block.content) : block.content; }
  catch { return {}; }
}

export default function ViewerBlock({ block, onPhotoClick, searchTerm }) {
  const content = parse(block);
  const matched = !searchTerm || blockMatchesSearch(block, content, searchTerm);

  const style = matched ? undefined : { opacity: 0.15, pointerEvents: 'none' };

  switch (block.type) {
    case 'hero':
      return <div id={`block-${block.id}`} style={style}><HeroBlock content={content} /></div>;

    case 'grid':
      return (
        <div id={`block-${block.id}`} style={style}>
          <GridBlock content={content} onPhotoClick={onPhotoClick} />
        </div>
      );

    case 'text':
      return <div id={`block-${block.id}`} style={style}><TextBlock content={content} /></div>;

    case 'map':
      return <div id={`block-${block.id}`} style={style}><MapBlock content={content} /></div>;

    case 'video':
      return <div id={`block-${block.id}`} style={style}><VideoBlock content={content} /></div>;

    case 'divider':
      return (
        <div id={`block-${block.id}`} style={{ padding: '24px 32px', textAlign: 'center', color: '#aaa', ...style }}>
          <hr style={{ border: 'none', borderTop: '1px solid #e0e0e0', margin: '0 auto 12px', maxWidth: 200 }} />
          {content.label && <span style={{ fontSize: 13 }}>{content.label}</span>}
        </div>
      );

    default:
      return null;
  }
}

function blockMatchesSearch(block, content, term) {
  const t = term.toLowerCase();
  if (block.type === 'hero') return (content.caption || '').toLowerCase().includes(t);
  if (block.type === 'text') return (content.markdown || '').toLowerCase().includes(t);
  if (block.type === 'divider') return (content.label || '').toLowerCase().includes(t);
  if (block.type === 'video') return (content.caption || '').toLowerCase().includes(t);
  if (block.type === 'map') return (content.label || '').toLowerCase().includes(t);
  return true; // grid always shown
}
