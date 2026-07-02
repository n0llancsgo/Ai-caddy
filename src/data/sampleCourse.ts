import { Course } from "../domain/types";

export const sampleCourses: Course[] = [
  {
    id: "min-hemmabana",
    name: "Min Hemmabana",
    location: {
      latitude: 59.3293,
      longitude: 18.0686,
    },
    loops: ["18-hål"],
    holes: [
      {
        number: 1,
        par: 4,
        meters: 356,
        preferredMiss: "left",
        hazards: [
          {
            id: "h1-b1",
            type: "bunker",
            label: "Bunker höger",
            distanceFromTeeMeters: 210,
            side: "right",
          },
        ],
        notes: "Börja säkert. Undvik höger.",
      },
      {
        number: 2,
        par: 3,
        meters: 148,
        preferredMiss: "short",
        hazards: [
          {
            id: "h2-b1",
            type: "bunker",
            label: "Greenbunker höger",
            distanceFromTeeMeters: 135,
            side: "right",
          },
          {
            id: "h2-b2",
            type: "water",
            label: "Vatten kort vänster",
            distanceFromTeeMeters: 120,
            side: "left",
          },
          {
            id: "h2-b3",
            type: "bunker",
            label: "Bunker bakom green",
            distanceFromTeeMeters: 155,
            side: "center",
          },
        ],
        notes: "Hellre kort än lång.",
      },
      {
        number: 3,
        par: 5,
        meters: 486,
        preferredMiss: "right",
        hazards: [
          {
            id: "h3-trees",
            type: "trees",
            label: "Träd vänster",
            distanceFromTeeMeters: 220,
            side: "left",
          },
          {
            id: "h3-water",
            type: "water",
            label: "Vatten framför green",
            distanceFromTeeMeters: 420,
            side: "center",
          },
        ],
        notes: "Bra layup-hål. Undvik vänster från tee.",
      },
    ],
  },
];