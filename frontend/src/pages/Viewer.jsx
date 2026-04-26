import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api.js';
import ViewerBlock from '../components/viewer/ViewerBlock.jsx';

export default function Viewer() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/public/${slug}`)
      .then((r) => setData(r.data))
      .catch((err) => setError(err.response?.status === 404 ? '404' : 'Erro'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div style={styles.center}>A carregar...</div>;

  if (error === '404') {
    return (
      <div style={styles.center}>
        <h1 style={{ fontSize: 48, color: '#ccc' }}>404</h1>
        <p style={{ color: '#888' }}>Esta story não existe ou não está publicada.</p>
      </div>
    );
  }

  if (error) return <div style={styles.center}>Ocorreu um erro.</div>;

  const { story, blocks } = data;

  return (
    <div style={styles.page}>
      <div style={styles.content}>
        {blocks.map((block) => (
          <ViewerBlock key={block.id} block={block} />
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#fff' },
  content: { maxWidth: '100%' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 8 },
};
