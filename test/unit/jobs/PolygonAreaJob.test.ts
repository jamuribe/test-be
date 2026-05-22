import { beforeEach, describe, expect, it } from '@jest/globals';
import { PolygonAreaJob } from '../../../src/jobs/PolygonAreaJob';
import { Task } from '../../../src/models/Task';

// Mock a simple GeoJSON Feature (a 100m x 100m square polygon near the equator)
const mockSquareGeoJson = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [0, 0.0009043717],
        [0.0009043717, 0.0009043717],
        [0.0009043717, 0],
        [0, 0],
      ],
    ],
  },
};

describe('PolygonAreaJob', () => {
  let job: PolygonAreaJob;

  beforeEach(() => {
    job = new PolygonAreaJob();
  });

  it('should successfully calculate area when geoJson is a valid parsed object', async () => {
    // 1. Arrange: Create a mock Task where geoJson is already an object
    const mockTask = {
      geoJson: mockSquareGeoJson,
    } as unknown as Task;

    // 2. Act: Run the job
    const result = await job.run(mockTask);

    // 3. Assert: Verify the calculations and structure
    expect(result).toHaveProperty('areaInSquareMeters');
    expect(result.unit).toBe('square meters');
    // Turf's precise ellipsoidal calculation for this box is ~10,112.65 sqm
    expect(result.areaInSquareMeters).toBeCloseTo(10112.65, 1);
  });

  it('should successfully calculate area when geoJson is a raw JSON string', async () => {
    // 1. Arrange: Create a mock Task where geoJson is a stringified JSON
    const mockTask = {
      geoJson: JSON.stringify(mockSquareGeoJson),
    } as unknown as Task;

    // 2. Act: Run the job
    const result = await job.run(mockTask);

    // 3. Assert: It should parse it on the fly and calculate the same area
    expect(result.unit).toBe('square meters');
    expect(result.areaInSquareMeters).toBeCloseTo(10112.65, 1);
  });

  it('should throw an error if geoJson property is missing or null', async () => {
    // 1. Arrange: Task with missing data
    const mockTask = {
      geoJson: null,
    } as unknown as Task;

    // 2. Act & Assert: Verify it rejects gracefully with your custom error message
    await expect(job.run(mockTask)).rejects.toThrow(
      'Invalid or missing GeoJSON data for area calculation.',
    );
  });
});
