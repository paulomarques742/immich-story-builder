const { v4: uuidv4 } = require('uuid');
const { analyseAlbumBatch, generateNarrative } = require('./gemini');

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

function groupByLocationAndTheme(scoredAssets) {
  const sorted = [...scoredAssets].sort((a, b) => {
    const da = new Date(a.asset.fileCreatedAt || 0);
    const db2 = new Date(b.asset.fileCreatedAt || 0);
    return da - db2;
  });

  const hasGps = sorted.some((s) => s.score.lat || s.score.city);

  if (!hasGps) return groupByThemePure(sorted);

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
      g.city = locationAsset.score.city || null;
      g.country = locationAsset.score.country || null;
      groups.push(g);
    }
  }

  return groups;
}

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

  return merged.map((items) => ({
    theme: items[0].score.theme,
    items,
    city: null,
    country: null,
  }));
}

function topAssets(group, n = 3) {
  return [...group.items]
    .filter((a) => a.assetType !== 'VIDEO')
    .sort((a, b) => b.score.score - a.score.score)
    .slice(0, n);
}

function buildMapBlock(items, position) {
  const gpsItems = items
    .filter((a) => a.assetType !== 'VIDEO' && a.score.lat && a.score.lng)
    .sort((a, b) => b.score.score - a.score.score)
    .slice(0, 20);

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
      zoom: 10,
    }),
  };
}

async function generateBlocksFromGroups(groups, language, fetchThumbFn) {
  const blocks = [];
  let position = 0;

  // Opening hero — highest scoring image across all groups
  const allImageItems = groups.flatMap((g) => g.items).filter((a) => a.assetType !== 'VIDEO');
  const bestOverall = allImageItems.reduce((best, cur) => (cur.score.score > best.score.score ? cur : best));

  blocks.push({
    id: uuidv4(),
    type: 'hero',
    position: position++,
    content: JSON.stringify({
      asset_id: bestOverall.asset.id,
      caption: bestOverall.score.caption_pt || '',
      overlay: true,
      height: 'full',
      title: bestOverall.score.title_pt || '',
    }),
  });

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const isFirst = gi === 0;

    const imageItems = group.items.filter((a) => a.assetType !== 'VIDEO');
    const videoItems = group.items.filter((a) => a.assetType === 'VIDEO');

    // Divider between groups
    if (!isFirst) {
      const dividerLabel = [
        group.theme.charAt(0).toUpperCase() + group.theme.slice(1),
        group.city,
      ].filter(Boolean).join(' · ');

      blocks.push({
        id: uuidv4(),
        type: 'divider',
        position: position++,
        content: JSON.stringify({ style: 'line', label: dividerLabel }),
      });
    }

    // Narrative text block
    const best3 = topAssets(group, 3);
    const thumbsBase64 = await Promise.all(
      best3.map((a) => fetchThumbFn(a.asset.id).catch(() => null))
    ).then((arr) => arr.filter(Boolean));

    const narrative = thumbsBase64.length
      ? await generateNarrative(thumbsBase64, group.theme, language, { city: group.city, country: group.country })
      : '';

    if (narrative) {
      blocks.push({
        id: uuidv4(),
        type: 'text',
        position: position++,
        content: JSON.stringify({ markdown: narrative, align: 'left', max_width: 'prose' }),
      });
    }

    // Map block (if any asset in the group has GPS)
    const mapBlock = buildMapBlock(group.items, position);
    if (mapBlock) {
      mapBlock.position = position++;
      blocks.push(mapBlock);
    }

    // Hero for best image in group
    const bestInGroup = topAssets(group, 1)[0];
    if (bestInGroup && bestInGroup.asset.id !== bestOverall.asset.id) {
      blocks.push({
        id: uuidv4(),
        type: 'hero',
        position: position++,
        content: JSON.stringify({
          asset_id: bestInGroup.asset.id,
          caption: bestInGroup.score.caption_pt || '',
          overlay: true,
          height: 'full',
          title: bestInGroup.score.title_pt || '',
        }),
      });
    }

    // Image grids tiered by score
    const remaining = imageItems
      .filter((a) => a.asset.id !== (bestInGroup?.asset.id) && a.asset.id !== bestOverall.asset.id)
      .sort((a, b) => b.score.score - a.score.score);

    const tier1 = remaining.filter((a) => a.score.score >= 7);
    const tier2 = remaining.filter((a) => a.score.score >= 4 && a.score.score < 7);
    const tier3 = remaining.filter((a) => a.score.score < 4);

    if (tier1.length) {
      blocks.push({
        id: uuidv4(),
        type: 'grid',
        position: position++,
        content: JSON.stringify({ asset_ids: tier1.map((a) => a.asset.id), columns: 1, gap: 'sm', aspect: 'auto' }),
      });
    }
    if (tier2.length) {
      blocks.push({
        id: uuidv4(),
        type: 'grid',
        position: position++,
        content: JSON.stringify({ asset_ids: tier2.map((a) => a.asset.id), columns: 3, gap: 'sm', aspect: 'square' }),
      });
    }
    if (tier3.length) {
      blocks.push({
        id: uuidv4(),
        type: 'grid',
        position: position++,
        content: JSON.stringify({ asset_ids: tier3.map((a) => a.asset.id), columns: 4, gap: 'sm', aspect: 'square' }),
      });
    }

    // Video blocks (one per video)
    for (const v of videoItems) {
      blocks.push({
        id: uuidv4(),
        type: 'video',
        position: position++,
        content: JSON.stringify({
          asset_id: v.asset.id,
          caption: v.score.caption_pt || '',
          autoplay: false,
          loop: false,
        }),
      });
    }
  }

  // Closing text block
  const closingThumb = await fetchThumbFn(bestOverall.asset.id).catch(() => null);
  if (closingThumb) {
    const closing = await generateNarrative(
      [closingThumb],
      'closing',
      language,
      { city: groups[groups.length - 1]?.city, country: groups[groups.length - 1]?.country },
    );
    if (closing) {
      blocks.push({
        id: uuidv4(),
        type: 'text',
        position: position++,
        content: JSON.stringify({ markdown: closing, align: 'center', max_width: 'prose' }),
      });
    }
  }

  return blocks;
}

async function runAutoLayout(storyId, albumIds, language, replaceExisting, db, immichClient) {
  const updateJob = db.prepare(`
    UPDATE ai_jobs SET status=?, progress=?, processed=?, total=?, blocks_created=?, error=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `);

  const job = db.prepare(`SELECT id FROM ai_jobs WHERE story_id=? ORDER BY created_at DESC LIMIT 1`).get(storyId);
  if (!job) return;
  const jobId = job.id;

  try {
    let assets = [];
    for (const albumId of albumIds) {
      const res = await immichClient.get(`/albums/${albumId}`);
      assets.push(...(res.data.assets || []));
    }
    const seen = new Set();
    assets = assets.filter((a) => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });

    updateJob.run('processing', 0, 0, assets.length, 0, null, jobId);

    const fetchThumbFn = async (assetId) => {
      const res = await immichClient.get(`/assets/${assetId}/thumbnail`, {
        params: { size: 'preview' },
        responseType: 'arraybuffer',
      });
      return Buffer.from(res.data).toString('base64');
    };

    const fetchExifFn = async (assetId) => {
      const res = await immichClient.get(`/assets/${assetId}`);
      const exif = res.data.exifInfo || {};
      return {
        lat: exif.latitude ?? null,
        lng: exif.longitude ?? null,
        city: exif.city ?? null,
        country: exif.country ?? null,
      };
    };

    const scored = await analyseAlbumBatch(assets, fetchThumbFn, fetchExifFn, (processed, total) => {
      const progress = Math.round((processed / total) * 80);
      updateJob.run('processing', progress, processed, total, 0, null, jobId);
    }, db);

    updateJob.run('processing', 82, assets.length, assets.length, 0, null, jobId);

    const groups = groupByLocationAndTheme(scored);

    updateJob.run('processing', 85, assets.length, assets.length, 0, null, jobId);

    const blocksList = await generateBlocksFromGroups(groups, language, fetchThumbFn);

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

module.exports = { runAutoLayout };
