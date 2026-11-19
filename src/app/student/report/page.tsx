"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CAMPUS_CENTER, CAMPUS_LOCATIONS, CATEGORIES } from "@/lib/constants";

/** Distance in metres between two points. */
function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** The closest named campus place, if one is within 150 m. */
function nearestCampusPlace(p: { lat: number; lng: number }) {
  let best: { name: string; d: number } | null = null;
  for (const l of CAMPUS_LOCATIONS) {
    const d = distanceM(p, l);
    if (!best || d < best.d) best = { name: l.name, d };
  }
  return best && best.d <= 150 ? best.name : null;
}

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => <div className="h-[300px] animate-pulse rounded-lg bg-slate-100" />,
});

const MAX_FILE_MB = 5;

export default function ReportPage() {
  const router = useRouter();
  const [locationName, setLocationName] = useState("");
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [gpsNote, setGpsNote] = useState<string | null>(null);

  function typeLocation(name: string) {
    setLocationName(name);
    // If the typed text matches a known campus place, drop the pin there.
    const loc = CAMPUS_LOCATIONS.find((l) => l.name.toLowerCase() === name.trim().toLowerCase());
    if (loc) setPoint({ lat: loc.lat, lng: loc.lng });
  }

  function locateMe() {
    if (!("geolocation" in navigator)) {
      return setGpsNote("This browser cannot share its location. Type the place instead.");
    }
    setLocating(true);
    setGpsNote(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPoint(p);
        const place = nearestCampusPlace(p);
        // Fill the name only if the student has not typed one already.
        if (!locationName.trim()) setLocationName(place ?? "My current location");
        setGpsNote(
          `Location found (accurate to about ${Math.round(pos.coords.accuracy)} m)` +
          (place ? `, near ${place}.` : ". You can rename the place above."),
        );
        setLocating(false);
      },
      (err) => {
        setGpsNote(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Allow it in your browser, or type the place instead."
            : "Could not get your location. Type the place or tap the map instead.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  function chooseFiles(list: FileList | null) {
    const chosen = Array.from(list ?? []);
    const tooBig = chosen.find((f) => f.size > MAX_FILE_MB * 1024 * 1024);
    if (tooBig) return setError(`${tooBig.name} is larger than ${MAX_FILE_MB} MB.`);
    setError(null);
    setFiles(chosen);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!locationName.trim()) return setError("Type where it happened, or use your current location.");
    // Typed a place with no pin? Use the campus centre as an approximate position.
    const pin = point ?? { lat: CAMPUS_CENTER[0], lng: CAMPUS_CENTER[1] };
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const supabase = createClient();

    const { data: incidentId, error: rpcError } = await supabase.rpc("submit_incident", {
      p_category: String(form.get("category")),
      p_description: String(form.get("description")),
      p_location_name: locationName.trim(),
      p_latitude: pin.lat,
      p_longitude: pin.lng,
      p_incident_date: new Date(String(form.get("incident_date"))).toISOString(),
      p_is_anonymous: form.get("is_anonymous") === "on",
    });
    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }

    // Upload evidence to  evidence/<incident_id>/<timestamp>-<name>
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${incidentId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("evidence").upload(path, file);
      if (upErr) {
        setError(`Report saved, but uploading ${file.name} failed: ${upErr.message}`);
        setLoading(false);
        return;
      }
      await supabase.from("evidence").insert({ incident_id: incidentId, file_path: path, file_name: file.name });
    }

    router.replace(`/student?submitted=${incidentId}`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">Report an incident</h1>

      <form onSubmit={onSubmit} className="card space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="category">Category</label>
            <select id="category" name="category" required className="input capitalize" defaultValue="">
              <option value="" disabled>Select…</option>
              {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="incident_date">When did it happen?</label>
            <input id="incident_date" name="incident_date" type="datetime-local" required className="input" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="description">Description</label>
          <textarea id="description" name="description" required minLength={10} rows={4} className="input"
                    placeholder="What happened? Who was involved? Any other details…" />
        </div>

        <div>
          <label className="label" htmlFor="location">Location</label>
          <div className="mb-2 flex flex-col gap-2 sm:flex-row">
            <input id="location" list="campus-places" required className="input" value={locationName}
                   onChange={(e) => typeLocation(e.target.value)}
                   placeholder="Type a place, e.g. Male Hostel, Block C" autoComplete="off" />
            <button type="button" onClick={locateMe} disabled={locating}
                    className="btn-secondary shrink-0 whitespace-nowrap">
              {locating ? "Locating…" : "📍 Use my current location"}
            </button>
          </div>
          <datalist id="campus-places">
            {CAMPUS_LOCATIONS.map((l) => <option key={l.name} value={l.name} />)}
          </datalist>
          {gpsNote && <p className="mb-2 text-xs text-slate-600">{gpsNote}</p>}
          <LocationPicker value={point} onPick={(lat, lng) => setPoint({ lat, lng })} />
        </div>

        <div>
          <label className="label" htmlFor="evidence">Evidence (images or PDF, max {MAX_FILE_MB} MB each)</label>
          <input id="evidence" type="file" multiple accept="image/*,application/pdf"
                 onChange={(e) => chooseFiles(e.target.files)} className="block text-sm" />
        </div>

        <label className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
          <input type="checkbox" name="is_anonymous" className="mt-0.5" />
          <span>
            <strong>Report anonymously</strong>: administrators won’t see your name.
          </span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="btn-primary w-full">{loading ? "Submitting…" : "Submit report"}</button>
      </form>
    </div>
  );
}
