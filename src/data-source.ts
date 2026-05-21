// src/data-source.ts
import "reflect-metadata";
import { DataSource } from "typeorm";
import { Task } from "./models/Task";
import { Workflow } from "./models/Workflow";
import { Result } from "./models/Result";

export const AppDataSource = new DataSource({
  type: "sqljs",
  autoSave: true, // Automatically writes changes to the file
  location: "database.sqlite", // Your local database file
  synchronize: true,
  logging: false,
  entities: [Task, Workflow, Result],
  migrations: [],
  subscribers: [],
});
