import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  Unique,
} from "typeorm";

@Entity("balances")
@Unique(["employeeId", "locationId", "policyType"])
export class Balance {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  employeeId: string;

  @Column()
  locationId: string;

  @Column()
  policyType: string;

  @Column("decimal", { default: 0 })
  available: number;

  @Column("decimal", { default: 0 })
  used: number;

  @Column("decimal", { default: 0 })
  pending: number;

  @Column({ type: "datetime", nullable: true })
  lastSyncedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @VersionColumn()
  version: number;

  get effectiveAvailable(): number {
    return Number(this.available) - Number(this.used) - Number(this.pending);
  }
}
