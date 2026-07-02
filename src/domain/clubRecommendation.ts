import { Club, Lie, PlayerProfile, Recommendation, WeatherSnapshot } from "./types";

function lieMultiplier(lie: Lie): number {
  switch (lie) {
    case "rough":
      return 1.08;
    case "sand":
      return 1.14;
    case "recovery":
      return 1.18;
    case "green":
      return 1;
    case "tee":
    case "fairway":
    default:
      return 1;
  }
}

function normalizeAngle(angle: number): number {
  const value = Math.abs(((angle + 180) % 360) - 180);
  return Number.isNaN(value) ? 90 : value;
}

function weatherAdjustmentMeters(
  targetDistanceMeters: number,
  weather?: WeatherSnapshot,
  targetBearingDeg?: number,
): { meters: number; factors: string[] } {
  if (!weather) return { meters: 0, factors: [] };

  let adjustment = 0;
  const factors: string[] = [];

  if (typeof weather.windSpeedMs === "number" && weather.windSpeedMs >= 4) {
    const windMeters = Math.round(weather.windSpeedMs * 1.2);

    if (typeof weather.windDirectionDeg === "number" && typeof targetBearingDeg === "number") {
      const diff = normalizeAngle(weather.windDirectionDeg - targetBearingDeg);
      if (diff < 60) {
        adjustment += windMeters;
        factors.push(`Motvind: lagg till cirka ${windMeters} m`);
      } else if (diff > 120) {
        adjustment -= Math.round(windMeters * 0.6);
        factors.push(`Medvind: spelar cirka ${Math.round(windMeters * 0.6)} m kortare`);
      } else {
        factors.push("Sidvind: valj trygg riktning och marginal");
      }
    } else {
      const fallback = Math.round(windMeters * 0.4);
      adjustment += fallback;
      factors.push(`Vind finns: lagg pa cirka ${fallback} m tills riktning ar kopt`);
    }
  }

  if (typeof weather.temperatureC === "number" && weather.temperatureC < 10) {
    const cold = Math.max(2, Math.round(targetDistanceMeters * 0.03));
    adjustment += cold;
    factors.push(`Kallt: lagg till cirka ${cold} m`);
  }

  if (typeof weather.rainMm === "number" && weather.rainMm > 0.2) {
    const rain = Math.max(2, Math.round(targetDistanceMeters * 0.025));
    adjustment += rain;
    factors.push(`Regn/fukt: lagg till cirka ${rain} m`);
  }

  return { meters: adjustment, factors };
}

function chooseClub(clubs: Club[], effectiveDistanceMeters: number): Club | undefined {
  const sorted = [...clubs].sort((a, b) => a.carryMeters - b.carryMeters);
  const playable = sorted.filter((club) => club.carryMeters > 0);
  if (playable.length === 0) return undefined;

  const enough = playable.find((club) => club.carryMeters >= effectiveDistanceMeters * 0.98);
  if (enough) return enough;

  return playable[playable.length - 1];
}

export function recommendClub(params: {
  profile: PlayerProfile;
  targetDistanceMeters: number;
  lie: Lie;
  weather?: WeatherSnapshot;
  targetBearingDeg?: number;
}): Recommendation {
  const { profile, targetDistanceMeters, lie, weather, targetBearingDeg } = params;
  const factors: string[] = [];

  const lieFactor = lieMultiplier(lie);
  let effective = targetDistanceMeters * lieFactor;

  if (lieFactor !== 1) {
    factors.push(`${lie}: spelar cirka ${Math.round((lieFactor - 1) * 100)}% langre`);
  }

  const weatherAdjustment = weatherAdjustmentMeters(targetDistanceMeters, weather, targetBearingDeg);
  effective += weatherAdjustment.meters;
  factors.push(...weatherAdjustment.factors);

  const effectiveRounded = Math.max(1, Math.round(effective));
  const club = chooseClub(profile.clubs, effectiveRounded);

  let shotShape: Recommendation["shotShape"] = "straight";
  if (profile.dominantMiss === "right") shotShape = "draw";
  if (profile.dominantMiss === "left") shotShape = "fade";
  if (lie === "tee" && targetDistanceMeters > 180 && weather?.windSpeedMs && weather.windSpeedMs > 8) {
    shotShape = "stinger";
  }

  const message = club
    ? `${Math.round(targetDistanceMeters)} m spelar cirka ${effectiveRounded} m. Rekommendation: ${club.name}. Slagtyp: ${shotShape}.`
    : `${Math.round(targetDistanceMeters)} m spelar cirka ${effectiveRounded} m. Lagg in dina klubblangder for klubbval.`;

  return {
    club,
    effectiveDistanceMeters: effectiveRounded,
    targetDistanceMeters: Math.round(targetDistanceMeters),
    confidence: club ? "medium" : "low",
    shotShape,
    message,
    factors,
  };
}
