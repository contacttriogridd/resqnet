import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  detail?: string;
  kind: 'shelter' | 'incident' | 'user';
  /** CSS colour for the marker (resolved from design tokens by the caller). */
  color: string;
}

/**
 * Interactive map (OpenStreetMap tiles via Leaflet). Loaded lazily and only
 * when the user asks for the map view. Tiles that were viewed online are
 * cached by the service worker; everything on this map is also available as
 * a plain list, which is the reliable offline fallback.
 */
export default function MapView({
  markers,
  onSelect,
  height = 420,
}: {
  markers: MapMarker[];
  onSelect?: (id: string) => void;
  height?: number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([11.0168, 76.9558], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    for (const mk of markers) {
      const marker = L.circleMarker([mk.latitude, mk.longitude], {
        radius: mk.kind === 'user' ? 9 : 11,
        color: '#ffffff',
        weight: 3,
        fillColor: mk.color,
        fillOpacity: 1,
      });
      // Build popup content with DOM APIs (never innerHTML) to avoid injection.
      const content = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = mk.label;
      content.append(title);
      if (mk.detail) {
        const p = document.createElement('div');
        p.textContent = mk.detail;
        content.append(p);
      }
      if (onSelect && mk.kind !== 'user') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Open details';
        btn.style.cssText = 'margin-top:6px;font-weight:600;text-decoration:underline;color:#1849a9';
        btn.onclick = () => onSelect(mk.id);
        content.append(btn);
      }
      marker.bindPopup(content);
      marker.bindTooltip(mk.label);
      g.addLayer(marker);
    }
    if (markers.length > 0) {
      m.fitBounds(L.latLngBounds(markers.map((x) => [x.latitude, x.longitude] as [number, number])), {
        padding: [30, 30],
        maxZoom: 15,
      });
    }
  }, [markers, onSelect]);

  return (
    <div
      ref={el}
      style={{ height }}
      className="z-0 overflow-hidden rounded-2xl border border-line"
      role="region"
      aria-label="Map. The same places are listed below the map."
    />
  );
}
