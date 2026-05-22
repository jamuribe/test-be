import { WorkflowFactory } from '../../../src/workflows/WorkflowFactory';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { DataSource, Repository } from 'typeorm';
import { Workflow, WorkflowStatus } from '../../../src/models/Workflow';
import { Task } from '../../../src/models/Task';
import * as fs from 'fs';

// Mock the fs module so we don't need a real example_workflow.yml on disk
jest.mock('fs');

describe('WorkflowFactory', () => {
  let factory: WorkflowFactory;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockWorkflowRepo: jest.Mocked<Repository<Workflow>>;
  let mockTaskRepo: jest.Mocked<Repository<Task>>;

  // Sample YAML content to be injected by our fs mock
  const mockYamlContent = `
name: "test_workflow"
steps:
  - taskType: "polygonArea"
    stepNumber: 1
  - taskType: "analysis"
    stepNumber: 2
    dependsOnStep: 1
  `;

  beforeEach(() => {
    // 1. Create mocked repositories with explicit types for function parameters
    mockWorkflowRepo = {
      save: jest.fn().mockImplementation((workflow) => {
        const typedWorkflow = workflow as Workflow;
        // Simulate database assigning an ID on save
        return Promise.resolve({
          ...typedWorkflow,
          workflowId: 'mock-workflow-uuid',
        });
      }),
    } as unknown as jest.Mocked<Repository<Workflow>>;

    mockTaskRepo = {
      save: jest.fn().mockImplementation((task) => {
        const typedTask = task as Task;
        // Simulate database assigning unique sequential IDs to tasks on save
        const mockTaskId = `mock-task-uuid-${typedTask.stepNumber}`;
        return Promise.resolve({ ...typedTask, taskId: mockTaskId });
      }),
    } as unknown as jest.Mocked<Repository<Task>>;

    // 2. Create a mocked DataSource that resolves the repositories correctly
    mockDataSource = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === Workflow) return mockWorkflowRepo;
        if (entity === Task) return mockTaskRepo;
        return null;
      }),
    } as unknown as jest.Mocked<DataSource>;

    factory = new WorkflowFactory(mockDataSource);
    jest.clearAllMocks();
  });

  it('should parse YAML, create a workflow, and map sequential task dependencies correctly', async () => {
    // Arrange: Force fs.readFileSync to return our fake YAML string
    (fs.readFileSync as jest.Mock).mockReturnValue(mockYamlContent);

    const clientId = 'client-123';
    const geoJson = '{"type": "Feature"}';

    // Act: Build the workflow from the fake file path
    const result = await factory.createWorkflowFromYAML(
      'fake/path.yml',
      clientId,
      geoJson,
    );

    // Assert 1: The parent Workflow entity was created properly
    expect(mockWorkflowRepo.save).toHaveBeenCalledTimes(1);
    expect(result.clientId).toBe(clientId);
    expect(result.status).toBe(WorkflowStatus.Initial);
    expect(result.workflowId).toBe('mock-workflow-uuid');

    // Assert 2: Both tasks from the YAML steps array were saved individually
    expect(mockTaskRepo.save).toHaveBeenCalledTimes(2);

    // Assert 3: Inspect individual task saving arguments to verify dependency linking
    const firstTaskSaved = mockTaskRepo.save.mock.calls[0][0];
    const secondTaskSaved = mockTaskRepo.save.mock.calls[1][0];

    // Verify Step 1 properties
    expect(firstTaskSaved.stepNumber).toBe(1);
    expect(firstTaskSaved.taskType).toBe('polygonArea');
    expect(firstTaskSaved.dependsOn).toBeUndefined(); // Step 1 has no parent

    // Verify Step 2 properties and dependency link mapping
    expect(secondTaskSaved.stepNumber).toBe(2);
    expect(secondTaskSaved.taskType).toBe('analysis');

    // This is the core logic check! Step 2 must point directly to the saved Step 1 object
    expect(secondTaskSaved.dependsOn).toBeDefined();
    expect(secondTaskSaved.dependsOn?.stepNumber).toBe(1);
    expect(secondTaskSaved.dependsOn?.taskId).toBe('mock-task-uuid-1');
  });

  it('should throw a configuration error if a step depends on an undefined step', async () => {
    // Arrange: Bad configuration where step 1 depends on step 99 (which hasn't happened yet)
    const brokenYaml = `
name: "broken_workflow"
steps:
  - taskType: "polygonArea"
    stepNumber: 1
    dependsOnStep: 99
    `;
    (fs.readFileSync as jest.Mock).mockReturnValue(brokenYaml);

    // Act & Assert: Factory should halt and throw your custom error
    await expect(
      factory.createWorkflowFromYAML('fake/path.yml', 'client-123', '{}'),
    ).rejects.toThrow(
      "Step configuration error: Step 1 depends on step 99, which hasn't been defined yet.",
    );
  });
});
