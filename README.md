# Geospatial Analysis Workflow Engine

A distributed, dependency-aware background worker system built with **TypeScript**, **Node.js**, **Express**, and **TypeORM**. This application parses multi-step analytical pipelines from YAML definitions, manages complex sequential task execution, runs heavy geospatial calculations (like Turf.js area tracking), and aggregates results dynamically.

---

## Architecture Overview

The system is separated into three decoupled execution layers:
1. **API Router (`Express`):** Ingests incoming client GeoJSON data, processes the YAML workflow blueprint, maps relationships, and queues tasks.
2. **Task Worker (`Polling Loop`):** A continuous, strict FIFO background polling service that monitors the database queue, evaluating execution guard rails and explicit task dependencies before releasing a job.
3. **Task Runner (`Job Engine`):** Executes specific concrete business logic (e.g., computing polygon surface areas) and stamps aggregated data reports directly onto finished workflows.

---

## Prerequisites

Ensure you have the following installed on your machine:
* **Node.js** (v18.x or higher recommended)
* **npm** (v9.x or higher)
* A running database instance configured to match your connection parameters

---

## Installation & Setup

1. **Navigate to the project root directory:**
   ```bash
   cd sapi
```

Install all project dependencies:
```bash
npm install
```

Configure your Database:

Ensure your database credentials match the setup inside src/data-source.ts. If you are using migrations, sync your database schema before proceeding:
```
npm run migration:run
```bash

Running the Application
To run the full engine, you need to spin up two separate processes concurrently (open two separate terminal windows in VS Code):

Terminal 1: Start the API Server
This boots the Express server to listen for incoming client HTTP requests.
```bash
npm run start:server
```
The server will start listening at http://localhost:3000.

Terminal 2: Start the Background Queue Worker
This activates the while(true) background polling loop to process pending queue actions.
```bash
npm run start:worker
```
Triggering a Workflow (Example API Usage)
You can trigger the multi-step pipeline using curl or any API client like Postman.

1. Dispatch a new workflow request
Submit a POST request containing a valid clientId and a GeoJSON payload. The system will parse example_workflow.yml, create the sequential steps, and return a tracking ID immediately.
```bash
curl -X POST http://localhost:3000/analysis

-H "Content-Type: application/json"

-d '{
"clientId": "client-abc-123",
"geoJson": {
"type": "Feature",
"properties": {},
"geometry": {
"type": "Polygon",
"coordinates": [
[[0, 0], [0, 0.000904], [0.000904, 0.000904], [0.000904, 0], [0, 0]]
]
}
}
}'
```

Response (202 Accepted):
```bash
{
"workflowId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
"message": "Workflow created and tasks queued from YAML definition."
}
```

2. Poll Workflow Lifecycle Status & Reports
Use the workflowId returned above to request a real-time tracking breakdown of your lifecycle pipelines. Once all background tasks cross the finish line, the final aggregated data report will appear inside the finalReport object.
```bash
curl -X GET http://localhost:3000/analysis/YOUR_WORKFLOW_ID_HERE
```

Running the Test Suite
The application features a comprehensive test suite powered by Jest and ts-jest, validating unit isolation logic, database repository mock abstractions, and worker queue guard rail networks.

Run all tests:
```bash
npm test
```
Run tests in live watch-mode (re-runs automatically on file save):
```bash
npm run test:watch
```
Workflow Definitions (.yml)
Pipelines are orchestrated dynamically via standard text configurations located in src/workflows/. You can easily add or reorder tasks without rewriting code:
``` YAML
name: "example_workflow"
steps:

taskType: "polygonArea"
stepNumber: 1

taskType: "analysis"
stepNumber: 2
dependsOnStep: 1  # Guard rail ensures this stays paused until Step 1 finishes.

taskType: "reportGeneration"
stepNumber: 3
dependsOnStep: 2  # Aggregates compiled payloads into the final Workflow row.
```
