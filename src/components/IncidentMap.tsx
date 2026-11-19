"use client";

import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { CAMPUS_CENTER, STATUS_COLORS } from "@/lib/constants";
import type { MapPoint } from "@/lib/types";

/** Read-only map of incidents, coloured by status. Load it through MapView (no SSR). */
export default function IncidentMap({ points, height = 380 }: { points: MapPoint[]; height?: number }) {
  return (
    <MapContainer center={CAMPUS_CENTER} zoom={16} style={{ height, width: "100%" }} className="rounded-lg">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((p) => (
        <CircleMarker
          key={p.id}
          center={[p.lat, p.lng]}
          radius={8}
          pathOptions={{ color: STATUS_COLORS[p.status], fillOpacity: 0.6 }}
        >
          <Popup>
            <strong>#{p.id}</strong> {p.label}
            <br />
            Status: {p.status}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
