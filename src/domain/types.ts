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

export type HoleScore = {
  holeNumber: number;
  par: number;
  strokes: number;
  putts?: number;
  penalties?: number;
  createdAtIso: string;
};

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

export type HazardType = "bunker" | "water" | "trees" | "out" | "rough" | "other";
export type HazardSeverity = "low" | "medium" | "high";

export type Hazard = {
  id: string;
  type: HazardType;
  label: string;
  distanceFromTeeMeters?: number;
  startDistanceMeters?: number;
  endDistanceMeters?: number;
  side?: "left" | "right" | "center";
  severity?: HazardSeverity;
  notes?: string;
};

export type Hole = {
  number: number;
  par: number;
  meters: number;
  handicap?: number;
  tee?: GeoPoint;
  greenCenter?: GeoPoint;
  greenFrontMetersFromTee?: number;
  greenBackMetersFromTee?: number;
  preferredMiss?: "left" | "right" | "short" | "long" | "center";
  greenSize?: "small" | "medium" | "large";
  doglegDirection?: "left" | "right" | "none";
  doglegCornerDistanceMeters?: number;
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

export type ShotIntent =
  | "tee"
  | "attack_green"
  | "layup"
  | "safe_advance"
  | "recovery"
  | "chip"
  | "putt";

export type RoundShot = {
  id: string;
  holeNumber: number;
  shotNumber: number;
  clubName: string;
  lie: Lie;
  intent: ShotIntent;
  outcome: ShotOutcome;
  plannedDistanceMeters?: number;
  measuredDistanceMeters?: number;
  startPosition?: GeoPoint;
  endPosition?: GeoPoint;
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

export type ShotPlanKind = "go_for_green" | "layup" | "safe_advance";

export type ShotPlanOption = {
  kind: ShotPlanKind;
  label: string;
  club?: Club;
  clubName: string;
  intent: ShotIntent;
  targetDistanceMeters: number;
  effectiveDistanceMeters: number;
  expectedRemainingMeters: number;
  requiredCarryMeters?: number;
  riskScore: number;
  rewardScore: number;
  recommended: boolean;
  explanation: string[];
  message: string;
};

export type ShotPlanResult = {
  headline: string;
  summary: string;
  recommendedOption: ShotPlanOption;
  options: ShotPlanOption[];
};