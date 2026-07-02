import { Club, Hole, PlayerProfile, Recommendation } from "./types";

function getLongestClub(profile: PlayerProfile): Club | undefined {
  return [...profile.clubs]
    .filter((club) => club.carryMeters > 0)
    .sort((a, b) => b.carryMeters - a.carryMeters)[0];
}

function findClubByMaxCarry(profile: PlayerProfile, maxCarry: number): Club | undefined {
  return [...profile.clubs]
    .filter((club) => club.carryMeters > 0 && club.carryMeters <= maxCarry)
    .sort((a, b) => b.carryMeters - a.carryMeters)[0];
}

function hazardNearLanding(hole: Hole, carryMeters: number): string | undefined {
  const hazard = hole.hazards?.find((h) => {
    if (!h.distanceFromTeeMeters) return false;
    return Math.abs(h.distanceFromTeeMeters - carryMeters) <= 15;
  });

  return hazard?.label;
}

export function recommendTeeShot(params: {
  profile: PlayerProfile;
  hole: Hole;
}): Recommendation {
  const { profile, hole } = params;

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

  const preferredApproachMeters = hole.par === 5 ? 120 : 130;
  const maxUsefulTeeShot = Math.max(120, hole.meters - preferredApproachMeters);

  let plannedCarry = Math.min(longest.carryMeters, maxUsefulTeeShot);

  const danger = hazardNearLanding(hole, plannedCarry);

  let chosenClub = longest;
  const factors: string[] = [];

  if (danger) {
    const saferCarry = Math.max(120, plannedCarry - 25);
    const saferClub = findClubByMaxCarry(profile, saferCarry);

    if (saferClub) {
      chosenClub = saferClub;
      plannedCarry = saferClub.carryMeters;
      factors.push(`Undvik ${danger} runt ${Math.round(longest.carryMeters)} meter.`);
    }
  }

  const remaining = Math.max(0, hole.meters - chosenClub.carryMeters);

  let shotShape: Recommendation["shotShape"] = "straight";

  if (profile.dominantMiss === "right") {
    shotShape = "draw";
    factors.push("Din vanliga miss är höger, så sikta hellre vänster fairwayhalva.");
  }

  if (profile.dominantMiss === "left") {
    shotShape = "fade";
    factors.push("Din vanliga miss är vänster, så sikta hellre höger fairwayhalva.");
  }

  const message =
    `Tee: välj ${chosenClub.name}. Planen är cirka ${Math.round(chosenClub.carryMeters)} meter från tee. ` +
    `Då har du ungefär ${Math.round(remaining)} meter kvar. Slagtyp: ${shotShape}.`;

  return {
    club: chosenClub,
    targetDistanceMeters: chosenClub.carryMeters,
    effectiveDistanceMeters: chosenClub.carryMeters,
    confidence: danger ? "medium" : "high",
    shotShape,
    message,
    factors,
  };
}
