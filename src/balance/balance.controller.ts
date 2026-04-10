import { Controller, Get, Post, Param, Body } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsNumber, IsIn } from "class-validator";
import { BalanceService } from "./balance.service";
import { EmployeeBalancesResponseDto } from "./dto/balance-response.dto";

class SeedBalanceDto {
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

  @ApiProperty({ example: 15 })
  @IsNumber()
  available: number;

  @ApiProperty({ example: 3 })
  @IsNumber()
  used: number;
}

@ApiTags("Balances")
@Controller("balances")
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Post("seed")
  @ApiOperation({ summary: "Seed a balance record (dev/test helper)" })
  async seed(@Body() dto: SeedBalanceDto) {
    const balance = await this.balanceService.upsert(
      dto.employeeId,
      dto.locationId,
      dto.policyType,
      dto.available,
      dto.used,
    );
    return {
      id: balance.id,
      employeeId: balance.employeeId,
      locationId: balance.locationId,
      policyType: balance.policyType,
      available: Number(balance.available),
      used: Number(balance.used),
      pending: Number(balance.pending),
      effectiveAvailable: balance.effectiveAvailable,
    };
  }

  @Get(":employeeId")
  @ApiOperation({ summary: "Get all balances for an employee" })
  getByEmployee(
    @Param("employeeId") employeeId: string,
  ): Promise<EmployeeBalancesResponseDto> {
    return this.balanceService.getByEmployee(employeeId);
  }

  @Get(":employeeId/:locationId")
  @ApiOperation({ summary: "Get balances for an employee at a location" })
  getByEmployeeAndLocation(
    @Param("employeeId") employeeId: string,
    @Param("locationId") locationId: string,
  ): Promise<EmployeeBalancesResponseDto> {
    return this.balanceService.getByEmployeeAndLocation(employeeId, locationId);
  }
}
