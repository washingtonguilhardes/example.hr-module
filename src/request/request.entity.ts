import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export enum RequestStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}

const VALID_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  [RequestStatus.PENDING]: [
    RequestStatus.APPROVED,
    RequestStatus.REJECTED,
    RequestStatus.CANCELLED,
  ],
  [RequestStatus.APPROVED]: [RequestStatus.CANCELLED],
  [RequestStatus.REJECTED]: [],
  [RequestStatus.CANCELLED]: [],
};

export function isValidTransition(
  from: RequestStatus,
  to: RequestStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

@Entity("time_off_requests")
export class TimeOffRequest {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  employeeId: string;

  @Column()
  locationId: string;

  @Column()
  policyType: string;

  @Column({ type: "date" })
  startDate: string;

  @Column({ type: "date" })
  endDate: string;

  @Column("decimal")
  days: number;

  @Column({ type: "varchar", default: RequestStatus.PENDING })
  status: RequestStatus;

  @Column({ type: "varchar", nullable: true })
  reason: string | null;

  @Column({ type: "varchar", nullable: true })
  reviewerNote: string | null;

  @Column({ type: "varchar", nullable: true })
  hcmSubmissionId: string | null;

  @Column({ type: "varchar", unique: true })
  idempotencyKey: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
