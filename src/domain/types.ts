export type Lie = "tee" | "fairway" | "rough" | "sand" | "green" | "recovery";

export type ShotOutcome =
  | "fairway"
  | "green"
  | "right"
  | "left"
  | "short"
  | "long"
  | "bunker"
  | "penalty"
  | "putt"
  | "other";

export type ShotShape = "straight" | "fade" | "draw" | "stinger" | "layup";

export type Club = {
  id: string;
  name: string;
  carryMeters: number;
  totalMeters: number;
  notes?: string;
};

export type PlayerProfile = {
  id: string;
  name: string;
  dominantMiss: "right" | "left" | "short" | "long" | "mixed";
  clubs: Club[];
};

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type Hazard = {
  id: string;
  type: "bunker" | "water" | "trees" | "out" | "other";
  label: string;
  distanceFromTeeMeters?: number;
  side?: "left" | "right" | "center";
};

export type Hole = {
  number: number;
  par: number;
  meters: number;
  handicap?: number;
  tee?: GeoPoint;
  greenCenter?: GeoPoint;
  preferredMiss?: "left" | "right" | "short" | "long" | "center";
  hazards?: Hazard[];
  notes?: string;
};

export type Course = {
  id: string;
  name: string;
  location: GeoPoint;
  loops: string[];
  holes: Hole[];
};

export type WeatherSnapshot = {
  temperatureC?: number;
  windSpeedMs?: number;
  windDirectionDeg?: number;
  rainMm?: number;
  fetchedAtIso?: string;
};

export type RoundShot = {
  id: string;
  holeNumber: number;
  shotNumber: number;
  clubName: string;
  lie: Lie;
  outcome: ShotOutcome;
  plannedDistanceMeters?: number;
  measuredDistanceMeters?: number;
  position?: GeoPoint;
  createdAtIso: string;
  note?: string;
};

export type RoundState = {
  id: string;
  courseId: string;
  courseName: string;
  startedAtIso: string;
  currentHoleNumber: number;
  shots: RoundShot[];
};

export type Recommendation = {
  club?: Club;
  effectiveDistanceMeters: number;
  targetDistanceMeters: number;
  confidence: "low" | "medium" | "high";
  shotShape: ShotShape;
  message: string;
  factors: string[];
};
