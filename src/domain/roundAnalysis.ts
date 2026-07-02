import { RoundShot } from "./types";

export type RoundAnalysis = {
  totalShots: number;
  fairways: number;
  greens: number;
  putts: number;
  penalties: number;
  missesRight: number;
  missesLeft: number;
  missesShort: number;
  missesLong: number;
  mainFinding: string;
};

export function analyzeRound(shots: RoundShot[]): RoundAnalysis {
  const totalShots = shots.length;
  const fairways = shots.filter((shot) => shot.outcome === "fairway").length;
  const greens = shots.filter((shot) => shot.outcome === "green").length;
  const putts = shots.filter((shot) => shot.outcome === "putt" || shot.lie === "green").length;
  const penalties = shots.filter((shot) => shot.outcome === "penalty").length;
  const missesRight = shots.filter((shot) => shot.outcome === "right").length;
  const missesLeft = shots.filter((shot) => shot.outcome === "left").length;
  const missesShort = shots.filter((shot) => shot.outcome === "short").length;
  const missesLong = shots.filter((shot) => shot.outcome === "long").length;

  const findings = [
    { label: "missar hoger", value: missesRight },
    { label: "missar vanster", value: missesLeft },
    { label: "for kort", value: missesShort },
    { label: "for langt", value: missesLong },
    { label: "penalties", value: penalties },
    { label: "puttar", value: putts },
  ].sort((a, b) => b.value - a.value);

  const main = findings[0];
  const mainFinding = totalShots === 0
    ? "Logga nagra slag for analys."
    : main.value === 0
      ? "Inga tydliga missmonster annu."
      : `Storsta monster just nu: ${main.label} (${main.value}).`;

  return {
    totalShots,
    fairways,
    greens,
    putts,
    penalties,
    missesRight,
    missesLeft,
    missesShort,
    missesLong,
    mainFinding,
  };
}
