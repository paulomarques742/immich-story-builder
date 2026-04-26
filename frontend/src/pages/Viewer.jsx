import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import ViewerBlock from '../components/viewer/ViewerBlock.jsx';
import StoryNav from '../components/viewer/StoryNav.jsx';
import UnlockModal from '../components/viewer/UnlockModal.jsx';
import CommentSection from '../components/viewer/CommentSection.jsx';

export default function Viewer() {
  const { slug } = useParams();
  const [story, setStory] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [locked, setLocked] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [search, setSearch] = useState('');
  const [commentAsset, setCommentAsset] = useState(null); // assetId for open comment panel

  function storyToken() {
    return sessionStorage.getItem(`story_token_${slug}`) || undefined;
  }

  async function load(token) {
    try {
      const headers = token ? { 'x-story-token': token } : {};
      const r = await axios.get(`/api/public/${slug}`, { headers });
      setStory(r.data.story);
      if (r.data.locked) {
        setLocked(true);
      } else {
        setBlocks(r.data.blocks || []);
        setLocked(false);
      }
    } catch (err) {
      if (err.response?.status === 404) setNotFound(true);
    }
  }

  useEffect(() => {
    load(storyToken());
  }, [slug]);

  function handleUnlock(token) {
    setLocked(false);
    load(token);
  }

  if (notFound) {
    return (
      <div style={s.center}>
        <h1 style={{ fontSize: 48, color: '#ccc' }}>404</h1>
        <p style={{ color: '#888' }}>Esta story não existe ou não está publicada.</p>
      </div>
    );
  }

  if (!story) return <div style={s.center}>A carregar…</div>;

  if (locked) return <UnlockModal slug={slug} onUnlock={handleUnlock} />;

  return (
    <div style={s.page}>
      {/* Floating search bar */}
      <div style={s.searchBar}>
        <input
          style={s.searchInput}
          type="search"
          placeholder="🔍 Pesquisar…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button style={s.clearBtn} onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      {/* Side navigation from dividers */}
      <StoryNav blocks={blocks} visible={!search} />

      {/* Blocks */}
      <main style={s.content}>
        {blocks.map((block) => (
          <ViewerBlock
            key={block.id}
            block={block}
            searchTerm={search}
            onPhotoClick={(assetId) => setCommentAsset(assetId)}
          />
        ))}
      </main>

      {/* Comment panel */}
      {commentAsset && (
        <CommentSection
          slug={slug}
          assetId={commentAsset}
          onClose={() => setCommentAsset(null)}
        />
      )}
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#fff' },
  content: { maxWidth: '100%' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 8 },
  searchBar: { position: 'fixed', top: 16, right: 16, zIndex: 200, display: 'flex', alignItems: 'center', gap: 0, background: '#fff', borderRadius: 24, boxShadow: '0 2px 12px rgba(0,0,0,.12)', overflow: 'hidden' },
  searchInput: { border: 'none', outline: 'none', padding: '9px 16px', fontSize: 14, width: 220, background: 'transparent' },
  clearBtn: { background: 'none', border: 'none', padding: '0 12px', fontSize: 14, color: '#aaa', cursor: 'pointer' },
};
