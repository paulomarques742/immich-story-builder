import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export default function MapBlock({ content }) {
  const { mode = 'manual' } = content;

  if (mode === 'manual') {
    const { lat, lng, zoom = 12, label } = content;
    if (!lat || !lng) {
      return <EmptyMap label="Define lat/lng nas propriedades" />;
    }
    return (
      <div style={s.wrap}>
        <MapContainer center={[lat, lng]} zoom={zoom} style={s.map} scrollWheelZoom={false}>
          <TileLayer url={OSM_URL} attribution={OSM_ATTR} />
          <Marker position={[lat, lng]}>
            {label && <Popup>{label}</Popup>}
          </Marker>
        </MapContainer>
        {label && <p style={s.caption}>{label}</p>}
      </div>
    );
  }

  // auto mode — uses pre-resolved markers stored in content
  const markers = content.resolved_markers || [];
  if (!markers.length) {
    return <EmptyMap label="Sem coordenadas GPS. Resolve os assets no editor." />;
  }

  const positions = markers
    .filter((m) => m.lat != null && m.lng != null)
    .map((m) => [m.lat, m.lng]);

  const center = positions[0] || [38.7, -9.1];
  const routeColor = content.route_color || '#E07B54';

  return (
    <div style={s.wrap}>
      <MapContainer center={center} zoom={content.zoom || 10} style={s.map} scrollWheelZoom={false}>
        <TileLayer url={OSM_URL} attribution={OSM_ATTR} />
        {positions.map(([lat, lng], i) => (
          <Marker key={i} position={[lat, lng]}>
            {markers[i]?.label && <Popup>{markers[i].label}</Popup>}
          </Marker>
        ))}
        {content.show_route && positions.length > 1 && (
          <Polyline positions={positions} color={routeColor} weight={3} />
        )}
      </MapContainer>
    </div>
  );
}

function EmptyMap({ label }) {
  return (
    <div style={{ ...s.map, background: '#e8eef2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#888', fontSize: 14 }}>{label}</p>
    </div>
  );
}

const s = {
  wrap: { width: '100%' },
  map: { width: '100%', height: 400 },
  caption: { textAlign: 'center', padding: '10px 16px', fontSize: 14, color: '#555' },
};
