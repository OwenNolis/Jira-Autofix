import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import ReactDOM from 'react-dom';

const ESSERS_LOCATIONS = [
  { name: "H. Essers HQ", address: "Transportlaan 4, 3600 Genk, Belgium", lat: 50.9659, lng: 5.4979, type: "Headquarters" },
  { name: "H. Essers Hasselt", address: "Kuringersteenweg 506, 3500 Hasselt, Belgium", lat: 50.9311, lng: 5.3378, type: "Regional Hub" },
  { name: "H. Essers Antwerp", address: "Luithagen-Haven 4, 2030 Antwerp, Belgium", lat: 51.2593, lng: 4.3831, type: "Port Depot" },
  { name: "H. Essers Liège", address: "Rue de l'Aéroport 1, 4460 Liège, Belgium", lat: 50.6337, lng: 5.4432, type: "Regional Hub" },
  { name: "H. Essers Rotterdam", address: "Coloradoweg 30, 3199 LD Rotterdam, Netherlands", lat: 51.8761, lng: 4.3193, type: "Port Depot" },
  { name: "H. Essers Milano", address: "Via Fantoli 15, 20138 Milan, Italy", lat: 45.4477, lng: 9.2659, type: "Regional Hub" },
  { name: "H. Essers Barcelona", address: "Carrer de la Llacuna 162, 08018 Barcelona, Spain", lat: 41.4036, lng: 2.1971, type: "Regional Hub" },
  { name: "H. Essers Warsaw", address: "ul. Żwirki i Wigury 1, 00-906 Warsaw, Poland", lat: 52.1657, lng: 20.9671, type: "Regional Hub" },
  { name: "H. Essers Bucharest", address: "Șoseaua de Centură 1, Bucharest, Romania", lat: 44.4268, lng: 26.1025, type: "Regional Hub" },
  { name: "H. Essers Stuttgart", address: "Flughafenstraße 50, 70629 Stuttgart, Germany", lat: 48.6894, lng: 9.1922, type: "Regional Hub" },
];

const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Remove default icon globally
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon.options.iconUrl,
  iconRetinaUrl: markerIcon.options.iconRetinaUrl,
  shadowUrl: markerIcon.options.shadowUrl,
});

const TYPE_COLORS: Record<string, string> = {
  'Headquarters': '#007bff',
  'Regional Hub': '#4caf50',
  'Port Depot': '#ff9800',
};

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className="essers-type-badge"
      style={{ background: TYPE_COLORS[type] || '#bdbdbd', color: '#fff', borderRadius: 12, padding: '3px 12px', fontWeight: 600, fontSize: '0.98em', marginLeft: 8 }}
    >
      {type}
    </span>
  );
}

function MapSidePanel({ location, open, onClose }: { location: typeof ESSERS_LOCATIONS[0] | null, open: boolean, onClose: () => void }) {
  if (!open || !location) return null;
  return ReactDOM.createPortal(
    <div className="essers-sidepanel-overlay" onClick={onClose}>
      <aside className="essers-sidepanel" onClick={e => e.stopPropagation()}>
        <button className="essers-sidepanel-close" onClick={onClose} aria-label="Close panel">×</button>
        <h2 style={{ marginTop: 0 }}>{location.name} <TypeBadge type={location.type} /></h2>
        <div style={{ marginBottom: 18, fontSize: '1.08em' }}>{location.address}</div>
        <section className="essers-sidepanel-section">
          <h3>Contact</h3>
          <div style={{ color: '#888', fontStyle: 'italic' }}>Contact info coming soon.</div>
        </section>
      </aside>
    </div>,
    document.body
  );
}

function EssersMap() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<typeof ESSERS_LOCATIONS[0] | null>(null);

  // Center on Europe
  const center: LatLngExpression = [50.5, 10];

  // Keyboard close for sidepanel
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClosePanel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line
  }, [panelOpen]);

  const onOpenPanel = (loc: typeof ESSERS_LOCATIONS[0]) => {
    setSelectedLocation(loc);
    setPanelOpen(true);
  };
  const onClosePanel = () => {
    setPanelOpen(false);
    setSelectedLocation(null);
  };

  return (
    <div className="map-page essers-map-wrapper">
      <h1>H. Essers Locations Map</h1>
      <div className="essers-map-container">
        <MapContainer center={center} zoom={5} style={{ height: '70vh', width: '100%', minHeight: 400, borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }} scrollWheelZoom={true}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {ESSERS_LOCATIONS.map((loc, idx) => (
            <Marker key={idx} position={[loc.lat, loc.lng]} icon={markerIcon}>
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontSize: '1.08em', marginBottom: 2 }}>{loc.name}</div>
                  <TypeBadge type={loc.type} />
                  <div style={{ margin: '8px 0 8px 0', fontSize: '0.98em' }}>{loc.address}</div>
                  <button
                    className="essers-popup-btn"
                    onClick={() => onOpenPanel(loc)}
                    style={{ background: '#007bff', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontWeight: 600, cursor: 'pointer', fontSize: '1em' }}
                  >
                    View details
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <MapSidePanel location={selectedLocation} open={panelOpen} onClose={onClosePanel} />
    </div>
  );
}

export default EssersMap;
