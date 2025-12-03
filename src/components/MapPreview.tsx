import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapPreviewProps {
  latitude: number | null;
  longitude: number | null;
  title?: string;
  height?: string;
}

export default function MapPreview({
  latitude,
  longitude,
  title = "Lokasi Laporan",
  height = "h-80",
}: MapPreviewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || !latitude || !longitude) return;

    // Initialize map
    if (map.current) {
      map.current.remove();
    }

    map.current = L.map(mapContainer.current).setView(
      [latitude, longitude],
      15
    );

    // Add OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map.current);

    // Add marker at location
    L.marker([latitude, longitude])
      .addTo(map.current)
      .bindPopup(
        `<div class="text-sm">
          <p class="font-semibold">${title}</p>
          <p>${latitude.toFixed(6)}, ${longitude.toFixed(6)}</p>
        </div>`
      )
      .openPopup();

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [latitude, longitude, title]);

  if (!latitude || !longitude) {
    return (
      <div
        className={`${height} w-full rounded-lg border-2 border-dashed border-muted-foreground flex items-center justify-center bg-muted/30`}
      >
        <p className="text-muted-foreground text-sm">
          Koordinat tidak tersedia
        </p>
      </div>
    );
  }

  return (
    <div ref={mapContainer} className={`${height} w-full rounded-lg border`} />
  );
}
