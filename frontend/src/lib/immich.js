const IMMICH_URL = import.meta.env.VITE_IMMICH_URL?.replace(/\/$/, '') || '';

export function thumbUrl(assetId, size = 'thumbnail') {
  if (!assetId) return '';
  // Use proxy route to avoid CORS issues in public viewer
  return `/api/immich/assets/${assetId}/thumb?size=${size}`;
}

export function originalUrl(assetId) {
  if (!assetId) return '';
  return `/api/immich/assets/${assetId}/original`;
}

export { IMMICH_URL };
