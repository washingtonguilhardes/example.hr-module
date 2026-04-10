import { ApiProperty } from "@nestjs/swagger";
import { RequestStatus } from "../request.entity";

export class TimeOffRequestResponseDto {
  @ApiProperty({ example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" })
  id: string;

  @ApiProperty({ example: "emp-1" })
  employeeId: string;

  @ApiProperty({ example: "loc-nyc" })
  locationId: string;

  @ApiProperty({ example: "VACATION" })
  policyType: string;

  @ApiProperty({ example: "2026-05-01" })
  startDate: string;

  @ApiProperty({ example: "2026-05-05" })
  endDate: string;

  @ApiProperty({ example: 3 })
  days: number;

  @ApiProperty({ enum: RequestStatus, example: "PENDING" })
  status: RequestStatus;

  @ApiProperty({ example: "Family vacation", nullable: true })
  reason: string | null;

  @ApiProperty({ example: "Approved!", nullable: true })
  reviewerNote: string | null;

  @ApiProperty({ example: "hcm-sub-123", nullable: true })
  hcmSubmissionId: string | null;

  @ApiProperty({ example: "req-abc-123" })
  idempotencyKey: string;

  @ApiProperty({ example: "2026-04-10T12:00:00.000Z" })
  createdAt: string;

  @ApiProperty({ example: "2026-04-10T12:00:00.000Z" })
  updatedAt: string;
}

export class PaginatedRequestsResponseDto {
  @ApiProperty({ type: [TimeOffRequestResponseDto] })
  data: TimeOffRequestResponseDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
