import * as Location from "expo-location";
import { Course, GeoPoint } from "../domain/types";
import { distanceMeters } from "../domain/distance";

export async function getCurrentPosition(): Promise<GeoPoint | undefined> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return undefined;

  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
  };
}

export function findNearestCourse(position: GeoPoint, courses: Course[], maxDistanceMeters = 5000): Course | undefined {
  const sorted = courses
    .map((course) => ({ course, distance: distanceMeters(position, course.location) }))
    .sort((a, b) => a.distance - b.distance);

  const best = sorted[0];
  return best && best.distance <= maxDistanceMeters ? best.course : undefined;
}
