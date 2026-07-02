import * as Speech from "expo-speech";

export function speak(text: string): void {
  Speech.stop();

  Speech.speak(text, {
    language: "sv-SE",
    rate: 0.82,
    pitch: 0.95,
  });
}