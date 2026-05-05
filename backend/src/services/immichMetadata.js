// Maps Immich asset metadata to the same scoring schema as asset_ai_scores.
// No network calls — purely derived from fields already present in the album response.

const TAG_THEME_MAP = {
  mountain: 'landscape', landscape: 'landscape', nature: 'landscape',
  forest: 'landscape', beach: 'landscape', sea: 'landscape', ocean: 'landscape',
  sunset: 'landscape', sunrise: 'landscape', sky: 'landscape', lake: 'landscape',
  portrait: 'portrait', face: 'portrait', selfie: 'portrait',
  architecture: 'architecture', building: 'architecture', city: 'architecture',
  street: 'architecture', urban: 'architecture',
  food: 'food', meal: 'food', restaurant: 'food', drink: 'food',
  night: 'night', dark: 'night', stars: 'night',
  water: 'water', river: 'water', waterfall: 'water', rain: 'water',
  event: 'event', party: 'event', concert: 'event', wedding: 'event', festival: 'event',
};

function deriveTheme(asset) {
  const people = asset.people || [];
  if (people.length >= 3) return 'group';
  if (people.length === 1) return 'portrait';

  const tags = asset.tags || [];
  for (const tag of tags) {
    const name = (tag.name || tag || '').toLowerCase();
    if (TAG_THEME_MAP[name]) return TAG_THEME_MAP[name];
  }

  return 'travel';
}

function deriveMood(theme) {
  const moodMap = {
    landscape: 'serene', portrait: 'intimate', group: 'joyful',
    architecture: 'dramatic', food: 'joyful', night: 'dramatic',
    water: 'serene', event: 'energetic', travel: 'serene',
  };
  return moodMap[theme] || 'serene';
}

/**
 * Computes a quality score and metadata from Immich asset fields.
 * Returns an object compatible with asset_ai_scores columns.
 */
function scoreFromImmichData(asset) {
  const exif = asset.exifInfo || {};
  const people = asset.people || [];
  const isFavorite = !!asset.isFavorite;
  const exifRating = exif.rating ?? null;
  const namedFaces = people.filter((p) => p.name && p.name.trim()).length;

  let score = 5;
  let isHero = false;

  if (isFavorite) {
    score = Math.max(score, 8);
    isHero = true;
  }

  if (exifRating != null) {
    const ratingScore = [0, 2, 3, 5, 7, 9][exifRating] ?? 5;
    score = Math.max(score, ratingScore);
    if (exifRating >= 4) isHero = true;
  }

  score = Math.min(10, score + Math.min(namedFaces, 2));

  const theme = deriveTheme(asset);
  const mood = deriveMood(theme);

  const firstNamedPerson = people.find((p) => p.name?.trim())?.name || null;
  const subject = firstNamedPerson || theme;

  return {
    score,
    theme,
    mood,
    is_hero: isHero,
    subject,
    suggested_caption: '',
    title_pt: '',
    city: exif.city ?? null,
    country: exif.country ?? null,
    lat: exif.latitude ?? null,
    lng: exif.longitude ?? null,
    people_json: JSON.stringify(people.map((p) => ({ id: p.id, name: p.name || '', confidence: p.confidence || 0 }))),
    tags_json: JSON.stringify((asset.tags || []).map((t) => t.name || t).filter(Boolean)),
    is_favorite: isFavorite ? 1 : 0,
    exif_rating: exifRating,
    source: 'immich',
  };
}

/**
 * Builds an album summary for the Gemini concepts prompt.
 */
function buildAlbumSummary(assets) {
  const people = new Map();
  const cities = new Set();
  const tags = new Map();
  let favoritesCount = 0;
  let minDate = null;
  let maxDate = null;

  for (const a of assets) {
    if (a.isFavorite) favoritesCount++;

    const date = a.fileCreatedAt || a.localDateTime;
    if (date) {
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    }

    for (const p of (a.people || [])) {
      if (p.name?.trim()) people.set(p.id, p.name.trim());
    }

    const exif = a.exifInfo || {};
    if (exif.city) cities.add(exif.city);

    for (const t of (a.tags || [])) {
      const name = (t.name || t || '').trim();
      if (name) tags.set(name, (tags.get(name) || 0) + 1);
    }
  }

  const dominantTags = [...tags.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name]) => name);

  return {
    totalPhotos: assets.length,
    favoritesCount,
    peopleNames: [...people.values()],
    cities: [...cities],
    dateRange: minDate ? { from: minDate.slice(0, 10), to: maxDate?.slice(0, 10) } : null,
    dominantTags,
  };
}

/**
 * Selects up to `n` representative assets for the concept preview:
 * favorites first, then one per city, then one per named person, then fill with varied dates.
 */
function selectRepresentativeAssets(assets, n = 10) {
  const picked = new Set();
  const result = [];

  function add(a) {
    if (!picked.has(a.id) && result.length < n) {
      picked.add(a.id);
      result.push(a);
    }
  }

  const images = assets.filter((a) => a.type !== 'VIDEO');

  // Favorites first
  images.filter((a) => a.isFavorite).slice(0, 3).forEach(add);

  // One per city
  const seenCities = new Set();
  for (const a of images) {
    const city = a.exifInfo?.city;
    if (city && !seenCities.has(city)) { seenCities.add(city); add(a); }
  }

  // One per named person
  const seenPeople = new Set();
  for (const a of images) {
    for (const p of (a.people || [])) {
      if (p.name?.trim() && !seenPeople.has(p.id)) {
        seenPeople.add(p.id);
        add(a);
        break;
      }
    }
  }

  // Fill remainder with evenly-spaced assets
  if (result.length < n) {
    const step = Math.max(1, Math.floor(images.length / n));
    for (let i = 0; i < images.length && result.length < n; i += step) add(images[i]);
  }

  return result;
}

module.exports = { scoreFromImmichData, buildAlbumSummary, selectRepresentativeAssets };
