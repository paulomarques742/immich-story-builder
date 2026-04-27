import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import ViewerBlock from '../components/viewer/ViewerBlock.jsx';
import StoryNav from '../components/viewer/StoryNav.jsx';
import UnlockModal from '../components/viewer/UnlockModal.jsx';
import Lightbox from '../components/viewer/Lightbox.jsx';
import ViewerTopbar from '../components/viewer/ViewerTopbar.jsx';
import ViewerFooter from '../components/viewer/ViewerFooter.jsx';
import GlobalComments from '../components/viewer/GlobalComments.jsx';

function parse(block) {
  try { return typeof block.content === 'string' ? JSON.parse(block.content) : block.content; }
  catch { return {}; }
}

// Build a flat registry of all clickable photos in DOM order
function buildPhotoRegistry(blocks) {
  const registry = [];
  blocks.forEach((block) => {
    if (block.type !== 'grid') return;
    const content = parse(block);
    const { asset_ids = [], caption } = content;
    asset_ids.forEach((assetId) => {
      registry.push({ assetId, caption: caption || '' });
    });
  });
  return registry;
}

// Group blocks into sections (each divider starts a new section)
function groupIntoSections(blocks) {
  const sections = [];
  let current = { id: null, blocks: [] };

  blocks.forEach((block) => {
    if (block.type === 'divider') {
      // Start new section with the divider as first item
      if (current.blocks.length > 0) {
        sections.push(current);
      }
      current = { id: block.id, blocks: [block] };
    } else {
      current.blocks.push(block);
    }
  });

  if (current.blocks.length > 0) sections.push(current);
  return sections;
}

export default function Viewer() {
  const { slug } = useParams();
  const [story, setStory] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [locked, setLocked] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [search, setSearch] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const sectionsRef = useRef([]);

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

  useEffect(() => { load(storyToken()); }, [slug]);

  // Scroll reveal via IntersectionObserver
  useEffect(() => {
    if (blocks.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('mv-visible');
      }),
      { threshold: 0.08 }
    );
    setTimeout(() => {
      document.querySelectorAll('.mv-section').forEach((el) => observer.observe(el));
    }, 100);
    return () => observer.disconnect();
  }, [blocks]);

  // Update document title
  useEffect(() => {
    if (story?.title) document.title = `${story.title} · Memoire`;
  }, [story]);

  function handleUnlock(token) {
    setLocked(false);
    load(token);
  }

  function toggleSearch() {
    setSearchVisible((v) => {
      if (v) setSearch('');
      return !v;
    });
  }

  if (notFound) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12, background: 'var(--paper)', fontFamily: 'var(--font-body)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '5rem', fontWeight: 300, color: 'var(--ink-faint)' }}>404</h1>
        <p style={{ color: 'var(--ink-muted)', fontSize: '1rem' }}>Esta story não existe ou não está publicada.</p>
        <a href="/" style={{ color: 'var(--mv-accent)', fontSize: '0.875rem', marginTop: 8 }}>← Voltar ao início</a>
      </div>
    );
  }

  if (!story) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--paper)', fontFamily: 'var(--font-body)', color: 'var(--ink-muted)', fontSize: '0.875rem' }}>
        A carregar…
      </div>
    );
  }

  if (locked) return <UnlockModal slug={slug} onUnlock={handleUnlock} />;

  // Separate hero from body blocks
  const heroBlock = blocks.find((b) => b.type === 'hero');
  const bodyBlocks = blocks.filter((b) => b.type !== 'hero');
  const sections = groupIntoSections(bodyBlocks);
  const photoRegistry = buildPhotoRegistry(blocks);

  // Count total photos for footer
  const photoCount = photoRegistry.length;

  return (
    <div className="mv-viewer">
      {/* Topbar */}
      <ViewerTopbar
        onSearchToggle={toggleSearch}
        searchVisible={searchVisible}
        storyTitle={story.title}
      />

      {/* Search bar (below topbar when visible) */}
      {searchVisible && (
        <div style={{
          position: 'fixed', top: 52, left: 0, right: 0, zIndex: 99,
          background: 'color-mix(in srgb, var(--paper-warm) 95%, transparent)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--paper-deep)',
          padding: '0.6rem 2rem',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          animation: 'fadeUp 200ms var(--ease-out) both',
        }}>
          <input
            autoFocus
            type="search"
            placeholder="Pesquisar na story…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent', fontFamily: 'var(--font-body)',
              fontSize: '0.9rem', fontWeight: 300, color: 'var(--ink)',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', fontSize: 14, cursor: 'pointer', padding: '0 4px' }}
            >✕</button>
          )}
        </div>
      )}

      {/* Side navigation */}
      <StoryNav blocks={bodyBlocks} visible={!search} />

      {/* Hero */}
      {heroBlock && (
        <ViewerBlock
          block={heroBlock}
          story={story}
          onPhotoOpen={(idx) => setLightboxIndex(idx)}
          photoRegistry={photoRegistry}
          searchTerm={search}
        />
      )}

      {/* Story body */}
      <main className="mv-story-body" style={{ paddingTop: heroBlock ? 0 : '5rem' }}>
        {sections.map((section, i) => (
          <section
            key={section.id ?? i}
            className="mv-section"
            id={section.id ? `block-${section.id}` : undefined}
          >
            {section.blocks.map((block) => (
              <ViewerBlock
                key={block.id}
                block={block}
                story={story}
                onPhotoOpen={(idx) => setLightboxIndex(idx)}
                photoRegistry={photoRegistry}
                searchTerm={search}
              />
            ))}
          </section>
        ))}

        {/* Global comments */}
        <GlobalComments slug={slug} />
      </main>

      {/* Footer */}
      <ViewerFooter story={story} photoCount={photoCount} />

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          slug={slug}
          photoRegistry={photoRegistry}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
