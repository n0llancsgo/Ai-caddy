import { Club, Hazard, Hole, PlayerProfile, Recommendation, WeatherSnapshot } from "./types";

function normalizeClubName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "");
}

function getTeeClubs(profile: PlayerProfile): Club[] {
  return [...profile.clubs]
    .filter((club) => club.carryMeters > 0)
    .sort((a, b) => a.carryMeters - b.carryMeters);
}

function getLongestClubUnder(profile: PlayerProfile, maxCarry: number): Club | undefined {
  return getTeeClubs(profile)
    .filter((club) => club.carryMeters <= maxCarry)
    .sort((a, b) => b.carryMeters - a.carryMeters)[0];
}

function getShortestClubOver(profile: PlayerProfile, minCarry: number): Club | undefined {
  return getTeeClubs(profile)
    .filter((club) => club.carryMeters >= minCarry)
    .sort((a, b) => a.carryMeters - b.carryMeters)[0];
}

function getLongestClub(profile: PlayerProfile): Club | undefined {
  return getTeeClubs(profile).sort((a, b) => b.carryMeters - a.carryMeters)[0];
}

function hazardStart(hazard: Hazard): number | undefined {
  if (typeof hazard.startDistanceMeters === "number") return hazard.startDistanceMeters;
  if (typeof hazard.distanceFromTeeMeters === "number") return hazard.distanceFromTeeMeters - 6;
  return undefined;
}

function hazardEnd(hazard: Hazard): number | undefined {
  if (typeof hazard.endDistanceMeters === "number") return hazard.endDistanceMeters;
  if (typeof hazard.distanceFromTeeMeters === "number") return hazard.distanceFromTeeMeters + 6;
  return undefined;
}

function majorHazardsAhead(hole: Hole): Hazard[] {
  return (hole.hazards ?? [])
    .filter((hazard) => {
      const start = hazardStart(hazard);
      if (typeof start !== "number") return false;
      if (start < 150) return false;

      return (
        hazard.type === "water" ||
        hazard.type === "out" ||
        hazard.severity === "high" ||
        (hazard.type === "bunker" && hazard.side === "center")
      );
    })
    .sort((a, b) => (hazardStart(a) ?? 9999) - (hazardStart(b) ?? 9999));
}

function windCarryExtra(weather?: WeatherSnapshot): number {
  if (!weather?.windSpeedMs) return 0;

  let extra = 0;

  if (weather.windSpeedMs >= 10) extra += 12;
  else if (weather.windSpeedMs >= 7) extra += 8;
  else if (weather.windSpeedMs >= 5) extra += 4;

  if ((weather.rainMm ?? 0) > 0.2) extra += 3;
  if ((weather.temperatureC ?? 15) < 10) extra += 3;

  return extra;
}

export function recommendTeeShot(params: {
  profile: PlayerProfile;
  hole: Hole;
  weather?: WeatherSnapshot;
}): Recommendation {
  const { profile, hole, weather } = params;
  const factors: string[] = [];

  const longest = getLongestClub(profile);

  if (!longest) {
    return {
      targetDistanceMeters: hole.meters,
      effectiveDistanceMeters: hole.meters,
      confidence: "low",
      shotShape: "straight",
      message: "Lägg in dina klubblängder för att få en tee-rekommendation.",
      factors: [],
    };
  }

  const preferredApproachMeters = hole.par === 5 ? 110 : hole.par === 3 ? 0 : 125;
  const maxUsefulTeeShot = hole.par === 3 ? hole.meters : Math.max(120, hole.meters - preferredApproachMeters);

  const defaultTeeClub = getLongestClubUnder(profile, maxUsefulTeeShot) ?? longest;
  const hazard = majorHazardsAhead(hole)[0];
  const windExtra = windCarryExtra(weather);

  if (
    hole.doglegDirection &&
    hole.doglegDirection !== "none" &&
    typeof hole.doglegCornerDistanceMeters === "number" &&
    defaultTeeClub.carryMeters > hole.doglegCornerDistanceMeters + 10
  ) {
    const safeDoglegClub = getLongestClubUnder(profile, hole.doglegCornerDistanceMeters - 10);

    if (safeDoglegClub) {
      factors.push(
        `Dogleg ${hole.doglegDirection}: håll dig före hörnet runt ${hole.doglegCornerDistanceMeters} m.`,
      );

      return {
        club: safeDoglegClub,
        targetDistanceMeters: safeDoglegClub.carryMeters,
        effectiveDistanceMeters: safeDoglegClub.carryMeters,
        confidence: "high",
        shotShape: "straight",
        message: `Tee: välj ${safeDoglegClub.name}. Planen är att stanna före doglegen, cirka ${safeDoglegClub.carryMeters} m från tee.`,
        factors,
      };
    }
  }

  if (hazard) {
    const start = hazardStart(hazard);
    const end = hazardEnd(hazard);

    if (typeof start === "number" && typeof end === "number") {
      const safeLayupMax = Math.max(120, start - 12);
      const safeClub = getLongestClubUnder(profile, safeLayupMax);
      const carryToClear = end + 8 + windExtra;
      const overClub = getShortestClubOver(profile, carryToClear);
      const defaultLandingInHazard =
        defaultTeeClub.carryMeters >= start - 8 && defaultTeeClub.carryMeters <= end + 8;

      if (defaultLandingInHazard && safeClub) {
        factors.push(`${start} m till ${hazard.label}.`);
        factors.push(`Lägg upp före hindret: cirka ${safeClub.carryMeters} m från tee.`);

        if (overClub) {
          factors.push(
            `Om du går över behövs cirka ${carryToClear} m carry idag${windExtra > 0 ? " med vädret inräknat" : ""}.`,
          );
          factors.push(`Det motsvarar minst ${overClub.name}.`);
        } else {
          factors.push(`För att gå över behövs cirka ${carryToClear} m carry idag.`);
        }

        return {
          club: safeClub,
          targetDistanceMeters: safeClub.carryMeters,
          effectiveDistanceMeters: safeClub.carryMeters,
          confidence: overClub ? "high" : "medium",
          shotShape: "layup",
          message: overClub
            ? `Tee: ${start} m till ${hazard.label}. Rekommendation: lägg upp med ${safeClub.name} till cirka ${safeClub.carryMeters} m. Alternativt kan du gå över, men då krävs ungefär ${carryToClear} m carry idag.`
            : `Tee: ${start} m till ${hazard.label}. Rekommendation: lägg upp med ${safeClub.name} till cirka ${safeClub.carryMeters} m.`,
          factors,
        };
      }
    }
  }

  const remaining = Math.max(0, hole.meters - defaultTeeClub.carryMeters);

  if (profile.dominantMiss === "right") {
    factors.push("Din vanliga miss är höger, så sikta hellre vänster fairwayhalva.");
  } else if (profile.dominantMiss === "left") {
    factors.push("Din vanliga miss är vänster, så sikta hellre höger fairwayhalva.");
  }

  return {
    club: defaultTeeClub,
    targetDistanceMeters: defaultTeeClub.carryMeters,
    effectiveDistanceMeters: defaultTeeClub.carryMeters,
    confidence: "medium",
    shotShape: "straight",
    message:
      `Tee: välj ${defaultTeeClub.name}. Planen är cirka ${Math.round(defaultTeeClub.carryMeters)} m från tee. ` +
      `Då har du ungefär ${Math.round(remaining)} m kvar.`,
    factors,
  };
}