import { PlayerProfile } from "../domain/types";

export const defaultProfile: PlayerProfile = {
  id: "local-player",
  name: "Spelare",
  dominantMiss: "right",
  clubs: [
    { id: "driver", name: "Driver", carryMeters: 215, totalMeters: 235 },
    { id: "3h", name: "3H", carryMeters: 190, totalMeters: 210 },
    { id: "5i", name: "5i", carryMeters: 170, totalMeters: 185 },
    { id: "6i", name: "6i", carryMeters: 160, totalMeters: 170 },
    { id: "7i", name: "7i", carryMeters: 150, totalMeters: 160 },
    { id: "8i", name: "8i", carryMeters: 140, totalMeters: 145 },
    { id: "9i", name: "9i", carryMeters: 125, totalMeters: 130 },
    { id: "pw", name: "PW", carryMeters: 110, totalMeters: 115 },
    { id: "52", name: "52", carryMeters: 100, totalMeters: 100 },
    { id: "56", name: "56", carryMeters: 85, totalMeters: 85 },
  ]
};
