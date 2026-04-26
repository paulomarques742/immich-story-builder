import HeroBlock from '../blocks/HeroBlock.jsx';
import GridBlock from '../blocks/GridBlock.jsx';
import TextBlock from '../blocks/TextBlock.jsx';

export default function ViewerBlock({ block }) {
  const content = typeof block.content === 'string' ? JSON.parse(block.content) : block.content;

  switch (block.type) {
    case 'hero': return <HeroBlock content={content} />;
    case 'grid': return <GridBlock content={content} />;
    case 'text': return <TextBlock content={content} />;
    case 'divider': return (
      <div style={{ padding: '24px 32px', textAlign: 'center', color: '#aaa' }}>
        <hr style={{ border: 'none', borderTop: '1px solid #e0e0e0', margin: '0 auto 12px', maxWidth: 200 }} />
        {content.label && <span style={{ fontSize: 13 }}>{content.label}</span>}
      </div>
    );
    default: return null;
  }
}
