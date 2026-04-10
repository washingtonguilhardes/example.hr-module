import { ApiProperty } from "@nestjs/swagger";

export class BalanceItemDto {
  @ApiProperty({ example: "loc-nyc" })
  locationId: string;

  @ApiProperty({ example: "VACATION" })
  policyType: string;

  @ApiProperty({ example: 15 })
  available: number;

  @ApiProperty({ example: 3 })
  used: number;

  @ApiProperty({ example: 2 })
  pending: number;

  @ApiProperty({ example: 10, description: "Computed: available - used - pending" })
  effectiveAvailable: number;

  @ApiProperty({ example: "2026-04-09T14:00:00Z", nullable: true })
  lastSyncedAt: string | null;
}

export class EmployeeBalancesResponseDto {
  @ApiProperty({ example: "emp-1" })
  employeeId: string;

  @ApiProperty({ type: [BalanceItemDto] })
  balances: BalanceItemDto[];
}
