const IMMICH_URL = import.meta.env.VITE_IMMICH_URL?.replace(/\/$/, '') || '';

export function thumbUrl(assetId, size = 'thumbnail') {
  if (!assetId) return '';
  const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('token') || '') : '';
  const tokenPart = token ? `&token=${encodeURIComponent(token)}` : '';
  return `/api/immich/assets/${assetId}/thumb?size=${size}${tokenPart}`;
}

export function originalUrl(assetId) {
  if (!assetId) return '';
  return `/api/immich/assets/${assetId}/original`;
}

export { IMMICH_URL };
