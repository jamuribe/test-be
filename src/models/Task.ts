import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { Workflow } from "./Workflow";
import { TaskStatus } from "../workers/taskRunner";

@Entity({ name: "tasks" })
export class Task {
  @PrimaryGeneratedColumn("uuid")
  taskId!: string;

  @Column()
  clientId!: string;

  @Column("text")
  geoJson!: string;

  @Column()
  status!: TaskStatus;

  @Column({ nullable: true, type: "text" })
  progress?: string | null;

  @Column({ nullable: true })
  resultId?: string;

  @Column()
  taskType!: string;

  @Column({ default: 1 })
  stepNumber!: number;

  @ManyToOne(() => Workflow, (workflow) => workflow.tasks)
  workflow!: Workflow;

  // Stores the output data from the Job's run() method,
  // which can be any JSON-serializable data.
  // This is where the Job's return value will be saved after execution.
  @Column({ nullable: true, type: "text" })
  output?: string | null;

  // Self-referencing relationship to represent task dependencies
  @ManyToOne(() => Task, { nullable: true })
  dependsOn?: Task | null;
}
