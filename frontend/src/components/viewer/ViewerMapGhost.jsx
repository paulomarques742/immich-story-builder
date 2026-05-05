import { useEffect, useId, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>';

function createGhostIcon(isPrimary) {
  const accent = '#c4795a';
  const neutral = '#8a8378';
  if (isPrimary) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18" fill="${accent}" opacity="0.08"/>
      <circle cx="20" cy="20" r="11" fill="${accent}" opacity="0.14"/>
      <circle cx="20" cy="20" r="5"  fill="${accent}" opacity="0.92"/>
    </svg>`;
    return L.divIcon({ html: svg, className: '', iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -22] });
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="8" fill="${neutral}" opacity="0.12"/>
    <circle cx="10" cy="10" r="3" fill="${neutral}" opacity="0.5"/>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -12] });
}

export default function ViewerMapGhost({ content }) {
  const uid = useId().replace(/:/g, '');
  const mapClass = `mv-ghost-${uid}`;
  const { mode = 'manual', label, lat, lng, zoom = 12, show_route, route_color = '#c4795a' } = content;
  const wrapRef = useRef(null);
  const [visible, setVisible] = useState(false);

  const markers = mode === 'auto'
    ? (content.resolved_markers || []).filter((m) => m.lat != null)
    : (lat && lng ? [{ lat, lng, label: null }] : []);
  const positions = markers.map((m) => [m.lat, m.lng]);
  const center = positions[0] || [38.7, -9.1];

  // Inject scoped CSS: fade tiles to ghost level, remove Leaflet chrome
  useEffect(() => {
    const id = `mv-ghost-style-${uid}`;
    document.getElementById(id)?.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      .${mapClass} .leaflet-container {
        background: var(--paper, #faf7f2) !important;
      }
      .${mapClass} .leaflet-tile-pane {
        filter: grayscale(1) opacity(0.18) contrast(1.1) brightness(1.05);
      }
      .${mapClass} .leaflet-control-zoom,
      .${mapClass} .leaflet-control-attribution {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById(id)?.remove(); };
  }, [mapClass, uid]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, []);

  if (markers.length === 0) {
    return (
      <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--ink-muted)', opacity: 0.5 }}>
          Sem coordenadas GPS
        </p>
      </div>
    );
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', margin: '2.5rem 0' }}>
      <div
        className={mapClass}
        style={{
          borderRadius: 4, overflow: 'hidden',
          opacity: visible ? 1 : 0,
          transition: 'opacity 800ms ease',
        }}
      >
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: 300, width: '100%' }}
          scrollWheelZoom={false}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
          {markers.map((m, i) => (
            <Marker key={i} position={[m.lat, m.lng]} icon={createGhostIcon(i === 0)} />
          ))}
          {show_route && positions.length > 1 && (
            <Polyline positions={positions} color={route_color} weight={1.5} dashArray="5 4" opacity={0.45} />
          )}
        </MapContainer>
      </div>

      {label && (
        <p style={{
          textAlign: 'center', marginTop: '0.6rem',
          fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300,
          fontSize: '0.85rem', color: 'var(--ink-muted)', opacity: 0.55,
        }}>{label}</p>
      )}

      <span style={{
        position: 'absolute', bottom: label ? 28 : 4, left: 4,
        fontSize: '0.55rem', fontWeight: 300, fontFamily: 'var(--font-body)',
        color: 'var(--ink-muted)', opacity: 0.25, letterSpacing: '0.02em',
      }}>© OpenStreetMap © CARTO</span>

      {markers.length > 1 && (
        <span style={{
          position: 'absolute', bottom: label ? 28 : 4, right: 4,
          fontSize: '0.6rem', fontWeight: 300, fontStyle: 'italic',
          fontFamily: 'var(--font-display)', color: 'var(--ink-muted)', opacity: 0.4,
        }}>{markers.length} localizações</span>
      )}
    </div>
  );
}
