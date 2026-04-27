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
  return `/api/immich/assets/${assetId}/original`;
}

export { IMMICH_URL };
