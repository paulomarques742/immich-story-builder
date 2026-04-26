import ReactMarkdown from 'react-markdown';

const MAX_WIDTH = { prose: '65ch', wide: '100%', narrow: '45ch' };

export default function TextBlock({ content }) {
  const { markdown = '', align = 'left', max_width = 'prose' } = content;

  return (
    <div style={{
      padding: '32px 24px',
      maxWidth: MAX_WIDTH[max_width] || '65ch',
      margin: '0 auto',
      textAlign: align,
      lineHeight: 1.7,
    }}>
      <div className="prose">
        <ReactMarkdown>{markdown || '*Sem conteúdo*'}</ReactMarkdown>
      </div>
    </div>
  );
}
