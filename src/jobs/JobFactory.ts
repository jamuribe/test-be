import { Job } from "./Job";
import { DataAnalysisJob } from "./DataAnalysisJob";
import { EmailNotificationJob } from "./EmailNotificationJob";

// Import the new jobs
import { PolygonAreaJob } from "./PolygonAreaJob";
import { ReportGenerationJob } from "./ReportGenerationJob";

const jobMap: Record<string, () => Job> = {
  analysis: () => new DataAnalysisJob(),
  notification: () => new EmailNotificationJob(),
  // Add the new job mappings here
  polygonArea: () => new PolygonAreaJob(),
  reportGeneration: () => new ReportGenerationJob(),
};

export function getJobForTaskType(taskType: string): Job {
  const jobFactory = jobMap[taskType];
  if (!jobFactory) {
    throw new Error(`No job found for task type: ${taskType}`);
  }
  return jobFactory();
}
