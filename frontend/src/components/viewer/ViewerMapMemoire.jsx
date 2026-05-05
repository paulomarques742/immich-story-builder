import { useEffect, useId, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>';

const PinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mv-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

function createMemoireIcon(isPrimary = false) {
  const fill = isPrimary ? 'var(--mv-accent, #c4795a)' : '#3a3530';
  const shadow = isPrimary ? 'rgba(196,121,90,0.4)' : 'rgba(0,0,0,0.25)';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34">
      <filter id="s"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="${shadow}"/></filter>
      <g filter="url(#s)">
        <path d="M13 1C7.48 1 3 5.48 3 11c0 7.75 10 21 10 21S23 18.75 23 11C23 5.48 18.52 1 13 1z" fill="${fill}"/>
        <circle cx="13" cy="11" r="4.5" fill="white" opacity="0.92"/>
        <circle cx="13" cy="11" r="2" fill="${fill}"/>
      </g>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [26, 34],
    iconAnchor: [13, 34],
    popupAnchor: [0, -36],
  });
}

export default function ViewerMapMemoire({ content }) {
  const uid = useId().replace(/:/g, '');
  const mapClass = `mv-map-memoire-${uid}`;
  const [activeSkin, setActiveSkin] = useState('memoire');

  const { mode = 'manual', label, lat, lng, zoom = 12, show_route, route_color = '#c4795a' } = content;

  const markers = mode === 'auto'
    ? (content.resolved_markers || []).filter((m) => m.lat != null)
    : (lat && lng ? [{ lat, lng, label }] : []);
  const positions = markers.map((m) => [m.lat, m.lng]);
  const center = positions[0] || [38.7, -9.1];

  // inject/remove scoped CSS filter for tiles
  useEffect(() => {
    const id = `mv-style-${uid}`;
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    if (activeSkin !== 'memoire') return;

    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      .${mapClass} .leaflet-tile-pane {
        filter: sepia(0.35) saturate(0.85) brightness(1.04) contrast(0.97) hue-rotate(-8deg);
      }
      @media (prefers-color-scheme: dark) {
        .${mapClass} .leaflet-tile-pane {
          filter: sepia(0.2) saturate(0.7) brightness(0.95);
        }
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById(id)?.remove(); };
  }, [activeSkin, mapClass, uid]);

  if (markers.length === 0) {
    return (
      <div style={{
        borderRadius: 8, overflow: 'hidden', border: '1px solid var(--paper-deep)',
        background: 'var(--paper-warm)', margin: '2.5rem 0',
      }}>
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--ink-muted)' }}>
            Sem coordenadas GPS
          </p>
        </div>
      </div>
    );
  }

  const tileUrl = activeSkin === 'memoire' ? TILE_URL : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const tileAttr = activeSkin === 'memoire' ? TILE_ATTR : '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

  return (
    <div style={{
      borderRadius: 8, overflow: 'hidden',
      border: '1px solid var(--paper-deep)',
      background: 'var(--paper-warm)', margin: '2.5rem 0',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1.5rem', borderBottom: '1px solid var(--paper-deep)',
        display: 'flex', alignItems: 'center', gap: '0.6rem',
      }}>
        <PinIcon />
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 400, color: 'var(--ink)' }}>
            {label || 'Mapa'}
          </p>
          {markers.length > 1 && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 300, color: 'var(--ink-muted)' }}>
              {markers.length} localizações
            </p>
          )}
        </div>
        {/* Toggle pill */}
        <button
          onClick={() => setActiveSkin((s) => s === 'memoire' ? 'standard' : 'memoire')}
          style={{
            padding: '3px 10px', borderRadius: 20, border: '1px solid var(--paper-deep)',
            background: activeSkin === 'memoire' ? 'var(--mv-accent)' : 'transparent',
            color: activeSkin === 'memoire' ? '#fff' : 'var(--ink-muted)',
            fontSize: '0.68rem', fontFamily: 'var(--font-body)', cursor: 'pointer',
            transition: 'all 200ms ease', flexShrink: 0,
          }}
        >
          {activeSkin === 'memoire' ? 'Mémoire' : 'Standard'}
        </button>
      </div>

      {/* Map canvas */}
      <div className={mapClass} style={{ position: 'relative' }}>
        <MapContainer center={center} zoom={zoom} style={{ height: 280, width: '100%' }} scrollWheelZoom={false}>
          <TileLayer url={tileUrl} attribution={tileAttr} />
          {markers.map((m, i) => (
            <Marker key={i} position={[m.lat, m.lng]} icon={activeSkin === 'memoire' ? createMemoireIcon(i === 0) : undefined}>
              {m.label && <Popup>{m.label}</Popup>}
            </Marker>
          ))}
          {show_route && positions.length > 1 && (
            <Polyline positions={positions} color={route_color} weight={2.5} dashArray="6 4" opacity={0.7} />
          )}
        </MapContainer>
        {/* Vignette overlay */}
        {activeSkin === 'memoire' && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 400,
            background: 'radial-gradient(ellipse at center, transparent 55%, rgba(240,233,220,0.32) 100%)',
          }} />
        )}
      </div>

      {/* Attribution */}
      <div style={{
        padding: '0.5rem 1rem', borderTop: '1px solid var(--paper-deep)',
        display: 'flex', justifyContent: 'space-between',
        fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: 'var(--ink-faint)',
      }}>
        <span>© OpenStreetMap{activeSkin === 'memoire' ? ' © CARTO' : ' contributors'}</span>
        {markers.length > 1 && <span>{markers.length} pontos</span>}
      </div>
    </div>
  );
}
