const sectorAreas = [
  { min: 1, max: 6, area: "Downtown Core", lat: 1.2866, lng: 103.8504 },
  { min: 7, max: 10, area: "HarbourFront", lat: 1.2656, lng: 103.8229 },
  { min: 11, max: 16, area: "Queenstown", lat: 1.2942, lng: 103.7868 },
  { min: 17, max: 23, area: "Central", lat: 1.3033, lng: 103.8357 },
  { min: 24, max: 27, area: "River Valley", lat: 1.2948, lng: 103.8318 },
  { min: 28, max: 30, area: "Bishan", lat: 1.3504, lng: 103.8489 },
  { min: 31, max: 33, area: "Toa Payoh", lat: 1.3343, lng: 103.8519 },
  { min: 34, max: 41, area: "Kallang", lat: 1.3114, lng: 103.8719 },
  { min: 42, max: 45, area: "Marine Parade", lat: 1.3038, lng: 103.9072 },
  { min: 46, max: 48, area: "Bedok", lat: 1.3241, lng: 103.9303 },
  { min: 49, max: 50, area: "Tampines", lat: 1.3549, lng: 103.9433 },
  { min: 51, max: 52, area: "Upper East Coast", lat: 1.3151, lng: 103.9566 },
  { min: 53, max: 57, area: "Hougang", lat: 1.3701, lng: 103.8921 },
  { min: 58, max: 59, area: "Ang Mo Kio", lat: 1.3691, lng: 103.8454 },
  { min: 60, max: 64, area: "Jurong East", lat: 1.3331, lng: 103.7428 },
  { min: 65, max: 68, area: "Jurong West", lat: 1.3496, lng: 103.7086 },
  { min: 69, max: 71, area: "Bukit Timah", lat: 1.3408, lng: 103.7751 },
  { min: 72, max: 74, area: "Choa Chu Kang", lat: 1.3840, lng: 103.7470 },
  { min: 75, max: 76, area: "Woodlands", lat: 1.4382, lng: 103.7890 },
  { min: 77, max: 78, area: "Yishun", lat: 1.4294, lng: 103.8354 },
  { min: 79, max: 80, area: "Seletar", lat: 1.3992, lng: 103.8750 },
  { min: 81, max: 82, area: "Punggol", lat: 1.4053, lng: 103.9023 }
] as const;

export interface PostalLocation {
  postalCode: string;
  area: string;
  lat: number;
  lng: number;
}

export function parseSingaporePostalCode(postalCode: string): PostalLocation {
  const normalized = postalCode.trim();

  if (!/^\d{6}$/.test(normalized)) {
    throw new Error("Singapore postal codes must contain exactly 6 digits.");
  }

  const sector = Number(normalized.slice(0, 2));
  const match = sectorAreas.find((item) => sector >= item.min && sector <= item.max);

  if (!match) {
    throw new Error("That postal code does not map to a supported Singapore sector.");
  }

  return {
    postalCode: normalized,
    area: match.area,
    lat: match.lat,
    lng: match.lng
  };
}

export function haversineDistanceKm(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
): number {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(end.lat - start.lat);
  const deltaLng = toRadians(end.lng - start.lng);
  const startLat = toRadians(start.lat);
  const endLat = toRadians(end.lat);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

