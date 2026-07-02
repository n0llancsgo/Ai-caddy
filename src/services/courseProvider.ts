import { Course, GeoPoint } from "../domain/types";
import { distanceMeters } from "../domain/distance";
import { sampleCourses } from "../data/sampleCourse";

export interface CourseProvider {
  findNearby(position: GeoPoint): Promise<Course[]>;
  getCourse(id: string): Promise<Course | undefined>;
}

export class LocalCourseProvider implements CourseProvider {
  constructor(private courses: Course[] = sampleCourses) {}

  async findNearby(position: GeoPoint): Promise<Course[]> {
    return [...this.courses]
      .map((course) => ({ course, distance: distanceMeters(position, course.location) }))
      .sort((a, b) => a.distance - b.distance)
      .map((item) => item.course);
  }

  async getCourse(id: string): Promise<Course | undefined> {
    return this.courses.find((course) => course.id === id);
  }
}

export class GolfCourseApiProvider implements CourseProvider {
  constructor(private apiKey: string) {}

  async findNearby(position: GeoPoint): Promise<Course[]> {
    // TODO: Wire this to your chosen paid/free course API.
    // Keep the return type identical so the rest of the app never cares
    // whether data came from local JSON, OpenStreetMap, GolfCourseAPI or Supabase.
    console.log("GolfCourseApiProvider placeholder", this.apiKey, position);
    return [];
  }

  async getCourse(id: string): Promise<Course | undefined> {
    console.log("GolfCourseApiProvider placeholder", this.apiKey, id);
    return undefined;
  }
}
