import { WeatherSnapshot } from "../domain/types";

export async function fetchOpenMeteoWeather(latitude: number, longitude: number): Promise<WeatherSnapshot | undefined> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,wind_speed_10m,wind_direction_10m,rain",
    timezone: "auto",
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Open-Meteo failed: ${response.status}`);
  }

  const json = await response.json();
  return {
    temperatureC: json.current?.temperature_2m,
    windSpeedMs: json.current?.wind_speed_10m,
    windDirectionDeg: json.current?.wind_direction_10m,
    rainMm: json.current?.rain,
    fetchedAtIso: new Date().toISOString(),
  };
}
