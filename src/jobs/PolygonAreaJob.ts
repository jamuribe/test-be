import { Job } from "./Job";
import { Task } from "../models/Task";
import area from "@turf/area";

export class PolygonAreaJob implements Job {
  async run(task: Task): Promise<any> {
    const geoJson = task.geoJson;

    if (!geoJson) {
      throw new Error("Invalid or missing GeoJSON data for area calculation.");
    }

    const parsedGeoJson =
      typeof geoJson === "string" ? JSON.parse(geoJson) : geoJson;

    // Because the Earth is a curved sphere and map coordinates are flat,
    // calculating the true area of a geographic polygon requires complex spherical geometry.
    // Turf handles this for us.
    const areaInSquareMeters = area(parsedGeoJson);

    // Return the area in square meters along with the unit for the result.
    // So that the parent Task Runner can save this result to a database or send it back to a user.
    return {
      areaInSquareMeters: areaInSquareMeters,
      unit: "square meters",
    };
  }
}
