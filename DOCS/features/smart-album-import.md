# Smart Album Import — Burst & Metadata Aware

> Importing Immich albums with dynamic block layouts driven by temporal proximity,
> GPS data, and EXIF metadata — without LLMs, embeddings, or perceptual hashing.

---

## Context and motivation

Today, `POST /api/stories/:storyId/blocks/import-album`
(`backend/src/routes/blocks.js`) generates a flat sequence:

1. A `hero` block from the first asset.
2. For each calendar month, a `divider` followed by uniform 3-column grids of
   the remaining assets.

The result is visually monotonous: 30 photos from a weekend turn into 10
identical grids. The story loses rhythm and the layout doesn't reflect *how*
the photos were actually taken (rapid bursts, scattered solos, change of
location).

**Goal:** detect natural groupings (bursts, places, scenes) using only
metadata that Immich already exposes via REST, and map each grouping to a
block layout that fits its size and nature. No machine learning, no embedding
queries, no direct database access.

---

## Algorithm overview

The import runs in **five passes** over the asset list returned by Immich:

```
 ┌──────────────────────────────────────────────────────────────┐
 │ 1. Enrich     │ Fetch missing exifInfo for all assets         │
 │ 2. Hero       │ Pull asset[0] out as the story-wide hero      │
 │ 3. Cluster    │ Group by time proximity; merge by GPS         │
 │ 4. Section    │ Group clusters into sections (month + place)  │
 │ 5. Render     │ Map each cluster + leftover solos to blocks   │
 └──────────────────────────────────────────────────────────────┘
```

Each pass is a pure function over the asset list (no I/O after enrichment),
which makes the whole pipeline easy to unit-test.

---

## Pass 1 — Enrichment

`GET /api/albums/:id` does **not** return `exifInfo` on the assets it lists.
We need GPS coordinates, city, country, and orientation. Two strategies:

- **Preferred:** call `POST /api/search/metadata` with `{ albumIds: [...],
  withExif: true, size: 1000 }` and paginate. One round-trip per page (~1000
  assets per page).
- **Fallback if that doesn't work as expected:** loop `GET /api/assets/:id`
  per asset with bounded concurrency (Promise pool of 8). The existing
  `/api/immich/assets/:id/exif` route is the per-asset shape we need.

After this pass, every asset in memory has at minimum:

```ts
{
  id: string,
  type: 'IMAGE' | 'VIDEO',
  fileCreatedAt: string,        // ISO timestamp
  duration?: string,             // 'HH:MM:SS.mmm' for videos
  isFavorite: boolean,           // Immich favourite flag
  exifInfo: {
    latitude?: number | null,
    longitude?: number | null,
    city?: string | null,
    country?: string | null,
    orientation?: string | null, // EXIF tag, see below
    exifImageWidth?: number,
    exifImageHeight?: number,
    rating?: number | null,      // XMP Rating tag, 0–5
  }
}
```

**Orientation derivation.** Immich's `exifInfo.orientation` is the raw EXIF
tag (1–8). When absent or unreliable, fall back to comparing
`exifImageWidth` vs `exifImageHeight`:

```js
function deriveOrientation(exif) {
  if (!exif) return 'landscape';
  const tag = exif.orientation;
  if (tag === '6' || tag === '8') return 'portrait';
  if (tag === '1' || tag === '3') return 'landscape';
  // fall back to dimensions
  const w = exif.exifImageWidth, h = exif.exifImageHeight;
  if (w && h) return h > w ? 'portrait' : 'landscape';
  return 'landscape';
}
```

If enrichment fails (network error, missing EXIF), the algorithm degrades
gracefully: the asset is treated as having no GPS and landscape orientation,
and ends up in the time-only path. **Enrichment failure must never block the
import.**

---

## Pass 1.5 — Featured flagging

After enrichment, before any layout decisions, each asset receives an internal
`_featured` flag:

```js
function flagFeatured(assets, minRating = 4) {
  return assets.map((a) => ({
    ...a,
    _featured:
      a.isFavorite === true ||
      (a.exifInfo?.rating != null && a.exifInfo.rating >= minRating),
  }));
}
```

`minRating` is read from `IMPORT_FEATURED_MIN_RATING` (default 4), so 4- and
5-star photos are both featured by default. `isFavorite` (Immich's heart icon)
always qualifies regardless of rating.

Featured assets drive three layout decisions: story hero selection (Pass 2),
prominent slot assignment within grids (Pass 5b), and section hero preference
(Pass 5d).

---

## Pass 2 — Story hero extraction

**Preferred**: if the album contains any `_featured` asset, the first one in
chronological order becomes the story-wide `hero` (`height: 'full'`). This
ensures the cover photo is the photographer's best shot, not just the first
one captured.

**Fallback**: if no `_featured` asset exists, the first chronological asset is
used — exactly as before.

The selected hero is removed from the list before clustering regardless of how
it was chosen. If the hero is a video, it stays as a `hero` block regardless
of duration.

---

## Pass 3 — Clustering (time → GPS merge)

### Step A: time-based clustering

Walk the chronologically-sorted assets and open a new cluster whenever the
gap to the previous asset exceeds `IMPORT_BURST_THRESHOLD_SECONDS`.

### Step B: GPS-based merge

After time clustering, do a second pass that **merges adjacent clusters** when
their geographic centroids are within `IMPORT_GPS_PROXIMITY_METERS`. This
captures cases like: lunch photos at 13:00, dessert at 13:50, coffee at
14:20 — same restaurant, three temporal clusters that should read as one
"meal at this place" group.

Pseudocode:

```js
function mergeByGps(clusters, maxMeters) {
  const out = [];
  for (const c of clusters) {
    const last = out[out.length - 1];
    if (!last) { out.push(c); continue; }
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

function centroid(cluster) {
  const pts = cluster
    .map((a) => [a.exifInfo?.latitude, a.exifInfo?.longitude])
    .filter(([lat, lng]) => typeof lat === 'number' && typeof lng === 'number');
  if (pts.length === 0) return null;
  const lat = pts.reduce((s, [la]) => s + la, 0) / pts.length;
  const lng = pts.reduce((s, [, lo]) => s + lo, 0) / pts.length;
  return [lat, lng];
}
```

A standard Haversine implementation in metres goes inside the same module.
Clusters without any GPS are never merged — they pass through as-is.

**Important:** GPS merge does *not* cross month boundaries. The section
grouping in Pass 4 will split them anyway, but checking up front avoids
surprises.

---

## Pass 4 — Sectioning (month + place)

A "section" is a contiguous run of clusters that share a label. Sections
become `divider` blocks. Two signals drive section boundaries:

1. **Calendar month** of the cluster's first asset (existing behaviour).
2. **Dominant place** of the cluster (city, falling back to country).

The dominant place of a cluster is the most common non-empty `exifInfo.city`
(or `country` if no city) across its assets. Ties: pick the city of the
first asset.

A divider is emitted whenever **either** the month or the place changes
between consecutive clusters. Label format:

| Month | Place | Label |
|---|---|---|
| changes | unknown | `2024 · Agosto` (current behaviour) |
| changes | known | `2024 · Agosto · Lisboa` |
| same | changes | `Porto` |
| same | unknown change | (no divider) |

Place changes within the same month produce a lighter divider (`style:
'space'` instead of `'line'`) so the reader feels a softer break than a
month change.

---

## Pass 5 — Cluster rendering

### 5a. Video isolation

Before mapping a cluster to a layout, split it on long videos:

- A video with `duration > IMPORT_VIDEO_LONG_SECONDS` (default 10) becomes
  its own `video` block, splitting the cluster around it.
- Shorter videos stay inline with photos and render as grid items
  (the existing thumbnail behaviour from Immich works for videos too).

```
[photo, photo, video(4s), photo]      → one grid of 4
[photo, photo, video(45s), photo]     → grid of 2 + video block + grid of 1
                                        (the trailing solo joins the run-of-solos pass)
```

### 5b. Cluster size → block layout

Before mapping a cluster to a layout, **sort `_featured` assets to the front**,
preserving relative order within featured and non-featured groups:

```js
function sortFeaturedFirst(cluster) {
  return [
    ...cluster.filter((a) => a._featured),
    ...cluster.filter((a) => !a._featured),
  ];
}
```

This puts featured photos in the dominant slot of every layout (first position
= large photo in asymmetric, top-left in dense grids).

| Cluster size | `_featured` present? | Block | Configuration |
|---|---|---|---|
| 1 photo  | no  | (deferred to 5c) | — |
| 1 photo  | yes | `hero`           | `height='medium'` — never deferred to solo collapse |
| 2 photos | —   | `grid` (duo)           | `columns=2`, `aspect=portrait`,  `gap=sm` |
| 3 photos | —   | `grid` (asymmetric)    | `columns=2`, `aspect=landscape`, `gap=sm` |
| 4 photos | —   | `grid` (2×2)           | `columns=2`, `aspect=square`,    `gap=sm` |
| 5–6 photos | — | `grid` (3 cols)      | `columns=3`, `aspect=square`,    `gap=sm` |
| 7+ photos | —  | `grid` (4 cols, dense) | `columns=4`, `aspect=square`,    `gap=sm` |

A featured solo becoming a `hero` block means a photographer's lone best shot
(a golden-hour sunset taken hours away from any burst) gets maximum visual
weight rather than being compressed into a small grid cell.

> The frontend already maps `columns=2 + aspect=landscape` to the asymmetric
> layout (one large photo + two stacked). See `GRID_LAYOUTS` in
> `frontend/src/components/editor/BlockEditor.jsx` and the renderer in
> `frontend/src/components/viewer/ViewerBlock.jsx`. The backend just emits
> the right values — no new block type is needed.

### 5c. Solo handling (orientation-aware run merging)

After 5b runs over all clusters, we have a sequence of blocks where some
are *solo holders* — placeholders for clusters of size 1. Solo holders are
collapsed in a final pass:

1. Walk the block sequence. Whenever 2 or 3 **consecutive** solo holders sit
   between two non-solo blocks (or at the edges of a section), merge them
   into a single grid:

   - **2 solos, both portrait** → `grid` (duo): `columns=2,
     aspect=portrait`.
   - **2 solos, both landscape** → `grid` (asymmetric is overkill for 2;
     use `columns=1, aspect=landscape, gap=sm` and emit *two* stacked
     full-width photos). Alternative: `columns=2, aspect=landscape` for a
     side-by-side. Pick one — recommend the side-by-side for visual variety.
   - **2 solos, mixed orientation** → keep as two separate `single` blocks
     (`columns=1, aspect=landscape` for the landscape one, `columns=1,
     aspect=portrait` for the portrait). A mixed duo looks awkward.
   - **3 solos, any orientation mix** → `grid` (asymmetric): `columns=2,
     aspect=landscape`. The asymmetric layout tolerates orientation mixing
     well because the big-photo slot dominates.

2. Solos that don't pair with neighbours (4+ in a row, or only 1 between
   non-solos) fall back to `single` blocks: `columns=1, aspect=landscape`
   (or `portrait` if the photo is portrait).

3. Merging never crosses a `divider`. Solos at the boundary stay solo.

Pseudocode for the solo collapse:

```js
function collapseSolos(blocks) {
  const out = [];
  let run = [];
  const flushRun = () => {
    if (run.length === 0) return;
    if (run.length === 1) {
      out.push(soloBlock(run[0]));
    } else if (run.length === 2) {
      out.push(pairBlock(run));      // duo or two singles, per orientation
    } else if (run.length === 3) {
      out.push(asymmetricBlock(run));
    } else {
      // 4+ solos in a row are surprising; render as singles for safety
      run.forEach((a) => out.push(soloBlock(a)));
    }
    run = [];
  };
  for (const b of blocks) {
    if (b._kind === 'solo') run.push(b._asset);
    else { flushRun(); out.push(b); }
  }
  flushRun();
  return out;
}
```

### 5d. Hero promotion at section openings

When a cluster is the **first** within a new section *and* has ≥ 2 photos,
its first asset is extracted as a `hero` (`height: 'medium'`) before the
remaining grid. This gives each new section a strong visual opening without
competing with the story-wide hero. Single-asset clusters at section
openings are not promoted — the section's `divider` already does the work.

Promotion priority (in order):

1. First `_featured` asset in the cluster (favourite or high-rated photo).
2. First landscape-oriented asset (existing behaviour, fallback).
3. First portrait asset if no landscape exists.

Preferring a featured photo as the section opener ensures the strongest image
of a scene anchors the visual narrative, even if it wasn't the first shot
taken at that location.

---

## Configuration

All thresholds are read from `.env` with sensible defaults. Add to
`.env.example`:

```env
# Smart album import — see DOCS/smart-album-import.md
IMPORT_BURST_THRESHOLD_SECONDS=45
IMPORT_GPS_PROXIMITY_METERS=200
IMPORT_VIDEO_LONG_SECONDS=10
IMPORT_FEATURED_MIN_RATING=4    # assets with XMP rating >= N are treated as featured
```

Read them once at the top of the import handler with safe parsing:

```js
const cfg = {
  burstSeconds:      parseInt(process.env.IMPORT_BURST_THRESHOLD_SECONDS, 10) || 45,
  gpsMeters:         parseInt(process.env.IMPORT_GPS_PROXIMITY_METERS, 10) || 200,
  videoSeconds:      parseInt(process.env.IMPORT_VIDEO_LONG_SECONDS, 10) || 10,
  featuredMinRating: parseInt(process.env.IMPORT_FEATURED_MIN_RATING, 10) || 4,
};
```

---

## Code changes

### Backend

**File:** `backend/src/routes/blocks.js`

Refactor the `import-album` handler so the algorithm lives in pure functions,
testable without HTTP/DB. Suggested module split (new file
`backend/src/lib/album-import.js`):

```js
// Pure functions, no I/O.
function clusterByTime(assets, thresholdSeconds) { ... }
function mergeByGps(clusters, maxMeters) { ... }
function sectionize(clusters) { ... }    // returns [{label, style, clusters}]
function isolateLongVideos(cluster, videoSeconds) { ... }
function clusterToBlocks(cluster) { ... }   // returns block(s) for sizes 2..N
function collapseSolos(blockStream) { ... }
function buildBlocksFromAssets(assets, cfg) { ... } // wires it all together

module.exports = { buildBlocksFromAssets };
```

The route handler becomes thin: fetch + enrich + `flagFeatured()` + call
`buildBlocksFromAssets()` + insert in transaction (current code).

**File:** `backend/src/routes/immich.js` (optional helper)

Consider exposing a `POST /api/immich/albums/:id/assets-with-exif` that
internally calls the metadata search and returns assets with `exifInfo`
populated. Keeps the import handler clean and gives the frontend access to
enriched lists if needed elsewhere later.

**Helpers needed:**

- `haversine(latLng1, latLng2): number` — metres between two points.
- `centroid(cluster): [lat, lng] | null` — averaged coordinates, ignoring
  GPS-less assets.
- `dominantPlace(cluster): { city, country } | null` — most common non-empty
  city/country.
- `flagFeatured(assets, minRating): asset[]` — adds `_featured` boolean.
- `sortFeaturedFirst(cluster): asset[]` — featured assets to front.

### Frontend

Two small changes:

**File:** `frontend/src/components/editor/AlbumImporter.jsx`

Update the description copy:

> **Before:** "Selecciona um ou mais álbuns. Serão criados automaticamente
> blocos hero, grids de 3 e divisores por mês."
>
> **After:** "Selecciona um ou mais álbuns. A story é montada
> automaticamente: heros, grids dimensionados pela cadência das fotos,
> divisores por mês e por local. As fotos favoritas ganham destaque
> automático."

**File:** `frontend/src/pages/Editor.jsx`

While the import runs, today the modal just shows "A importar…". Enrichment
can take several seconds for large albums (1000+ assets). Add a simple
progress hint:

> "A importar… (analisar metadata pode demorar alguns segundos em álbuns
> grandes)"

No streaming/progress events needed — a simple static hint is enough.

### Documentation

**File:** `README.md`, section *Importing an album*.

Replace the existing bullet list with:

> When you import an album, the importer:
>
> - Extracts the first favourite (or highest-rated) photo as a full-bleed
>   hero; falls back to the first chronological photo if none are marked.
> - Groups the rest into clusters using time proximity (within
>   `IMPORT_BURST_THRESHOLD_SECONDS`, default 45s) and GPS proximity
>   (within `IMPORT_GPS_PROXIMITY_METERS`, default 200m).
> - Renders each cluster as a single block sized by its content: pairs as
>   duos, triples as asymmetric layouts, quads as 2×2, longer bursts as
>   3- or 4-column dense mosaics.
> - Adds dividers when the calendar month or the dominant place changes.
> - Promotes a medium hero at the start of each new section when the
>   cluster has 2 or more photos.
> - Splits videos longer than `IMPORT_VIDEO_LONG_SECONDS` (default 10s)
>   into their own video blocks.
> - Pairs or triples leftover solo photos into duos / asymmetric grids
>   when they sit consecutively, respecting orientation.
> - Promotes favourite and high-rated photos to the dominant slot in every
>   grid and to hero blocks when they appear alone in a cluster.

**File:** `DOCS/immich-story-builder-spec.md`

Add a sub-section under *Importação automática* pointing to this document
as the source of truth for the algorithm.

---

## Manual test cases

Run these against real Immich albums after implementation:

1. **Single photo album** → only the story hero is emitted.
2. **Tight burst** (10 photos within 5s, same place) → hero + one dense
   4-column grid.
3. **Day trip with stops** (morning at café, afternoon at park, evening at
   restaurant — three temporal clusters at three GPS locations) → hero +
   three sections, each with appropriate sized blocks, dividers labelled
   with city.
4. **Restaurant lunch** (photos at 13:00, 13:50, 14:20 all within 50m) → a
   single merged cluster despite the time gaps, rendered as one grid.
5. **Mixed orientation solos** (4 unrelated photos taken hours apart, two
   landscape and two portrait) → 2 portrait → duo grid; 2 landscape →
   side-by-side; mixed remain singles.
6. **Multi-month album** → divider per month with `style: 'line'`.
7. **Same month, two cities** → primary divider for the month, lighter
   `style: 'space'` divider when city changes.
8. **30-second clip mid-album** → grid splits around the video block.
9. **2-second clip mid-album** → video stays inline as a grid thumbnail.
10. **Asset without EXIF** → falls through to time-only path, lands in
    grids as expected, no crashes.
11. **Album of 1000+ assets** → enrichment doesn't time out (use bounded
    concurrency; ideally use the metadata search endpoint instead of
    per-asset GETs).
12. **Album with favourite photos** → the story hero is the first favourite
    asset chronologically, not the first asset in the album. If the favourite
    is mid-album, the first asset still appears in its cluster's grid.
13. **Burst with one favourite** → the favourite photo occupies the dominant
    slot (position 0) of the cluster's grid; e.g. the large photo in an
    asymmetric layout if the cluster has ≥ 3 assets.
14. **Favourite photo taken alone** (cluster of 1) → generates a `hero` block
    (`height: 'medium'`), not a deferred solo. The solo collapse pass is
    skipped for this asset.
15. **No favourites, no rated photos** → behaviour identical to the original
    spec; no regressions.

---

## Out of scope (decisions taken)

- **No** access to Immich's Postgres database.
- **No** CLIP embeddings or `POST /api/search/smart`.
- **No** perceptual hashing of thumbnails.
- **No** people/face-based clustering. The Immich face data is exposed but
  requires additional calls per asset and adds significant complexity for
  marginal benefit on top of time + GPS. Reconsider in a future iteration if
  user feedback asks for it.
- **No** OCR-based grouping (not exposed via REST anyway).
- **No** new block types. All variation is achieved via existing `grid`,
  `hero`, `video`, and `divider` blocks with different configurations.
- **No** frontend-side regeneration. The algorithm runs once at import time;
  the editor remains a manual tool from there.
