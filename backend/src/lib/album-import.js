'use strict';

// Pure functions — no I/O. All transformation passes for smart album import.

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveOrientation(exif) {
  if (!exif) return 'landscape';
  const tag = String(exif.orientation ?? '');
  if (tag === '6' || tag === '8') return 'portrait';
  if (tag === '1' || tag === '3') return 'landscape';
  const { exifImageWidth: w, exifImageHeight: h } = exif;
  if (w && h) return h > w ? 'portrait' : 'landscape';
  return 'landscape';
}

function haversine([lat1, lng1], [lat2, lng2]) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function centroid(cluster) {
  const pts = cluster
    .map((a) => [a.exifInfo?.latitude, a.exifInfo?.longitude])
    .filter(([lat, lng]) => typeof lat === 'number' && typeof lng === 'number');
  if (pts.length === 0) return null;
  const lat = pts.reduce((s, [la]) => s + la, 0) / pts.length;
  const lng = pts.reduce((s, [, lo]) => s + lo, 0) / pts.length;
  return [lat, lng];
}

function dominantPlace(cluster) {
  const freq = {};
  for (const a of cluster) {
    const key = a.exifInfo?.city || a.exifInfo?.country || null;
    if (key) freq[key] = (freq[key] || 0) + 1;
  }
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : null;
}

function parseDuration(dur) {
  if (!dur) return 0;
  const parts = String(dur).split(':').map(parseFloat);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

// ---------------------------------------------------------------------------
// Pass 1.5 — Featured flagging
// ---------------------------------------------------------------------------

function flagFeatured(assets, minRating = 4) {
  return assets.map((a) => ({
    ...a,
    _featured:
      a.isFavorite === true ||
      (a.exifInfo?.rating != null && a.exifInfo.rating >= minRating),
  }));
}

function sortFeaturedFirst(arr) {
  return [...arr.filter((a) => a._featured), ...arr.filter((a) => !a._featured)];
}

// ---------------------------------------------------------------------------
// Pass 3 — Clustering
// ---------------------------------------------------------------------------

function clusterByTime(assets, thresholdSeconds) {
  if (assets.length === 0) return [];
  const clusters = [[assets[0]]];
  for (let i = 1; i < assets.length; i++) {
    const gap =
      (new Date(assets[i].fileCreatedAt) - new Date(assets[i - 1].fileCreatedAt)) / 1000;
    if (gap <= thresholdSeconds) {
      clusters[clusters.length - 1].push(assets[i]);
    } else {
      clusters.push([assets[i]]);
    }
  }
  return clusters;
}

function mergeByGps(clusters, maxMeters) {
  const out = [];
  for (const c of clusters) {
    const last = out[out.length - 1];
    if (!last) { out.push(c); continue; }
    const lastDate = new Date(last[0].fileCreatedAt);
    const currDate = new Date(c[0].fileCreatedAt);
    // Don't merge across month boundaries
    if (
      lastDate.getFullYear() !== currDate.getFullYear() ||
      lastDate.getMonth() !== currDate.getMonth()
    ) {
      out.push(c);
      continue;
    }
    const a = centroid(last);
    const b = centroid(c);
    if (a && b && haversine(a, b) <= maxMeters) {
      out[out.length - 1] = [...last, ...c];
    } else {
      out.push(c);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pass 4 — Sectionize
// ---------------------------------------------------------------------------

function sectionize(clusters) {
  if (clusters.length === 0) return [];
  const sections = [];
  let cur = null;
  let prevYear = null, prevMonth = null, prevPlace = null;

  for (const cluster of clusters) {
    const d = new Date(cluster[0].fileCreatedAt);
    const year = d.getFullYear();
    const month = d.getMonth();
    const place = dominantPlace(cluster);

    if (!cur) {
      cur = { dividerLabel: null, dividerStyle: null, clusters: [cluster] };
      sections.push(cur);
    } else {
      const monthChanged = year !== prevYear || month !== prevMonth;
      const placeChanged = place && prevPlace && place !== prevPlace;

      if (monthChanged || placeChanged) {
        let label, style;
        if (monthChanged) {
          style = 'line';
          label = place
            ? `${year} · ${MONTH_NAMES[month]} · ${place}`
            : `${year} · ${MONTH_NAMES[month]}`;
        } else {
          style = 'space';
          label = place;
        }
        cur = { dividerLabel: label, dividerStyle: style, clusters: [cluster] };
        sections.push(cur);
      } else {
        cur.clusters.push(cluster);
      }
    }

    prevYear = year;
    prevMonth = month;
    if (place) prevPlace = place;
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Pass 5 — Rendering
// ---------------------------------------------------------------------------

function pickSectionHero(gridEligible) {
  // Priority: featured image > featured any > landscape image > first
  const featImg = gridEligible.find((a) => a._featured && a.type === 'IMAGE');
  if (featImg) return featImg;
  const featAny = gridEligible.find((a) => a._featured);
  if (featAny) return featAny;
  const landscape = gridEligible.find(
    (a) => a.type === 'IMAGE' && deriveOrientation(a.exifInfo) === 'landscape'
  );
  return landscape || gridEligible[0];
}

// Maps an array of (sorted) assets to block descriptors or solo markers.
// { _k: 'block', type, content } | { _k: 'solo', asset }
function sizeToBlocks(assets) {
  const n = assets.length;
  if (n === 0) return [];

  // Featured solo → immediate hero (not deferred to solo collapse)
  if (n === 1 && assets[0]._featured) {
    return [{
      _k: 'block', type: 'hero',
      content: { asset_id: assets[0].id, caption: '', overlay: false, height: 'medium' },
    }];
  }

  if (n === 1) return [{ _k: 'solo', asset: assets[0] }];

  let columns, aspect;
  if (n === 2)      { columns = 2; aspect = 'portrait'; }
  else if (n === 3) { columns = 2; aspect = 'landscape'; }
  else if (n === 4) { columns = 2; aspect = 'square'; }
  else if (n <= 6)  { columns = 3; aspect = 'square'; }
  else              { columns = 4; aspect = 'square'; }

  return [{
    _k: 'block', type: 'grid',
    content: { asset_ids: assets.map((a) => a.id), columns, gap: 'sm', aspect },
  }];
}

// Renders one cluster into block descriptors, handling 5a (video isolation),
// 5b (size → layout), and 5d (section hero promotion).
function renderCluster(cluster, isFirstInSection, videoSeconds) {
  const out = [];
  const isLongVideo = (a) =>
    a.type === 'VIDEO' && parseDuration(a.duration) > videoSeconds;

  // Grid-eligible assets (images + short videos)
  const gridEligible = cluster.filter((a) => !isLongVideo(a));

  // 5d: Section hero extraction (≥ 2 grid-eligible assets in first cluster)
  let heroAsset = null;
  if (isFirstInSection && gridEligible.length >= 2) {
    heroAsset = pickSectionHero(gridEligible);
    out.push({
      _k: 'block', type: 'hero',
      content: { asset_id: heroAsset.id, caption: '', overlay: false, height: 'medium' },
    });
  }

  // Walk cluster in order, splitting on long videos, skipping extracted hero
  let chunk = [];
  const flushChunk = () => {
    if (chunk.length === 0) return;
    out.push(...sizeToBlocks(sortFeaturedFirst(chunk)));
    chunk = [];
  };

  for (const asset of cluster) {
    if (asset === heroAsset) continue;
    if (isLongVideo(asset)) {
      flushChunk();
      out.push({
        _k: 'block', type: 'video',
        content: { asset_id: asset.id, caption: '', autoplay: false, loop: false },
      });
    } else {
      chunk.push(asset);
    }
  }
  flushChunk();

  return out;
}

// ---------------------------------------------------------------------------
// Pass 5c — Solo collapse (within a section boundary)
// ---------------------------------------------------------------------------

function soloToBlock(asset) {
  if (asset._featured) {
    return {
      _k: 'block', type: 'hero',
      content: { asset_id: asset.id, caption: '', overlay: false, height: 'medium' },
    };
  }
  const aspect = deriveOrientation(asset.exifInfo);
  return {
    _k: 'block', type: 'grid',
    content: { asset_ids: [asset.id], columns: 1, gap: 'sm', aspect },
  };
}

function pairToBlocks(assets) {
  const orients = assets.map((a) => deriveOrientation(a.exifInfo));
  if (orients.every((o) => o === 'portrait')) {
    return [{
      _k: 'block', type: 'grid',
      content: { asset_ids: assets.map((a) => a.id), columns: 2, gap: 'sm', aspect: 'portrait' },
    }];
  }
  if (orients.every((o) => o === 'landscape')) {
    return [{
      _k: 'block', type: 'grid',
      content: { asset_ids: assets.map((a) => a.id), columns: 2, gap: 'sm', aspect: 'landscape' },
    }];
  }
  // Mixed orientations: two singles
  return assets.map(soloToBlock);
}

function collapseSolos(items) {
  const out = [];
  let run = [];

  const flush = () => {
    if (run.length === 0) return;
    if (run.length === 1) {
      out.push(soloToBlock(run[0]));
    } else if (run.length === 2) {
      out.push(...pairToBlocks(run));
    } else if (run.length === 3) {
      out.push({
        _k: 'block', type: 'grid',
        content: { asset_ids: run.map((a) => a.id), columns: 2, gap: 'sm', aspect: 'landscape' },
      });
    } else {
      run.forEach((a) => out.push(soloToBlock(a)));
    }
    run = [];
  };

  for (const item of items) {
    if (item._k === 'solo') {
      run.push(item.asset);
    } else {
      flush();
      out.push(item);
    }
  }
  flush();
  return out;
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

function buildBlocksFromAssets(assets, cfg = {}) {
  const {
    burstSeconds = 45,
    gpsMeters = 200,
    videoSeconds = 10,
    featuredMinRating = 4,
  } = cfg;

  // Pass 1.5: Flag featured
  const flagged = flagFeatured(assets, featuredMinRating);

  // Pass 2: Story hero — prefer first featured asset chronologically
  const featIdx = flagged.findIndex((a) => a._featured);
  let heroAsset, rest;
  if (featIdx >= 0) {
    heroAsset = flagged[featIdx];
    rest = flagged.filter((_, i) => i !== featIdx);
  } else {
    [heroAsset, ...rest] = flagged;
  }

  const blocks = [
    { type: 'hero', content: { asset_id: heroAsset.id, caption: '', overlay: true, height: 'full' } },
  ];

  if (rest.length === 0) return blocks;

  // Pass 3: Cluster
  const timeClusters = clusterByTime(rest, burstSeconds);
  const gpsClusters = mergeByGps(timeClusters, gpsMeters);

  // Pass 4: Sectionize
  const sections = sectionize(gpsClusters);

  // Pass 5: Render
  for (const section of sections) {
    if (section.dividerLabel) {
      blocks.push({
        type: 'divider',
        content: { style: section.dividerStyle, label: section.dividerLabel },
      });
    }

    const sectionRaw = [];
    let firstCluster = true;

    for (const cluster of section.clusters) {
      sectionRaw.push(...renderCluster(cluster, firstCluster, videoSeconds));
      firstCluster = false;
    }

    // Pass 5c: Collapse solos within section (never crosses dividers)
    for (const item of collapseSolos(sectionRaw)) {
      blocks.push({ type: item.type, content: item.content });
    }
  }

  return blocks;
}

module.exports = {
  buildBlocksFromAssets,
  // Exported for unit testing
  flagFeatured,
  sortFeaturedFirst,
  clusterByTime,
  mergeByGps,
  sectionize,
  collapseSolos,
  deriveOrientation,
  haversine,
};
