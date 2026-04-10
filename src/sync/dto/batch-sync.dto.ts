import { ApiProperty } from "@nestjs/swagger";

class BatchSyncBalanceItem {
  @ApiProperty({ example: "emp-1" })
  employeeId: string;

  @ApiProperty({ example: "loc-nyc" })
  locationId: string;

  @ApiProperty({ example: "VACATION" })
  policyType: string;

  @ApiProperty({ example: 15 })
  available: number;

  @ApiProperty({ example: 5 })
  used: number;
}

export class BatchSyncRequestDto {
  @ApiProperty({ example: "workday" })
  source: string;

  @ApiProperty({ example: "2026-04-10T00:00:00Z" })
  timestamp: string;

  @ApiProperty({ type: [BatchSyncBalanceItem] })
  balances: BatchSyncBalanceItem[];
}

export class BatchSyncConflictDetail {
  employeeId: string;
  locationId: string;
  reason: string;
}

export class BatchSyncResponseDto {
  received: number;
  applied: number;
  conflicts: number;
  conflictDetails: BatchSyncConflictDetail[];
}
