import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { taskWorker } from '../../../src/workers/taskWorker';
import { AppDataSource } from '../../../src/data-source';
import { TaskRunner, TaskStatus } from '../../../src/workers/taskRunner';
import { LessThan, Not } from 'typeorm';

// Mock the AppDataSource and the TaskRunner engine
jest.mock('../../../src/data-source');
jest.mock('../../../src/workers/taskRunner');

describe('taskWorker Loop', () => {
  let mockTaskRepository: any;
  let mockTaskRunnerInstance: jest.Mocked<TaskRunner>;

  beforeEach(() => {
    jest.useFakeTimers(); // Intercept setTimeout globally

    // 1. Create a mock repository layer
    mockTaskRepository = {
      findOne: jest.fn(),
    };

    // 2. Force AppDataSource to return our mock repository
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(
      mockTaskRepository,
    );

    // 3. Clear mock tracking instances
    mockTaskRunnerInstance = new TaskRunner(
      mockTaskRepository,
    ) as jest.Mocked<TaskRunner>;
    (TaskRunner as jest.Mock).mockImplementation(() => mockTaskRunnerInstance);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should pause and back off if an explicit dependency (dependsOn) is not completed', async () => {
    // Arrange: Create a task that depends on a parent task
    const mockParentTask = {
      taskId: 'parent-123',
      status: TaskStatus.InProgress,
    };
    const mockCurrentTask = {
      taskId: 'child-456',
      status: TaskStatus.Queued,
      stepNumber: 2,
      dependsOn: mockParentTask,
      workflow: { workflowId: 'workflow-999' },
    };

    // First call inside the while loop finds our queued task
    mockTaskRepository.findOne.mockImplementationOnce(() =>
      Promise.resolve(mockCurrentTask),
    );
    // Second call inside the guard rail checks the parent task status (returns InProgress)
    mockTaskRepository.findOne.mockImplementationOnce(() =>
      Promise.resolve(mockParentTask),
    );

    // Act: Start the worker background service
    taskWorker();

    // Fast-forward microtasks to let the database queries resolve
    await jest.advanceTimersByTimeAsync(0);

    // Assert: TaskRunner should NOT have been executed because parent isn't done!
    expect(mockTaskRunnerInstance.run).not.toHaveBeenCalled();

    // The loop should have hit the 2-second back-off timeout instead
    expect(jest.getTimerCount()).toBe(1);
  });

  it('should pause and back off if a lower chronological step number is unfinished', async () => {
    // Arrange: Create a step 2 task with no direct parent relation
    const mockCurrentTask = {
      taskId: 'step-2-id',
      status: TaskStatus.Queued,
      stepNumber: 2,
      dependsOn: null,
      workflow: { workflowId: 'workflow-999' },
    };

    // Simulate finding a lingering Step 1 task that is still processing
    const mockPrecedingTask = {
      taskId: 'step-1-id',
      stepNumber: 1,
      status: TaskStatus.InProgress,
    };

    // First call finds the current queued task
    mockTaskRepository.findOne.mockImplementationOnce(() =>
      Promise.resolve(mockCurrentTask),
    );
    // Second call handles the chronological check looking for LessThan(2) and Not(Completed)
    mockTaskRepository.findOne.mockImplementationOnce(() =>
      Promise.resolve(mockPrecedingTask),
    );

    // Act: Start worker
    taskWorker();
    await jest.advanceTimersByTimeAsync(0);

    // Assert: Safe execution rail blocked it because Step 1 is still busy
    expect(mockTaskRunnerInstance.run).not.toHaveBeenCalled();
  });

  it('should successfully pass task to TaskRunner when all guard rails clear', async () => {
    // Arrange: A clean task with no pending restrictions
    const mockCurrentTask = {
      taskId: 'clean-task-id',
      status: TaskStatus.Queued,
      stepNumber: 1,
      dependsOn: null,
      workflow: { workflowId: 'workflow-111' },
    };

    // First call finds the queued task
    mockTaskRepository.findOne.mockImplementationOnce(() =>
      Promise.resolve(mockCurrentTask),
    );
    // Second call looking for preceding items returns null (nothing is blocking it!)
    mockTaskRepository.findOne.mockImplementationOnce(() =>
      Promise.resolve(null),
    );

    // Act
    taskWorker();
    await jest.advanceTimersByTimeAsync(0);

    // Assert: Guard rails clear! The runner's execution block is executed safely.
    expect(mockTaskRunnerInstance.run).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'clean-task-id' }),
    );
  });
});
