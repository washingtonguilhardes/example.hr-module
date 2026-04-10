import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateRequestDto {
  @ApiProperty({ example: "emp-1" })
  employeeId: string;

  @ApiProperty({ example: "loc-nyc" })
  locationId: string;

  @ApiProperty({ example: "VACATION", enum: ["VACATION", "SICK", "PERSONAL"] })
  policyType: string;

  @ApiProperty({ example: "2026-05-01" })
  startDate: string;

  @ApiProperty({ example: "2026-05-05" })
  endDate: string;

  @ApiProperty({ example: 3, minimum: 0.5 })
  days: number;

  @ApiPropertyOptional({ example: "Family vacation" })
  reason?: string;

  @ApiProperty({ example: "req-abc-123", description: "Client-provided key to prevent duplicate submissions" })
  idempotencyKey: string;
}
