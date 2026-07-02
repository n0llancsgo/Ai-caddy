import { Hole, PlayerProfile, ShotShape } from "./types";

function shapeForMiss(profile: PlayerProfile): ShotShape {
  if (profile.dominantMiss === "right") return "draw";
  if (profile.dominantMiss === "left") return "fade";
  return "straight";
}

export function teeSummary(hole: Hole, profile: PlayerProfile): string {
  const hazards = (hole.hazards ?? [])
    .slice(0, 3)
    .map((h) => `${h.label}${h.distanceFromTeeMeters ? ` vid ${h.distanceFromTeeMeters} m` : ""}`)
    .join(", ");

  const shape = hole.meters > 360 ? "layup" : shapeForMiss(profile);
  const preferredMiss = hole.preferredMiss ?? "center";
  const hazardText = hazards.length > 0 ? ` Risk: ${hazards}.` : "";

  return `Hal ${hole.number}, par ${hole.par}, ${hole.meters} m.${hazardText} Saker miss: ${preferredMiss}. Rekommenderad startplan: ${shape}.`;
}
