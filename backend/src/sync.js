const cron = require('node-cron');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

module.exports = function startSyncJob(db) {
  const minutes = parseInt(process.env.SYNC_INTERVAL_MINUTES || '15', 10);
  // clamp to valid cron range (1–59)
  const interval = Math.min(59, Math.max(1, minutes));
  const expr = `*/${interval} * * * *`;

  cron.schedule(expr, async () => {
    const stories = db.prepare(`
      SELECT s.*
      FROM stories s
      WHERE s.sync_mode != 'manual'
        AND json_array_length(s.immich_album_ids) > 0
    `).all();

    for (const story of stories) {
      try {
        const albumIds = JSON.parse(story.immich_album_ids || '[]');
        if (!albumIds.length) continue;

        const base = process.env.IMMICH_URL?.replace(/\/$/, '');
        const headers = { 'x-api-key': process.env.IMMICH_API_KEY };
        const newEntries = [];

        for (const albumId of albumIds) {
          const { data: album } = await axios.get(`${base}/api/albums/${albumId}`, { headers });
          for (const asset of (album.assets || [])) {
            const known = db.prepare(
              'SELECT 1 FROM story_assets WHERE story_id = ? AND asset_id = ?'
            ).get(story.id, asset.id);
            if (!known) newEntries.push({ assetId: asset.id, albumId });
          }
        }

        if (!newEntries.length) continue;

        console.log(`[sync] "${story.title}": ${newEntries.length} new asset(s)`);

        // Record in story_assets
        const insertAsset = db.prepare(
          'INSERT OR IGNORE INTO story_assets (story_id, asset_id, album_id) VALUES (?, ?, ?)'
        );
        db.transaction(() => {
          for (const { assetId, albumId } of newEntries) {
            insertAsset.run(story.id, assetId, albumId);
          }
        })();

        if (story.sync_mode === 'auto') {
          const maxRow = db.prepare('SELECT MAX(position) as m FROM blocks WHERE story_id = ?').get(story.id);
          const position = (maxRow.m ?? -1) + 1;
          db.prepare('INSERT INTO blocks (id, story_id, type, position, content) VALUES (?, ?, ?, ?, ?)').run(
            uuidv4(), story.id, 'grid', position,
            JSON.stringify({ asset_ids: newEntries.map((e) => e.assetId), columns: 3, gap: 'sm', aspect: 'square' })
          );
        } else {
          db.prepare('INSERT INTO sync_notifications (id, story_id, new_asset_ids) VALUES (?, ?, ?)').run(
            uuidv4(), story.id, JSON.stringify(newEntries.map((e) => e.assetId))
          );
        }
      } catch (err) {
        console.error(`[sync] Error story ${story.id}:`, err.message);
      }
    }
  });

  console.log(`[sync] Scheduled every ${interval}min`);
};
