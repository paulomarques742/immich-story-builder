const { v4: uuidv4 } = require('uuid');
const { generateNarrative, generateCaption, generateStoryConcepts } = require('./gemini');
const { scoreFromImmichData, buildAlbumSummary, selectRepresentativeAssets } = require('./immichMetadata');

// ── Geo helpers ───────────────────────────────────────────────────

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sameLocation(a, b) {
  if (a.score.city && b.score.city) return a.score.city === b.score.city;
  if (a.score.lat && b.score.lat) return haversineKm(a.score.lat, a.score.lng, b.score.lat, b.score.lng) < 50;
  return true;
}

// ── Strategy selection ────────────────────────────────────────────

/**
 * Decides the best grouping strategy based on the distribution of the scored assets.
 * Returns 'location' | 'day' | 'theme'.
 *
 * Rules (in priority order):
 *  1. LOCATION — if photos span ≥ 2 distinct cities, or GPS points are >50 km apart
 *  2. DAY      — if the album covers ≥ 3 distinct calendar days (concentrated location / same trip day by day)
 *  3. THEME    — fallback: group by visual theme
 */
function chooseStrategy(scoredAssets) {
  const images = scoredAssets.filter((a) => a.assetType !== 'VIDEO');
  if (!images.length) return 'theme';

  // Location diversity
  const cities = [...new Set(images.map((a) => a.score.city).filter(Boolean))];
  let locationDiverse = cities.length >= 2;

  if (!locationDiverse) {
    const gpsItems = images.filter((a) => a.score.lat != null && a.score.lng != null);
    if (gpsItems.length >= 2) {
      for (let i = 0; i < gpsItems.length && !locationDiverse; i++) {
        for (let j = i + 1; j < gpsItems.length; j++) {
          if (haversineKm(gpsItems[i].score.lat, gpsItems[i].score.lng, gpsItems[j].score.lat, gpsItems[j].score.lng) > 50) {
            locationDiverse = true;
            break;
          }
        }
      }
    }
  }

  if (locationDiverse) return 'location';

  // Temporal diversity
  const days = new Set(images.map((a) => a.asset.fileCreatedAt?.slice(0, 10)).filter(Boolean));
  if (days.size >= 3) return 'day';

  return 'theme';
}

// ── Grouping strategies ───────────────────────────────────────────

function chronoSort(items) {
  return [...items].sort((a, b) => new Date(a.asset.fileCreatedAt || 0) - new Date(b.asset.fileCreatedAt || 0));
}

function dominantTheme(items) {
  const counts = {};
  items.forEach((a) => { if (a.score.theme) counts[a.score.theme] = (counts[a.score.theme] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'travel';
}

/** Groups chronologically by calendar day (YYYY-MM-DD). */
function groupByDay(scoredAssets) {
  const sorted = chronoSort(scoredAssets);
  const dayMap = new Map();

  for (const item of sorted) {
    const day = item.asset.fileCreatedAt?.slice(0, 10) || 'unknown';
    if (!dayMap.has(day)) dayMap.set(day, []);
    dayMap.get(day).push(item);
  }

  return [...dayMap.entries()].map(([date, items]) => {
    const locationAsset = items.find((a) => a.score.city) || items[0];
    return {
      strategy: 'day',
      theme: dominantTheme(items),
      items,
      date,
      city: locationAsset.score.city || null,
      country: locationAsset.score.country || null,
    };
  });
}

/** Groups by consecutive theme runs, merging runs < 3 items. */
function groupByThemePure(items) {
  if (!items.length) return [];

  const groups = [];
  let current = [items[0]];

  for (let i = 1; i < items.length; i++) {
    if (items[i].score.theme === current[0].score.theme) {
      current.push(items[i]);
    } else {
      groups.push(current);
      current = [items[i]];
    }
  }
  groups.push(current);

  const merged = [];
  for (let i = 0; i < groups.length; i++) {
    if (groups[i].length < 3) {
      if (merged.length > 0) {
        merged[merged.length - 1].push(...groups[i]);
      } else if (i + 1 < groups.length) {
        groups[i + 1] = [...groups[i], ...groups[i + 1]];
      } else {
        merged.push(groups[i]);
      }
    } else {
      merged.push(groups[i]);
    }
  }

  return merged.map((grpItems) => ({
    strategy: 'theme',
    theme: grpItems[0].score.theme,
    items: grpItems,
    date: null,
    city: null,
    country: null,
  }));
}

/** Groups by location cluster, then by theme within each cluster. */
function groupByLocation(scoredAssets) {
  const sorted = chronoSort(scoredAssets);

  const locationClusters = [];
  for (const item of sorted) {
    const last = locationClusters[locationClusters.length - 1];
    if (last && sameLocation(last[last.length - 1], item)) {
      last.push(item);
    } else {
      locationClusters.push([item]);
    }
  }

  const groups = [];
  for (const cluster of locationClusters) {
    const themeGroups = groupByThemePure(cluster);
    const locationAsset = cluster.find((a) => a.score.city || a.score.lat) || cluster[0];
    for (const g of themeGroups) {
      groups.push({
        ...g,
        strategy: 'location',
        city: locationAsset.score.city || null,
        country: locationAsset.score.country || null,
      });
    }
  }

  return groups;
}

/** Top-level: pick strategy, return groups with `strategy` tag. */
function groupAssets(scoredAssets) {
  const strategy = chooseStrategy(scoredAssets);
  console.log(`[AI Layout] Strategy chosen: ${strategy}`);

  switch (strategy) {
    case 'location': return groupByLocation(scoredAssets);
    case 'day':      return groupByDay(scoredAssets);
    default:         return groupByThemePure(chronoSort(scoredAssets));
  }
}

// ── Divider label helpers ─────────────────────────────────────────

function formatDayLabel(dateStr) {
  if (!dateStr || dateStr === 'unknown') return '';
  try {
    // Parse as noon UTC to avoid timezone day-shift
    const d = new Date(dateStr + 'T12:00:00Z');
    return d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return dateStr;
  }
}

function buildDividerLabel(group) {
  switch (group.strategy) {
    case 'location': {
      const parts = [
        group.theme.charAt(0).toUpperCase() + group.theme.slice(1),
        group.city,
      ].filter(Boolean);
      return parts.join(' · ');
    }
    case 'day': {
      const parts = [formatDayLabel(group.date), group.city].filter(Boolean);
      return parts.join(' · ');
    }
    default: // theme
      return group.theme.charAt(0).toUpperCase() + group.theme.slice(1);
  }
}

// ── Map block builder (single story-wide map) ─────────────────────

function buildStoryMap(groups, position) {
  const allItems = groups.flatMap((g) => g.items);
  const gpsItems = allItems
    .filter((a) => a.assetType !== 'VIDEO' && a.score.lat != null && a.score.lng != null)
    .sort((a, b) => b.score.score - a.score.score)
    .slice(0, 30);

  if (!gpsItems.length) return null;

  const markers = gpsItems.map((a) => ({
    lat: a.score.lat,
    lng: a.score.lng,
    label: a.score.subject || a.score.city || '',
  }));

  return {
    id: uuidv4(),
    type: 'map',
    position,
    content: JSON.stringify({
      mode: 'auto',
      resolved_markers: markers,
      show_route: markers.length >= 2,
      route_color: '#E07B54',
      zoom: 8,
    }),
  };
}

// ── Grid variety builder ──────────────────────────────────────────

/**
 * Distributes images across varied grid layouts based on score tiers:
 *  ≥8 (1 photo)  → single full-width (columns:1)
 *  ≥8 (2–4)     → portrait duo (columns:2, aspect:portrait)
 *  ≥8 (5+)      → asymmetric magazine (columns:2, aspect:auto)
 *  6–7           → asymmetric magazine (columns:2, aspect:auto)
 *  4–5           → 3-column grid
 *  <4            → 4-column grid
 */
function buildGridBlocks(items) {
  const sorted = [...items].sort((a, b) => b.score.score - a.score.score);

  const tier1 = sorted.filter((a) => a.score.score >= 8);
  const tier2 = sorted.filter((a) => a.score.score >= 6 && a.score.score < 8);
  const tier3 = sorted.filter((a) => a.score.score >= 4 && a.score.score < 6);
  const tier4 = sorted.filter((a) => a.score.score < 4);

  const blocks = [];

  function addGrid(assetItems, columns, aspect) {
    if (!assetItems.length) return;
    blocks.push({
      id: uuidv4(), type: 'grid',
      content: JSON.stringify({ asset_ids: assetItems.map((a) => a.asset.id), columns, gap: 'sm', aspect }),
    });
  }

  if (tier1.length === 1) {
    addGrid(tier1, 1, 'auto');
  } else if (tier1.length <= 4) {
    addGrid(tier1, 2, 'portrait');
  } else {
    addGrid(tier1, 2, 'auto');
  }

  addGrid(tier2, 2, 'auto');
  addGrid(tier3, 3, 'square');
  addGrid(tier4, 4, 'square');

  return blocks;
}

function topAssets(group, n = 3) {
  return [...group.items]
    .filter((a) => a.assetType !== 'VIDEO')
    .sort((a, b) => b.score.score - a.score.score)
    .slice(0, n);
}

// ── Block generation ──────────────────────────────────────────────

async function generateBlocksFromGroups(groups, language, fetchThumbFn) {
  const rawBlocks = [];

  const allImageItems = groups.flatMap((g) => g.items).filter((a) => a.assetType !== 'VIDEO');
  if (!allImageItems.length) return rawBlocks;

  const bestOverall = allImageItems.reduce((best, cur) => (cur.score.score > best.score.score ? cur : best));

  // Opening hero
  rawBlocks.push({
    id: uuidv4(), type: 'hero',
    content: JSON.stringify({
      asset_id: bestOverall.asset.id,
      caption: bestOverall.score.caption_pt || '',
      overlay: true, height: 'full',
      title: bestOverall.score.title_pt || '',
    }),
  });

  // Single story-wide map (placed right after opening hero if GPS data exists)
  const storyMap = buildStoryMap(groups, 0);
  if (storyMap) rawBlocks.push({ id: storyMap.id, type: 'map', content: storyMap.content });

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const isFirst = gi === 0;

    const imageItems = group.items.filter((a) => a.assetType !== 'VIDEO');
    const videoItems = group.items.filter((a) => a.assetType === 'VIDEO');

    // Divider between groups
    if (!isFirst) {
      rawBlocks.push({
        id: uuidv4(), type: 'divider',
        content: JSON.stringify({ style: 'line', label: buildDividerLabel(group) }),
      });
    }

    // Narrative text
    const best3 = topAssets(group, 3);
    const thumbsBase64 = await Promise.all(
      best3.map((a) => fetchThumbFn(a.asset.id).catch(() => null))
    ).then((arr) => arr.filter(Boolean));

    const narrative = thumbsBase64.length
      ? await generateNarrative(thumbsBase64, group.theme, language, { city: group.city, country: group.country, date: group.date })
      : '';

    if (narrative) {
      rawBlocks.push({
        id: uuidv4(), type: 'text',
        content: JSON.stringify({ markdown: narrative, align: 'left', max_width: 'prose' }),
      });
    }

    // Quote from the best photo's caption — gives "read → feel → see" rhythm before the hero
    const bestInGroup = topAssets(group, 1)[0];
    if (bestInGroup && bestInGroup.score.caption_pt) {
      rawBlocks.push({
        id: uuidv4(), type: 'quote',
        content: JSON.stringify({ quote: bestInGroup.score.caption_pt, author: '' }),
      });
    }

    // Hero for the best image in group
    if (bestInGroup && bestInGroup.asset.id !== bestOverall.asset.id) {
      rawBlocks.push({
        id: uuidv4(), type: 'hero',
        content: JSON.stringify({
          asset_id: bestInGroup.asset.id,
          caption: bestInGroup.score.caption_pt || '',
          overlay: true, height: 'full',
          title: bestInGroup.score.title_pt || '',
        }),
      });
    }

    // Varied grids — exclude the group hero and the opening hero
    const remaining = imageItems.filter(
      (a) => a.asset.id !== bestInGroup?.asset.id && a.asset.id !== bestOverall.asset.id
    );
    const gridBlocks = buildGridBlocks(remaining);
    rawBlocks.push(...gridBlocks);

    // Video blocks
    for (const v of videoItems) {
      rawBlocks.push({
        id: uuidv4(), type: 'video',
        content: JSON.stringify({ asset_id: v.asset.id, caption: v.score.caption_pt || '', autoplay: false, loop: false }),
      });
    }
  }

  // Closing text
  const closingThumb = await fetchThumbFn(bestOverall.asset.id).catch(() => null);
  if (closingThumb) {
    const lastGroup = groups[groups.length - 1];
    const closing = await generateNarrative([closingThumb], 'closing', language,
      { city: lastGroup?.city, country: lastGroup?.country });
    if (closing) {
      rawBlocks.push({
        id: uuidv4(), type: 'text',
        content: JSON.stringify({ markdown: closing, align: 'center', max_width: 'prose' }),
      });
    }
  }

  // Assign sequential positions
  return rawBlocks.map((b, i) => ({ ...b, position: i }));
}

// ── Shared asset fetching ─────────────────────────────────────────

async function fetchAlbumAssets(albumIds, immichClient) {
  let assets = [];
  for (const albumId of albumIds) {
    const res = await immichClient.get(`/albums/${albumId}`);
    assets.push(...(res.data.assets || []));
  }
  const seen = new Set();
  return assets.filter((a) => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });
}

function makeFetchThumb(immichClient) {
  return async (assetId) => {
    const res = await immichClient.get(`/assets/${assetId}/thumbnail`, {
      params: { size: 'preview' },
      responseType: 'arraybuffer',
    });
    return Buffer.from(res.data).toString('base64');
  };
}

// ── Immich-based scoring (no Gemini per photo) ────────────────────

function scoreAssetsFromImmich(assets, db) {
  const cacheStmt = db.prepare("SELECT * FROM asset_ai_scores WHERE asset_id = ? AND analysed_at > datetime('now', '-30 days')");
  const insertCache = db.prepare(`
    INSERT OR REPLACE INTO asset_ai_scores
      (asset_id, score, theme, mood, is_hero, subject, suggested_caption, title_pt,
       city, country, lat, lng, people_json, tags_json, is_favorite, exif_rating, source, analysed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  return assets.map((asset) => {
    const cached = cacheStmt.get(asset.id);
    if (cached) {
      return {
        asset,
        score: { ...cached, caption_pt: cached.suggested_caption || '' },
        assetType: asset.type || 'IMAGE',
      };
    }

    const s = scoreFromImmichData(asset);

    insertCache.run(
      asset.id, s.score, s.theme, s.mood,
      s.is_hero ? 1 : 0, s.subject, s.suggested_caption, s.title_pt,
      s.city, s.country, s.lat, s.lng,
      s.people_json, s.tags_json, s.is_favorite, s.exif_rating, s.source,
    );

    return { asset, score: { ...s, caption_pt: '' }, assetType: asset.type || 'IMAGE' };
  });
}

// ── Caption generation for featured photos only ───────────────────

async function addCaptionsToFeatured(groups, fetchThumbFn) {
  if (!process.env.GEMINI_API_KEY) return;

  const allImages = groups.flatMap((g) => g.items).filter((a) => a.assetType !== 'VIDEO');
  if (!allImages.length) return;

  const bestOverall = allImages.reduce((b, c) => (c.score.score > b.score.score ? c : b));
  const featured = new Map([[bestOverall.asset.id, bestOverall]]);

  for (const group of groups) {
    const best = topAssets(group, 1)[0];
    if (best) featured.set(best.asset.id, best);
  }

  await Promise.all([...featured.values()].map(async (item) => {
    const thumb = await fetchThumbFn(item.asset.id).catch(() => null);
    if (!thumb) return;

    const people = JSON.parse(item.score.people_json || '[]').map((p) => p.name).filter(Boolean);
    const caption = await generateCaption(thumb, 'image/jpeg', {
      city: item.score.city,
      country: item.score.country,
      date: item.asset.fileCreatedAt,
      people,
    });
    item.score.suggested_caption = caption;
    item.score.caption_pt = caption;
  }));
}

// ── Main orchestrator ─────────────────────────────────────────────

/**
 * Phase 1: analyse album, score via Immich metadata, generate 3 story concepts with Gemini.
 * Stores concepts in the job record; sets status='suggestions_ready'.
 */
async function generateSuggestions(jobId, storyId, albumIds, language, db, immichClient) {
  const updateJob = db.prepare(`
    UPDATE ai_jobs SET status=?, progress=?, processed=?, total=?, suggestions=?, error=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `);

  try {
    updateJob.run('processing', 5, 0, 0, null, null, jobId);

    const assets = await fetchAlbumAssets(albumIds, immichClient);
    updateJob.run('processing', 15, assets.length, assets.length, null, null, jobId);

    const scored = scoreAssetsFromImmich(assets, db);
    updateJob.run('processing', 40, assets.length, assets.length, null, null, jobId);

    const albumSummary = buildAlbumSummary(assets);

    // Build 3 layout candidates (one per main strategy)
    const allStrategies = ['location', 'day', 'theme'];
    const groupsByStrategy = {};
    for (const strat of allStrategies) {
      switch (strat) {
        case 'location': groupsByStrategy[strat] = groupByLocation(scored); break;
        case 'day':      groupsByStrategy[strat] = groupByDay(scored); break;
        default:         groupsByStrategy[strat] = groupByThemePure(chronoSort(scored)); break;
      }
    }

    // Pick representative assets and fetch thumbnails for Gemini
    const representatives = selectRepresentativeAssets(assets, 10);
    const fetchThumb = makeFetchThumb(immichClient);
    updateJob.run('processing', 50, assets.length, assets.length, null, null, jobId);

    const thumbs = await Promise.all(
      representatives.map((a) => fetchThumb(a.id).catch(() => null))
    ).then((arr) => arr.filter(Boolean));

    updateJob.run('processing', 65, assets.length, assets.length, null, null, jobId);

    // Ask Gemini to generate 3 story concepts (1 call total)
    const geminiConcepts = await generateStoryConcepts(albumSummary, thumbs);
    updateJob.run('processing', 85, assets.length, assets.length, null, null, jobId);

    // Find the best hero candidate for each strategy to send as preview
    const bestAssetForStrategy = (strategy) => {
      const grps = groupsByStrategy[strategy];
      if (!grps?.length) return null;
      const allItems = grps.flatMap((g) => g.items).filter((a) => a.assetType !== 'VIDEO');
      if (!allItems.length) return null;
      return allItems.reduce((b, c) => (c.score.score > b.score.score ? c : b));
    };

    const autoStrategy = chooseStrategy(scored);

    // Merge Gemini creative titles with pre-computed grouping
    const suggestions = allStrategies.map((strategy, i) => {
      const gemini = geminiConcepts[i] || {};
      const best = bestAssetForStrategy(strategy);
      return {
        strategy,
        title_pt: gemini.title_pt || strategyDefaultTitle(strategy, albumSummary, language),
        description_pt: gemini.description_pt || '',
        tone: gemini.tone || '',
        hero_asset_id: best?.asset.id || null,
        album_ids: albumIds,
        language,
        is_recommended: strategy === autoStrategy,
      };
    });

    const suggestionsJson = JSON.stringify(suggestions);
    db.prepare(`UPDATE ai_jobs SET status='suggestions_ready', progress=100, suggestions=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(suggestionsJson, jobId);
  } catch (err) {
    db.prepare(`UPDATE ai_jobs SET status='error', error=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(err.message || 'Unknown error', jobId);
  }
}

function strategyDefaultTitle(strategy, summary, language) {
  const city = summary.cities[0] || '';
  switch (strategy) {
    case 'location': return city ? `Viagem por ${city}` : 'Viagem por localizações';
    case 'day': return summary.dateRange ? `${summary.dateRange.from} a ${summary.dateRange.to}` : 'Dia a dia';
    default: return 'História por temas';
  }
}

/**
 * Phase 2: execute a selected suggestion — build and insert blocks.
 * `suggestionData` comes from the suggestions JSON stored in the suggestions job.
 */
async function runAutoLayout(jobId, storyId, suggestionData, replaceExisting, db, immichClient) {
  const updateJob = db.prepare(`
    UPDATE ai_jobs SET status=?, progress=?, processed=?, total=?, blocks_created=?, error=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `);

  try {
    updateJob.run('processing', 5, 0, 0, 0, null, jobId);

    const { album_ids: albumIds, language = 'pt', strategy } = suggestionData;

    const assets = await fetchAlbumAssets(albumIds, immichClient);
    updateJob.run('processing', 15, assets.length, assets.length, 0, null, jobId);

    const scored = scoreAssetsFromImmich(assets, db);
    updateJob.run('processing', 40, assets.length, assets.length, 0, null, jobId);

    let groups;
    switch (strategy) {
      case 'location':   groups = groupByLocation(scored); break;
      case 'day':        groups = groupByDay(scored); break;
      case 'by_person':  groups = groupByLocation(scored); break; // fallback: location
      default:           groups = groupByThemePure(chronoSort(scored)); break;
    }

    updateJob.run('processing', 50, assets.length, assets.length, 0, null, jobId);

    const fetchThumb = makeFetchThumb(immichClient);

    // Generate captions only for hero + best per group (~5-15 calls)
    await addCaptionsToFeatured(groups, fetchThumb);
    updateJob.run('processing', 75, assets.length, assets.length, 0, null, jobId);

    const blocksList = await generateBlocksFromGroups(groups, language, fetchThumb);
    updateJob.run('processing', 95, assets.length, assets.length, 0, null, jobId);

    db.transaction(() => {
      if (replaceExisting) {
        db.prepare('DELETE FROM blocks WHERE story_id=?').run(storyId);
      }

      let maxPos = 0;
      if (!replaceExisting) {
        const row = db.prepare('SELECT MAX(position) as m FROM blocks WHERE story_id=?').get(storyId);
        maxPos = (row?.m ?? -1) + 1;
      }

      const insertBlock = db.prepare(
        'INSERT INTO blocks (id, story_id, type, position, content) VALUES (?, ?, ?, ?, ?)'
      );
      for (const block of blocksList) {
        insertBlock.run(block.id, storyId, block.type, block.position + maxPos, block.content);
      }
    })();

    updateJob.run('done', 100, assets.length, assets.length, blocksList.length, null, jobId);
  } catch (err) {
    updateJob.run('error', 0, 0, 0, 0, err.message || 'Unknown error', jobId);
  }
}

module.exports = { runAutoLayout, generateSuggestions };
