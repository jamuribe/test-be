import { Router } from "express";
import { AppDataSource } from "../data-source";
import { WorkflowFactory } from "../workflows/WorkflowFactory";
import { Workflow } from "../models/Workflow"; // 1. Import the Workflow entity
import path from "path";

const router = Router();
const workflowFactory = new WorkflowFactory(AppDataSource);

router.post("/", async (req, res) => {
  const { clientId, geoJson } = req.body;
  const workflowFile = path.join(
    __dirname,
    "../workflows/example_workflow.yml",
  );

  try {
    const workflow = await workflowFactory.createWorkflowFromYAML(
      workflowFile,
      clientId,
      JSON.stringify(geoJson),
    );

    res.status(202).json({
      workflowId: workflow.workflowId,
      message: "Workflow created and tasks queued from YAML definition.",
    });
  } catch (error: any) {
    console.error("Error creating workflow:", error);
    res.status(500).json({ message: "Failed to create workflow" });
  }
});

/**
 * NEW ADDITION: GET /:id
 * Because this router is mounted at "/analysis" in index.ts,
 * this endpoint will live at: GET http://localhost:3000/analysis/:id
 */
router.get("/:id", async (req, res): Promise<any> => {
  try {
    const workflowId = req.params.id;
    const workflowRepository = AppDataSource.getRepository(Workflow);

    // Fetch the workflow state along with its related tasks
    const workflow = await workflowRepository.findOne({
      where: { workflowId },
      relations: ["tasks"],
    });

    // If no workflow is found with the given ID, return a 404 response
    if (!workflow) {
      return res
        .status(404)
        .json({ message: `Workflow with ID ${workflowId} not found.` });
    }

    // Safely parse out the nested JSON report if it was compiled by our Task 4 Runner logic
    let parsedReport = null;
    if (workflow.result) {
      try {
        parsedReport = JSON.parse(workflow.result);
      } catch {
        parsedReport = workflow.result;
      }
    }

    // Return the clean real-time lifecycle breakdown to the client
    return res.status(200).json({
      workflowId: workflow.workflowId,
      clientId: workflow.clientId,
      status: workflow.status,
      tasksSummary: workflow.tasks.map((t) => ({
        taskId: t.taskId,
        type: t.taskType,
        step: t.stepNumber,
        status: t.status,
      })),
      finalReport: parsedReport,
    });
  } catch (error: any) {
    // Log the error for debugging purposes and return a 500 response
    console.error("Error fetching workflow status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
