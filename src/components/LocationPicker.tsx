"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import { CAMPUS_CENTER } from "@/lib/constants";

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** Moves the map to the pin when it is set from GPS or a typed place. */
function FollowPin({ value }: { value: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (value && !map.getBounds().pad(-0.2).contains([value.lat, value.lng])) {
      map.flyTo([value.lat, value.lng], Math.max(map.getZoom(), 16), { duration: 0.8 });
    }
  }, [value, map]);
  return null;
}

/** Map the student clicks to fine-tune the exact spot. Load it with next/dynamic (no SSR). */
export default function LocationPicker({
  value, onPick,
}: { value: { lat: number; lng: number } | null; onPick: (lat: number, lng: number) => void }) {
  return (
    <MapContainer center={CAMPUS_CENTER} zoom={16} style={{ height: 300, width: "100%" }} className="rounded-lg">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onPick} />
      <FollowPin value={value} />
      {value && <CircleMarker center={[value.lat, value.lng]} radius={10} pathOptions={{ color: "#4f46e5" }} />}
    </MapContainer>
  );
}
