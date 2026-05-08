import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvent } from 'react-leaflet';
import { useEffect, useRef } from 'react';

function ZoomSync({ center, zoom, programmaticRef }) {
  const map = useMap();
  useEffect(() => {
    programmaticRef.current = true;
    map.setView(center, zoom);
    const t = setTimeout(() => { programmaticRef.current = false; }, 400);
    return () => clearTimeout(t);
  }, [center[0], center[1], zoom]);
  return null;
}

function PanCapture({ onViewChange, programmaticRef }) {
  useMapEvent('moveend', (e) => {
    if (programmaticRef.current) return;
    const { lat, lng } = e.target.getCenter();
    onViewChange([lat, lng], e.target.getZoom());
  });
  return null;
}

function PinPlacer({ onMapClick }) {
  useMapEvent('click', (e) => {
    onMapClick(e.latlng.lat, e.latlng.lng);
  });
  return null;
}

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const PinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mv-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export default function ViewerMapStandard({ content, onViewChange, onMapClick }) {
  const { mode = 'manual', label, lat, lng, zoom = 12, show_route, route_color = '#c4795a' } = content;
  const programmaticRef = useRef(false);

  const markers = mode === 'auto'
    ? (content.resolved_markers || []).filter((m) => m.lat != null)
    : (lat && lng ? [{ lat, lng, label }] : []);
  const positions = markers.map((m) => [m.lat, m.lng]);
  const center = content.map_center || positions[0] || [38.7, -9.1];

  // In viewer mode with no markers: show placeholder
  if (markers.length === 0 && !onMapClick) {
    return (
      <div style={{
        borderRadius: 8, overflow: 'hidden', border: '1px solid var(--paper-deep)',
        background: 'var(--paper-warm)', margin: '2.5rem 0',
      }}>
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--ink-muted)' }}>
            {mode === 'manual' ? 'Define lat/lng nas propriedades' : 'Sem coordenadas GPS. Resolve os assets no editor.'}
          </p>
        </div>
      </div>
    );
  }

  const wrapStyle = {
    borderRadius: 8, overflow: 'hidden',
    border: '1px solid var(--paper-deep)',
    background: 'var(--paper-warm)', margin: '2.5rem 0',
  };

  // Empty manual mode in editor: show clickable map with hint
  if (markers.length === 0 && onMapClick) {
    return (
      <div style={wrapStyle}>
        <MapContainer center={center} zoom={zoom} style={{ height: 280, width: '100%', cursor: 'crosshair' }} scrollWheelZoom={false} dragging={true}>
          <ZoomSync center={center} zoom={zoom} programmaticRef={programmaticRef} />
          <PinPlacer onMapClick={onMapClick} />
          <TileLayer url={OSM_URL} attribution={OSM_ATTR} />
        </MapContainer>
        <div style={{
          padding: '0.5rem 1rem', borderTop: '1px solid var(--paper-deep)',
          fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--ink-muted)', textAlign: 'center',
        }}>
          Clique no mapa para colocar o pin
        </div>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <div style={{
        padding: '1rem 1.5rem', borderBottom: '1px solid var(--paper-deep)',
        display: 'flex', alignItems: 'center', gap: '0.6rem',
      }}>
        <PinIcon />
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 400, color: 'var(--ink)' }}>
            {label || 'Mapa'}
          </p>
          {markers.length > 1 && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 300, color: 'var(--ink-muted)' }}>
              {markers.length} localizações
            </p>
          )}
        </div>
      </div>

      <MapContainer center={center} zoom={zoom} style={{ height: 280, width: '100%' }} scrollWheelZoom={!!onViewChange} dragging={true}>
        <ZoomSync center={center} zoom={zoom} programmaticRef={programmaticRef} />
        {onViewChange && <PanCapture onViewChange={onViewChange} programmaticRef={programmaticRef} />}
        {onMapClick && mode === 'manual' && <PinPlacer onMapClick={onMapClick} />}
        <TileLayer url={OSM_URL} attribution={OSM_ATTR} />
        {markers.map((m, i) => (
          <Marker
            key={i}
            position={[m.lat, m.lng]}
            draggable={!!onMapClick && mode === 'manual'}
            eventHandlers={onMapClick && mode === 'manual' ? {
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng();
                onMapClick(lat, lng);
              },
            } : undefined}
          >
            {m.label && <Popup>{m.label}</Popup>}
          </Marker>
        ))}
        {show_route && positions.length > 1 && (
          <Polyline positions={positions} color={route_color} weight={2.5} dashArray="6 4" opacity={0.7} />
        )}
      </MapContainer>

      <div style={{
        padding: '0.5rem 1rem', borderTop: '1px solid var(--paper-deep)',
        display: 'flex', justifyContent: 'space-between',
        fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: 'var(--ink-faint)',
      }}>
        <span>© OpenStreetMap contributors</span>
        {onMapClick && mode === 'manual'
          ? <span style={{ color: 'var(--ink-muted)', fontSize: '0.7rem' }}>Clique ou arraste o pin para reposicionar</span>
          : markers.length > 1 && <span>{markers.length} pontos</span>}
      </div>
    </div>
  );
}
