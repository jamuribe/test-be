import { Job } from "./Job";
import { Task } from "../models/Task";
import { Result } from "../models/Result";
import { AppDataSource } from "../data-source";

export class ReportGenerationJob implements Job {
  async run(task: Task): Promise<any> {
    const taskRepository = AppDataSource.getRepository(Task);
    const resultRepository = AppDataSource.getRepository(Result);

    if (!task.workflow || !task.workflow.workflowId) {
      throw new Error("Task does not have an associated workflow relation.");
    }
    const workflowId = task.workflow.workflowId;

    // Fetch all sibling tasks belonging to this workflow
    const allTasks = await taskRepository.find({
      where: { workflow: { workflowId: workflowId } },
    });

    // Prepare an array to hold the report data for each sibling task
    const reportTasksArray = [];

    // Loop through sibling tasks and pluck their data from the Result entity table
    for (const siblingTask of allTasks) {
      if (siblingTask.taskId === task.taskId) {
        continue; // Skip the report task itself
      }

      // Default message if no output data is found for this sibling task
      let outputData = "No output data available";

      if (siblingTask.resultId) {
        const resultEntity = await resultRepository.findOne({
          where: { resultId: siblingTask.resultId },
        });
        if (resultEntity && resultEntity.data) {
          try {
            outputData = JSON.parse(resultEntity.data);
          } catch {
            outputData = resultEntity.data;
          }
        }
      }

      reportTasksArray.push({
        taskId: siblingTask.taskId,
        type: siblingTask.taskType,
        output: outputData,
      });
    }

    // Construct the exact JSON report schema requested
    const finalReport = {
      workflowId: workflowId,
      tasks: reportTasksArray,
      finalReport: "Aggregated data and results",
    };

    // Print to your running server console explicitly for direct visibility!
    console.log("================ GENERATED REPORT CONTENT ================");
    console.log(JSON.stringify(finalReport, null, 2));
    console.log("==========================================================");

    return finalReport;
  }
}
