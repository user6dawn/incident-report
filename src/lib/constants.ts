export const CATEGORIES = [
  "theft", "harassment", "bullying", "vandalism", "accident", "assault", "fire", "other",
] as const;

export const STATUSES = ["new", "unresolved", "resolved"] as const;

// Approximate centre of Bingham University, Karu. Check it on the map and adjust if needed.
export const CAMPUS_CENTER: [number, number] = [8.9935, 7.6107];

// Preset campus locations. Using fixed names keeps the data clean for the ML model.
// Coordinates are placeholders around the centre: move them to the real buildings.
export const CAMPUS_LOCATIONS: { name: string; lat: number; lng: number }[] = [
  { name: "Main Gate",            lat: 8.9912, lng: 7.6085 },
  { name: "Admin Block",          lat: 8.9930, lng: 7.6100 },
  { name: "Library",              lat: 8.9938, lng: 7.6112 },
  { name: "Faculty of Computing", lat: 8.9945, lng: 7.6098 },
  { name: "Lecture Theatre",      lat: 8.9942, lng: 7.6120 },
  { name: "Cafeteria",            lat: 8.9927, lng: 7.6118 },
  { name: "Chapel",               lat: 8.9920, lng: 7.6105 },
  { name: "Male Hostel",          lat: 8.9955, lng: 7.6125 },
  { name: "Female Hostel",        lat: 8.9958, lng: 7.6095 },
  { name: "Sports Complex",       lat: 8.9965, lng: 7.6110 },
  { name: "Car Park",             lat: 8.9918, lng: 7.6092 },
  { name: "Health Centre",        lat: 8.9933, lng: 7.6130 },
];

export const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  unresolved: "bg-amber-100 text-amber-800",
  resolved: "bg-green-100 text-green-800",
};

export const STATUS_COLORS: Record<string, string> = {
  new: "#2563eb",
  unresolved: "#d97706",
  resolved: "#16a34a",
};

// Sort options for the flagged page.
export const FLAGGED_SORTS = {
  score_desc: "Highest score",
  score_asc: "Lowest score",
  date_desc: "Newest incident",
  date_asc: "Oldest incident",
  detected_desc: "Recently detected",
} as const;
export type FlaggedSort = keyof typeof FLAGGED_SORTS;
