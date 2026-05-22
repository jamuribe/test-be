// test-db.ts
import { AppDataSource } from "./src/data-source";
import { Task } from "./src/models/Task";

async function runTest() {
  console.log("Connecting to database...");
  await AppDataSource.initialize();

  const taskRepository = AppDataSource.getRepository(Task);

  // Fetch all tasks and explicitly load the self-referencing relationship
  const tasks = await taskRepository.find({
    relations: ["dependsOn"],
  });

  console.log("\n================ DATABASE TASK VERIFICATION ================");
  if (tasks.length === 0) {
    console.log("No tasks found in the database. Run your curl request first!");
  }

  tasks.forEach((task) => {
    const parentInfo = task.dependsOn
      ? `${task.dependsOn.taskType} (ID: ${task.dependsOn.taskId})`
      : "None (Root Task)";

    console.log(`[Step ${task.stepNumber}] Type: ${task.taskType}`);
    console.log(`   - Task ID:   ${task.taskId}`);
    console.log(`   - Status:    ${task.status}`);
    console.log(`   - DependsOn: ${parentInfo}`);
    console.log("------------------------------------------------------------");
  });
  console.log("============================================================\n");

  await AppDataSource.destroy();
}

runTest().catch(console.error);
