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
import PeopleFilter from '../components/viewer/PeopleFilter.jsx';
import { buildThemeVars, getTheme } from '../lib/themes.js';

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
  const [peopleVisible, setPeopleVisible] = useState(false);
  const [selectedPersonIds, setSelectedPersonIds] = useState(new Set());
  const [personAssetIds, setPersonAssetIds] = useState(new Set());
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [counts, setCounts] = useState({ likes: {}, comments: {} });
  const [likedByMe, setLikedByMe] = useState({});
  const [fingerprint, setFingerprint] = useState('');
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

  // Fingerprint anónimo persistido no localStorage
  useEffect(() => {
    let fp = localStorage.getItem('mv_fingerprint');
    if (!fp) {
      fp = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem('mv_fingerprint', fp);
    }
    setFingerprint(fp);
  }, []);

  // Carregar likes dados pelo utilizador neste browser
  useEffect(() => {
    if (!slug) return;
    setLikedByMe(JSON.parse(localStorage.getItem(`mv_liked_${slug}`) || '{}'));
  }, [slug]);

  // Buscar contagens de likes e comentários
  useEffect(() => {
    if (!slug || !blocks.length) return;
    axios.get(`/api/public/${slug}/counts`)
      .then((r) => setCounts(r.data))
      .catch(() => {});
  }, [slug, blocks]);

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

  // Load Google Fonts for the story theme
  useEffect(() => {
    if (!story?.theme) return;
    const config = typeof story.theme === 'string' ? JSON.parse(story.theme) : story.theme;
    const theme = getTheme(config.id);
    if (!theme.googleFontsUrl) return;
    const linkId = `theme-font-${theme.id}`;
    if (document.getElementById(linkId)) return;
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = theme.googleFontsUrl;
    document.head.appendChild(link);
  }, [story?.theme]);

  function handleLike(assetId) {
    if (!fingerprint) return;
    const wasLiked = !!likedByMe[assetId];
    // Optimistic update
    const newLiked = { ...likedByMe };
    if (wasLiked) delete newLiked[assetId]; else newLiked[assetId] = true;
    setLikedByMe(newLiked);
    localStorage.setItem(`mv_liked_${slug}`, JSON.stringify(newLiked));
    setCounts((prev) => ({
      ...prev,
      likes: { ...prev.likes, [assetId]: Math.max(0, (prev.likes[assetId] || 0) + (wasLiked ? -1 : 1)) },
    }));

    axios.post(`/api/public/${slug}/likes/${assetId}`, { fingerprint })
      .then((r) => {
        setCounts((prev) => ({ ...prev, likes: { ...prev.likes, [assetId]: r.data.count } }));
        const confirmed = { ...newLiked };
        if (r.data.liked) confirmed[assetId] = true; else delete confirmed[assetId];
        setLikedByMe(confirmed);
        localStorage.setItem(`mv_liked_${slug}`, JSON.stringify(confirmed));
      })
      .catch(() => {
        // Rollback on error
        setLikedByMe(likedByMe);
        localStorage.setItem(`mv_liked_${slug}`, JSON.stringify(likedByMe));
        setCounts((prev) => ({
          ...prev,
          likes: { ...prev.likes, [assetId]: Math.max(0, (prev.likes[assetId] || 0) + (wasLiked ? 1 : -1)) },
        }));
      });
  }

  function handleUnlock(token) {
    setLocked(false);
    load(token);
  }

  // Fetch asset IDs whenever selected people change (uses public endpoint)
  useEffect(() => {
    if (selectedPersonIds.size === 0) {
      setPersonAssetIds(new Set());
      return;
    }
    Promise.all([...selectedPersonIds].map((id) =>
      axios.get(`/api/public/${slug}/people/${id}/assets`).then((r) => r.data).catch(() => [])
    )).then((results) => {
      const sets = results.map((ids) => new Set(ids));
      const intersection = [...sets[0]].filter((id) => sets.every((s) => s.has(id)));
      setPersonAssetIds(new Set(intersection));
    });
  }, [selectedPersonIds, slug]);

  function togglePeople() {
    setPeopleVisible((v) => {
      if (v) {
        setSelectedPersonIds(new Set());
      }
      return !v;
    });
  }

  function togglePerson(personId) {
    setSelectedPersonIds((prev) => {
      const next = new Set(prev);
      next.has(personId) ? next.delete(personId) : next.add(personId);
      return next;
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

  // Only the first hero gets the full-screen top treatment; subsequent heroes render inline
  const firstHeroIdx = blocks.findIndex((b) => b.type === 'hero');
  const heroBlock = firstHeroIdx >= 0 ? blocks[firstHeroIdx] : null;
  const bodyBlocks = blocks.filter((_, i) => i !== firstHeroIdx);
  const sections = groupIntoSections(bodyBlocks);
  const photoRegistry = buildPhotoRegistry(blocks);

  // Count total photos for footer
  const photoCount = photoRegistry.length;

  const themeVars = buildThemeVars(story.theme);

  return (
    <div className="mv-viewer" style={themeVars}>
      {/* Topbar */}
      <ViewerTopbar
        onPeopleToggle={togglePeople}
        peopleVisible={peopleVisible}
        storyTitle={story.title}
      />

      {/* People filter panel */}
      {peopleVisible && (
        <PeopleFilter
          slug={slug}
          selectedIds={selectedPersonIds}
          onToggle={togglePerson}
        />
      )}

      {/* Side navigation */}
      <StoryNav blocks={bodyBlocks} visible={true} />

      {/* Hero */}
      {heroBlock && (
        <ViewerBlock
          block={heroBlock}
          story={story}
          onPhotoOpen={(idx) => setLightboxIndex(idx)}
          photoRegistry={photoRegistry}
          
          personAssetIds={personAssetIds}
          likeCounts={counts.likes}
          commentCounts={counts.comments}
          likedByMe={likedByMe}
          onLike={handleLike}
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
                
                personAssetIds={personAssetIds}
                likeCounts={counts.likes}
                commentCounts={counts.comments}
                likedByMe={likedByMe}
                onLike={handleLike}
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
