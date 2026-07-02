import { recommendClub } from "./clubRecommendation";
import {
  Hazard,
  Hole,
  Lie,
  PlayerProfile,
  ShotPlanOption,
  ShotPlanResult,
  WeatherSnapshot,
} from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getCurrentDistanceFromTee(hole: Hole, distanceToGreenMeters: number): number {
  return Math.max(0, hole.meters - distanceToGreenMeters);
}

function getHazardRange(hazard: Hazard): { start: number; end: number } | undefined {
  if (
    typeof hazard.startDistanceMeters === "number" &&
    typeof hazard.endDistanceMeters === "number"
  ) {
    return {
      start: Math.min(hazard.startDistanceMeters, hazard.endDistanceMeters),
      end: Math.max(hazard.startDistanceMeters, hazard.endDistanceMeters),
    };
  }

  if (typeof hazard.distanceFromTeeMeters === "number") {
    return {
      start: hazard.distanceFromTeeMeters - 6,
      end: hazard.distanceFromTeeMeters + 6,
    };
  }

  return undefined;
}

function hazardRiskValue(hazard: Hazard): number {
  const base = (() => {
    switch (hazard.type) {
      case "water":
      case "out":
        return 3;
      case "bunker":
        return 2;
      case "trees":
      case "rough":
        return 1;
      case "other":
      default:
        return 1;
    }
  })();

  const severityBoost = hazard.severity === "high" ? 1 : hazard.severity === "low" ? -1 : 0;
  return clamp(base + severityBoost, 1, 4);
}

function hazardsNearDistance(hole: Hole, landingDistanceFromTee: number, bufferMeters = 16): Hazard[] {
  return (hole.hazards ?? []).filter((hazard) => {
    const range = getHazardRange(hazard);
    if (!range) return false;
    return range.start <= landingDistanceFromTee + bufferMeters && range.end >= landingDistanceFromTee - bufferMeters;
  });
}

function looksLikeGreenComplexHazard(hole: Hole, hazard: Hazard): boolean {
  const label = hazard.label.toLowerCase();
  if (
    label.includes("green") ||
    label.includes("framför") ||
    label.includes("bakom") ||
    label.includes("kort")
  ) {
    return true;
  }

  const range = getHazardRange(hazard);
  if (!range) return false;

  const greenWindow = hole.greenSize === "small" ? 30 : hole.greenSize === "large" ? 50 : 40;
  return range.start <= hole.meters + 12 && range.end >= hole.meters - greenWindow;
}

function greenHazards(hole: Hole): Hazard[] {
  return (hole.hazards ?? []).filter((hazard) => looksLikeGreenComplexHazard(hole, hazard));
}

function sidePenalty(profile: PlayerProfile, hazards: Hazard[]): number {
  return hazards.reduce((sum, hazard) => {
    if (profile.dominantMiss === "right" && hazard.side === "right") return sum + 1;
    if (profile.dominantMiss === "left" && hazard.side === "left") return sum + 1;
    if (profile.dominantMiss === "short" && hazard.side === "center") return sum + 1;
    return sum;
  }, 0);
}

function baseLieRisk(lie: Lie): number {
  switch (lie) {
    case "recovery":
      return 3;
    case "sand":
      return 2;
    case "rough":
      return 1;
    case "green":
    case "tee":
    case "fairway":
    default:
      return 0;
  }
}

function windRisk(weather?: WeatherSnapshot): number {
  if (!weather?.windSpeedMs) return 0;
  if (weather.windSpeedMs >= 10) return 2;
  if (weather.windSpeedMs >= 6) return 1;
  return 0;
}

function preferredLayupDistances(profile: PlayerProfile): number[] {
  const wedgeDistances = profile.clubs
    .map((club) => Math.round(club.carryMeters))
    .filter((meters) => meters >= 75 && meters <= 125);

  const combined = [...wedgeDistances, 85, 95, 105, 115];
  return [...new Set(combined)].sort((a, b) => a - b);
}

function pickRecommendedOption(options: ShotPlanOption[], lie: Lie, distanceToGreenMeters: number): ShotPlanOption {
  const go = options.find((option) => option.kind === "go_for_green");
  const layup = options.find((option) => option.kind === "layup");
  const safe = options.find((option) => option.kind === "safe_advance");

  if (lie === "recovery" && safe) return safe;
  if (distanceToGreenMeters <= 120 && go) return go;
  if (layup && go && layup.riskScore + 1 < go.riskScore) return layup;
  if (safe && go && safe.riskScore + 2 < go.riskScore) return safe;
  if (go) return go;
  if (layup) return layup;
  return safe ?? options[0];
}

export function planShot(params: {
  profile: PlayerProfile;
  hole: Hole;
  lie: Lie;
  distanceToGreenMeters: number;
  weather?: WeatherSnapshot;
}): ShotPlanResult {
  const { profile, hole, lie, distanceToGreenMeters, weather } = params;

  const currentDistanceFromTee = getCurrentDistanceFromTee(hole, distanceToGreenMeters);
  const lieRisk = baseLieRisk(lie);
  const windRiskScore = windRisk(weather);
  const options: ShotPlanOption[] = [];

  const goRecommendation = recommendClub({
    profile,
    targetDistanceMeters: distanceToGreenMeters,
    lie,
    weather,
  });

  if (goRecommendation.club) {
    const greenComplexHazards = greenHazards(hole);
    let riskScore = 2 + lieRisk + windRiskScore;
    const explanation = [...goRecommendation.factors];

    if (distanceToGreenMeters > 170) {
      riskScore += 1;
      explanation.push("Lång attack mot green ökar spridningen.");
    }

    if (hole.greenSize === "small") {
      riskScore += 2;
      explanation.push("Liten green gör attacken mer krävande.");
    } else if (hole.greenSize === "medium") {
      riskScore += 1;
    }

    if (greenComplexHazards.length > 0) {
      riskScore += greenComplexHazards.reduce((sum, hazard) => sum + hazardRiskValue(hazard), 0);
      riskScore += sidePenalty(profile, greenComplexHazards);
      explanation.push(
        `Hinder nära green: ${greenComplexHazards.map((hazard) => hazard.label).join(", ")}.`,
      );
    }

    if ((weather?.rainMm ?? 0) > 0.2) {
      riskScore += 1;
      explanation.push("Regn/fukt gör bollträffen mindre förlåtande.");
    }

    const rewardScore = hole.par === 5 ? 8 : 7;

    options.push({
      kind: "go_for_green",
      label: "Gå för green",
      club: goRecommendation.club,
      clubName: goRecommendation.club.name,
      intent: "attack_green",
      targetDistanceMeters: goRecommendation.targetDistanceMeters,
      effectiveDistanceMeters: goRecommendation.effectiveDistanceMeters,
      expectedRemainingMeters: Math.max(0, distanceToGreenMeters - goRecommendation.club.carryMeters),
      riskScore: clamp(riskScore, 1, 10),
      rewardScore,
      recommended: false,
      explanation,
      message: `Gå för green med ${goRecommendation.club.name}. Spelar cirka ${goRecommendation.effectiveDistanceMeters} meter i nuvarande läge.`,
    });
  }

  const layupCandidates = preferredLayupDistances(profile)
    .filter((remainingMeters) => remainingMeters < distanceToGreenMeters - 35)
    .slice(0, 5);

  const layupOptions: ShotPlanOption[] = layupCandidates
    .flatMap((remainingMeters) => {
      const shotDistance = distanceToGreenMeters - remainingMeters;
      const layupRecommendation = recommendClub({
        profile,
        targetDistanceMeters: shotDistance,
        lie,
        weather,
      });

      if (!layupRecommendation.club) return [];

      const landingDistanceFromTee = currentDistanceFromTee + layupRecommendation.club.carryMeters;
      const landingHazards = hazardsNearDistance(hole, landingDistanceFromTee, 18);
      let riskScore = 1 + Math.max(0, lieRisk - 1) + Math.max(0, windRiskScore - 1);
      const explanation = [...layupRecommendation.factors];

      if (landingHazards.length > 0) {
        riskScore += landingHazards.reduce((sum, hazard) => sum + hazardRiskValue(hazard), 0);
        riskScore += sidePenalty(profile, landingHazards);
        explanation.push(
          `Tänk på landningsytan: ${landingHazards.map((hazard) => hazard.label).join(", ")}.`,
        );
      } else {
        explanation.push(`Du lämnar ungefär ${remainingMeters} meter kvar till nästa slag.`);
      }

      const rewardScore = remainingMeters >= 85 && remainingMeters <= 115 ? 7 : 5;

      return [{
        kind: "layup" as const,
        label: `Lägg upp till cirka ${remainingMeters} m`,
        club: layupRecommendation.club,
        clubName: layupRecommendation.club.name,
        intent: "layup" as const,
        targetDistanceMeters: layupRecommendation.targetDistanceMeters,
        effectiveDistanceMeters: layupRecommendation.effectiveDistanceMeters,
        expectedRemainingMeters: Math.max(0, distanceToGreenMeters - layupRecommendation.club.carryMeters),
        riskScore: clamp(riskScore, 1, 10),
        rewardScore,
        recommended: false,
        explanation,
        message: `Kontrollerad layup med ${layupRecommendation.club.name}. Målet är att lämna ungefär ${remainingMeters} meter kvar.`,
      }];
    })
    .sort((a, b) => {
      if (a.riskScore !== b.riskScore) return a.riskScore - b.riskScore;
      return Math.abs(a.expectedRemainingMeters - 100) - Math.abs(b.expectedRemainingMeters - 100);
    });

  if (layupOptions[0]) {
    options.push(layupOptions[0]);
  }

  if (lie === "recovery" || options.length < 2) {
    const safeAdvanceTarget = clamp(
      Math.round(distanceToGreenMeters * 0.65),
      45,
      Math.max(45, distanceToGreenMeters - 30),
    );

    if (safeAdvanceTarget < distanceToGreenMeters) {
      const safeRecommendation = recommendClub({
        profile,
        targetDistanceMeters: safeAdvanceTarget,
        lie,
        weather,
      });

      if (safeRecommendation.club) {
        const landingDistanceFromTee = currentDistanceFromTee + safeRecommendation.club.carryMeters;
        const landingHazards = hazardsNearDistance(hole, landingDistanceFromTee, 16);
        let riskScore = 1 + Math.max(0, lieRisk - 1);
        const explanation = [
          ...safeRecommendation.factors,
          "Spela tillbaka till ett enklare läge innan nästa attack.",
        ];

        if (landingHazards.length > 0) {
          riskScore += landingHazards.reduce((sum, hazard) => sum + hazardRiskValue(hazard), 0);
          explanation.push(
            `Även säker linje har hinder: ${landingHazards.map((hazard) => hazard.label).join(", ")}.`,
          );
        }

        options.push({
          kind: "safe_advance",
          label: "Spela säkert framåt",
          club: safeRecommendation.club,
          clubName: safeRecommendation.club.name,
          intent: lie === "recovery" ? "recovery" : "safe_advance",
          targetDistanceMeters: safeRecommendation.targetDistanceMeters,
          effectiveDistanceMeters: safeRecommendation.effectiveDistanceMeters,
          expectedRemainingMeters: Math.max(0, distanceToGreenMeters - safeRecommendation.club.carryMeters),
          riskScore: clamp(riskScore, 1, 10),
          rewardScore: 4,
          recommended: false,
          explanation,
          message: `Säker framflyttning med ${safeRecommendation.club.name}. Bra om läget är pressat eller om du vill undvika stort misstag.`,
        });
      }
    }
  }

  if (options.length === 0) {
    const fallback = recommendClub({
      profile,
      targetDistanceMeters: distanceToGreenMeters,
      lie,
      weather,
    });

    const fallbackOption: ShotPlanOption = {
      kind: "safe_advance",
      label: "Standardval",
      club: fallback.club,
      clubName: fallback.club?.name ?? "Manuell",
      intent: lie === "green" ? "putt" : "attack_green",
      targetDistanceMeters: fallback.targetDistanceMeters,
      effectiveDistanceMeters: fallback.effectiveDistanceMeters,
      expectedRemainingMeters: 0,
      riskScore: 5,
      rewardScore: 5,
      recommended: true,
      explanation: fallback.factors,
      message: fallback.message,
    };

    return {
      headline: `Plan för ${Math.round(distanceToGreenMeters)} meter`,
      summary: fallback.message,
      recommendedOption: fallbackOption,
      options: [fallbackOption],
    };
  }

  const recommendedOption = pickRecommendedOption(options, lie, distanceToGreenMeters);
  const markedOptions = options.map((option) => ({
    ...option,
    recommended: option.kind === recommendedOption.kind,
  }));

  const summary =
    recommendedOption.kind === "go_for_green"
      ? "Det här läget går att attackera, men modellen väger in längd, vind och hinder runt green."
      : recommendedOption.kind === "layup"
        ? "Läget talar för en kontrollerad layup snarare än en full attack mot green."
        : "Säkrast här är att spela fram bollen till ett bättre nästa läge först.";

  return {
    headline: `Plan för ${Math.round(distanceToGreenMeters)} meter kvar`,
    summary,
    recommendedOption: { ...recommendedOption, recommended: true },
    options: markedOptions,
  };
}