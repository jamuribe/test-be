import { Repository } from "typeorm";
import { Task } from "../models/Task";
import { getJobForTaskType } from "../jobs/JobFactory";
import { WorkflowStatus } from "../workflows/WorkflowFactory";
import { Workflow } from "../models/Workflow";
import { Result } from "../models/Result";

export enum TaskStatus {
  Queued = "queued",
  InProgress = "in_progress",
  Completed = "completed",
  Failed = "failed",
}

export class TaskRunner {
  constructor(private taskRepository: Repository<Task>) {}

  /**
   * Runs the appropriate job based on the task's type, managing the task's status.
   * @param task - The task entity that determines which job to run.
   * @throws If the job fails, it rethrows the error.
   */
  async run(task: Task): Promise<void> {
    // Initial State Setup
    task.status = TaskStatus.InProgress;
    task.progress = "starting job...";
    await this.taskRepository.save(task);

    // Gets precise Job implementation based on the taskType string property of the Task entity
    const job = getJobForTaskType(task.taskType);

    try {
      console.log(`Starting job ${task.taskType} for task ${task.taskId}...`);
      const resultRepository =
        this.taskRepository.manager.getRepository(Result);

      // Execute the Job Concrete Implementation
      const taskResult = await job.run(task);
      console.log(
        `Job ${task.taskType} for task ${task.taskId} completed successfully.`,
      );

      // Persist the return payload string to the Results table
      const result = new Result();
      result.taskId = task.taskId!;
      result.data = JSON.stringify(taskResult || {});
      await resultRepository.save(result);

      // Update individual task properties to Completed
      task.resultId = result.resultId!;
      task.status = TaskStatus.Completed;
      task.progress = null;
      await this.taskRepository.save(task);
    } catch (error: any) {
      console.error(
        `Error running job ${task.taskType} for task ${task.taskId}:`,
        error,
      );

      task.status = TaskStatus.Failed;
      task.progress = null;
      await this.taskRepository.save(task);

      throw error; // Rethrow to notify worker loop ?
    }

    // Evaluate Overall Workflow Status and Manage Transitions
    const workflowRepository =
      this.taskRepository.manager.getRepository(Workflow);
    const currentWorkflow = await workflowRepository.findOne({
      where: { workflowId: task.workflow.workflowId },
      relations: ["tasks"],
    });

    if (currentWorkflow) {
      const allCompleted = currentWorkflow.tasks.every(
        (t) => t.status === TaskStatus.Completed,
      );
      const anyFailed = currentWorkflow.tasks.some(
        (t) => t.status === TaskStatus.Failed,
      );

      if (anyFailed) {
        currentWorkflow.status = WorkflowStatus.Failed;
      } else if (allCompleted) {
        currentWorkflow.status = WorkflowStatus.Completed;

        // ====== TASK 4 LOGIC ======
        // Check if this workflow contains a 'reportGeneration' step
        const reportTask = currentWorkflow.tasks.find(
          (t) => t.taskType === "reportGeneration",
        );

        if (reportTask && reportTask.resultId) {
          const resultRepository =
            this.taskRepository.manager.getRepository(Result);
          const finalResultEntity = await resultRepository.findOne({
            where: { resultId: reportTask.resultId },
          });

          if (finalResultEntity) {
            // Extract the raw data payload text and bind it to the workflow's new result property
            currentWorkflow.result = finalResultEntity.data;
            console.log(
              `[Task 4] Saved aggregated summary directly into Workflow Entity table: ${currentWorkflow.workflowId}`,
            );
          }
        }
        // ============================================================================
      } else {
        currentWorkflow.status = WorkflowStatus.InProgress;
      }

      // Commit final lifecycle transition to database
      await workflowRepository.save(currentWorkflow);
    }
  }
}
