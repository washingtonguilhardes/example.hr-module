import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsNumber, IsPositive, IsIn, IsOptional, IsDateString } from "class-validator";

export class CreateRequestDto {
  @ApiProperty({ example: "emp-1" })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ example: "loc-nyc" })
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @ApiProperty({ example: "VACATION", enum: ["VACATION", "SICK", "PERSONAL"] })
  @IsIn(["VACATION", "SICK", "PERSONAL"])
  policyType: string;

  @ApiProperty({ example: "2026-05-01" })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: "2026-05-05" })
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: 3, minimum: 0.5 })
  @IsNumber()
  @IsPositive()
  days: number;

  @ApiPropertyOptional({ example: "Family vacation" })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ example: "req-abc-123", description: "Client-provided key to prevent duplicate submissions" })
  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
}
