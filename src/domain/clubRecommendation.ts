import { Club, Lie, PlayerProfile, Recommendation, WeatherSnapshot } from "./types";

function normalizeClubName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "");
}

function isDriver(club: Club): boolean {
  const value = normalizeClubName(club.name);
  return value.includes("driver") || value === "dr";
}

function isFairwayWood(club: Club): boolean {
  const value = normalizeClubName(club.name);
  return value.includes("wood") || value.includes("3w") || value.includes("5w");
}

function lieMultiplier(lie: Lie): number {
  switch (lie) {
    case "rough":
      return 1.08;
    case "sand":
      return 1.15;
    case "recovery":
      return 1.18;
    case "green":
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
        factors.push(`Motvind: lägg till cirka ${windMeters} m.`);
      } else if (diff > 120) {
        const tailwind = Math.round(windMeters * 0.6);
        adjustment -= tailwind;
        factors.push(`Medvind: spelar cirka ${tailwind} m kortare.`);
      } else {
        factors.push("Sidvind: välj trygg riktning och marginal.");
      }
    } else {
      const fallback = Math.round(windMeters * 0.4);
      adjustment += fallback;
      factors.push(`Vind finns: lägg på cirka ${fallback} m tills riktningen används.`);
    }
  }

  if (typeof weather.temperatureC === "number" && weather.temperatureC < 10) {
    const cold = Math.max(2, Math.round(targetDistanceMeters * 0.03));
    adjustment += cold;
    factors.push(`Kallt: lägg till cirka ${cold} m.`);
  }

  if (typeof weather.rainMm === "number" && weather.rainMm > 0.2) {
    const rain = Math.max(2, Math.round(targetDistanceMeters * 0.025));
    adjustment += rain;
    factors.push(`Regn/fukt: lägg till cirka ${rain} m.`);
  }

  return { meters: adjustment, factors };
}

export function playableClubsForLie(
  profile: PlayerProfile,
  lie: Lie,
  targetDistanceMeters?: number,
): Club[] {
  const clubs = [...profile.clubs]
    .filter((club) => club.carryMeters > 0)
    .sort((a, b) => a.carryMeters - b.carryMeters);

  if (lie === "tee") return clubs;

  if (lie === "green") {
    return clubs.slice(0, 2);
  }

  let filtered = clubs.filter((club) => !isDriver(club));

  if (lie === "rough") {
    filtered = filtered.filter((club) => {
      if (isFairwayWood(club) && (targetDistanceMeters ?? 0) < 215) return false;
      return true;
    });
  }

  if (lie === "sand") {
    filtered = filtered.filter((club) => club.carryMeters <= 170 && !isFairwayWood(club));
  }

  if (lie === "recovery") {
    filtered = filtered.filter((club) => club.carryMeters <= 180 && !isFairwayWood(club));
  }

  return filtered.length > 0 ? filtered : clubs.filter((club) => !isDriver(club));
}

function chooseClub(clubs: Club[], effectiveDistanceMeters: number): Club | undefined {
  if (clubs.length === 0) return undefined;

  const enough = clubs.find((club) => club.carryMeters >= effectiveDistanceMeters * 0.98);
  if (enough) return enough;

  return clubs[clubs.length - 1];
}

function suggestShotShape(
  profile: PlayerProfile,
  lie: Lie,
  targetDistanceMeters: number,
  weather?: WeatherSnapshot,
): Recommendation["shotShape"] {
  if (lie !== "tee") return "straight";

  if (targetDistanceMeters > 180 && (weather?.windSpeedMs ?? 0) >= 8) {
    return "stinger";
  }

  if (targetDistanceMeters > 190 && profile.dominantMiss === "right") {
    return "draw";
  }

  if (targetDistanceMeters > 190 && profile.dominantMiss === "left") {
    return "fade";
  }

  return "straight";
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
    factors.push(`${lie}: spelar cirka ${Math.round((lieFactor - 1) * 100)}% längre.`);
  }

  const weatherAdjustment = weatherAdjustmentMeters(targetDistanceMeters, weather, targetBearingDeg);
  effective += weatherAdjustment.meters;
  factors.push(...weatherAdjustment.factors);

  const effectiveRounded = Math.max(1, Math.round(effective));
  const playableClubs = playableClubsForLie(profile, lie, targetDistanceMeters);
  const club = chooseClub(playableClubs, effectiveRounded);

  if (lie !== "tee" && club && isDriver(club)) {
    factors.push("Driver används inte utanför tee i denna logik.");
  }

  const shotShape = suggestShotShape(profile, lie, targetDistanceMeters, weather);

  const message = club
    ? `${Math.round(targetDistanceMeters)} m spelar cirka ${effectiveRounded} m. Rekommendation: ${club.name}.`
    : `${Math.round(targetDistanceMeters)} m spelar cirka ${effectiveRounded} m. Lägg in dina klubblängder för klubbval.`;

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