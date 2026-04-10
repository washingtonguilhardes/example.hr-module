import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsNumber, IsArray, ValidateNested, IsDateString } from "class-validator";
import { Type } from "class-transformer";

class BatchSyncBalanceItem {
  @ApiProperty({ example: "emp-1" })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ example: "loc-nyc" })
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @ApiProperty({ example: "VACATION" })
  @IsString()
  @IsNotEmpty()
  policyType: string;

  @ApiProperty({ example: 15 })
  @IsNumber()
  available: number;

  @ApiProperty({ example: 5 })
  @IsNumber()
  used: number;
}

export class BatchSyncRequestDto {
  @ApiProperty({ example: "workday" })
  @IsString()
  @IsNotEmpty()
  source: string;

  @ApiProperty({ example: "2026-04-10T00:00:00Z" })
  @IsDateString()
  timestamp: string;

  @ApiProperty({ type: [BatchSyncBalanceItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchSyncBalanceItem)
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
