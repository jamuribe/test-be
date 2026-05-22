import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { DataSource } from 'typeorm';
import { Workflow } from '../models/Workflow';
import { Task } from '../models/Task';
import { TaskStatus } from '../workers/taskRunner';

export enum WorkflowStatus {
  Initial = 'initial',
  InProgress = 'in_progress',
  Completed = 'completed',
  Failed = 'failed',
}

interface WorkflowStep {
  taskType: string;
  stepNumber: number;
  dependsOnStep?: number; // Allow optional step dependency in interface
}

interface WorkflowDefinition {
  name: string;
  steps: WorkflowStep[];
}

export class WorkflowFactory {
  constructor(private dataSource: DataSource) {}

  /**
   * Creates a workflow by reading a YAML file and constructing the Workflow and Task entities.
   * @param filePath - Path to the YAML file.
   * @param clientId - Client identifier for the workflow.
   * @param geoJson - The geoJson data string for tasks (customize as needed).
   * @returns A promise that resolves to the created Workflow.
   */
  async createWorkflowFromYAML(
    filePath: string,
    clientId: string,
    geoJson: string,
  ): Promise<Workflow> {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const workflowDef = yaml.load(fileContent) as WorkflowDefinition;
    const workflowRepository = this.dataSource.getRepository(Workflow);
    const taskRepository = this.dataSource.getRepository(Task);

    const workflow = new Workflow();
    workflow.clientId = clientId;
    workflow.status = WorkflowStatus.Initial;

    const savedWorkflow = await workflowRepository.save(workflow);

    // Keep a temporary map tracking: stepNumber -> Saved Task Entity
    const stepToTaskMap = new Map<number, Task>();
    const createdTasks: Task[] = [];

    // Process sequentially so we can map relationships accurately
    for (const step of workflowDef.steps) {
      const task = new Task();
      task.clientId = clientId;
      task.geoJson = geoJson;
      task.status = TaskStatus.Queued;
      task.taskType = step.taskType;
      task.stepNumber = step.stepNumber;
      task.workflow = savedWorkflow;

      // If this step specifies a dependency, fetch it from our map and link it
      if (step.dependsOnStep) {
        const parentTask = stepToTaskMap.get(step.dependsOnStep);

        if (parentTask) {
          task.dependsOn = parentTask;
        } else {
          throw new Error(
            `Step configuration error: Step ${step.stepNumber} depends on step ${step.dependsOnStep}, which hasn't been defined yet.`,
          );
        }
      }

      // Save individually so we obtain an absolute database UUID primary key for relationships
      const savedTask = await taskRepository.save(task);
      stepToTaskMap.set(step.stepNumber, savedTask);
      createdTasks.push(savedTask);
    }

    return savedWorkflow;
  }
}
