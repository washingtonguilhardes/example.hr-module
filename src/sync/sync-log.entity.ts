import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

export enum SyncType {
  BATCH_INBOUND = "BATCH_INBOUND",
  REALTIME_GET = "REALTIME_GET",
  REALTIME_SUBMIT = "REALTIME_SUBMIT",
}

export enum SyncStatus {
  SUCCESS = "SUCCESS",
  PARTIAL = "PARTIAL",
  FAILED = "FAILED",
}

@Entity("sync_logs")
export class SyncLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  type: SyncType;

  @Column({ type: "varchar" })
  status: SyncStatus;

  @Column({ type: "integer", nullable: true })
  recordsReceived: number | null;

  @Column({ type: "integer", nullable: true })
  recordsApplied: number | null;

  @Column({ type: "integer", nullable: true })
  conflicts: number | null;

  @Column({ type: "varchar", nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
