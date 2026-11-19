"use client";

import dynamic from "next/dynamic";
import type { MapPoint } from "@/lib/types";

// Leaflet needs `window`, so the map is only rendered in the browser.
const IncidentMap = dynamic(() => import("./IncidentMap"), {
  ssr: false,
  loading: () => <div className="h-[380px] animate-pulse rounded-lg bg-slate-100" />,
});

export default function MapView(props: { points: MapPoint[]; height?: number }) {
  return <IncidentMap {...props} />;
}
