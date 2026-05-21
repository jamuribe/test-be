// src/jobs/PolygonAreaJob.ts
import { Job } from "./Job";
import { Task } from "../models/Task";
import area from "@turf/area";

export class PolygonAreaJob implements Job {
  async run(task: Task): Promise<any> {
    // Extract the geoJson from the task.
    // (Verify if your codebase stores this as task.geoJson or task.payload)
    const geoJson = task.geoJson;

    if (!geoJson) {
      throw new Error("Invalid or missing GeoJSON data for area calculation.");
    }

    // Calculate the area using turf
    const areaInSquareMeters = area(geoJson);

    // Return the result object. Your TaskRunner will automatically
    // capture this return value and save it to task.output.
    return {
      areaInSquareMeters: areaInSquareMeters,
      unit: "square meters",
    };
  }
}
