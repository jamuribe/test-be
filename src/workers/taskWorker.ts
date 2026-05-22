// src/workers/taskWorker.ts
import { AppDataSource } from '../data-source';
import { Task } from '../models/Task';
import { TaskRunner, TaskStatus } from './taskRunner';
import { LessThan, Not } from 'typeorm';

export async function taskWorker() {
  const taskRepository = AppDataSource.getRepository(Task);
  const taskRunner = new TaskRunner(taskRepository);

  while (true) {
    // Fetch the queued task with the lowest step number first,
    // making sure to load both 'workflow' and 'dependsOn' relations.
    const task = await taskRepository.findOne({
      where: { status: TaskStatus.Queued },
      order: { stepNumber: 'ASC' },
      relations: ['workflow', 'dependsOn'],
    });

    if (task) {
      try {
        // Rule Check A: Explicit Dependency Relation
        // If this task points to a specific parent task it depends on,
        // verify that the parent task is completely finished.
        if (task.dependsOn) {
          const parentTask = await taskRepository.findOne({
            where: { taskId: task.dependsOn.taskId },
          });

          if (!parentTask || parentTask.status !== TaskStatus.Completed) {
            // Parent isn't done yet. Back off, wait, and skip this iteration.
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
          }
        }

        // Rule Check B: Generic Sequential Step Checking
        // Ensure there are absolutely no lower step numbers in this workflow
        // that are currently running, queued, or failed.
        const precedingUnfinishedTask = await taskRepository.findOne({
          where: {
            workflow: { workflowId: task.workflow.workflowId },
            stepNumber: LessThan(task.stepNumber),
            status: Not(TaskStatus.Completed),
          },
        });

        if (precedingUnfinishedTask) {
          // Preceding workflow items are still processing. Back off and wait.
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }

        // Verification Guard Rails Cleared: Execute the job safely!
        await taskRunner.run(task);
      } catch (error) {
        console.error(
          'Task execution failed. Task status has already been updated by TaskRunner.',
        );
        console.error(error);
      }
    }

    // Wait 5 seconds before pulling the queue for the next available task
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
