const IMMICH_URL = import.meta.env.VITE_IMMICH_URL?.replace(/\/$/, '') || '';

// Authenticated thumbnail URL — for use inside the editor (requires JWT).
export function thumbUrl(assetId, size = 'thumbnail') {
  if (!assetId) return '';
  const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('token') || '') : '';
  const tokenPart = token ? `&token=${encodeURIComponent(token)}` : '';
  return `/api/immich/assets/${assetId}/thumb?size=${size}${tokenPart}`;
}

// Public thumbnail URL — for use in the public viewer (no auth required).
// The backend validates the assetId belongs to the story before proxying.
export function publicThumbUrl(slug, assetId, size = 'thumbnail') {
  if (!assetId || !slug) return '';
  return `/api/public/${slug}/assets/${assetId}/thumb?size=${size}`;
}

export function originalUrl(assetId) {
  if (!assetId) return '';
  const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('token') || '') : '';
  const tokenPart = token ? `?token=${encodeURIComponent(token)}` : '';
  return `/api/immich/assets/${assetId}/original${tokenPart}`;
}

// Authenticated person face thumbnail URL (editor)
export function personThumbUrl(personId) {
  if (!personId) return '';
  const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('token') || '') : '';
  const tokenPart = token ? `?token=${encodeURIComponent(token)}` : '';
  return `/api/immich/people/${personId}/thumb${tokenPart}`;
}

// Public person face thumbnail URL (viewer, no auth required)
export function publicPersonThumbUrl(slug, personId) {
  if (!personId || !slug) return '';
  return `/api/public/${slug}/people/${personId}/thumb`;
}

export function publicOriginalUrl(slug, assetId) {
  if (!assetId || !slug) return '';
  return `/api/public/${slug}/assets/${assetId}/original`;
}

export { IMMICH_URL };
