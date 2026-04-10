import { Controller, Get, Param } from "@nestjs/common";
import { BalanceService } from "./balance.service";
import { EmployeeBalancesResponseDto } from "./dto/balance-response.dto";

@Controller("balances")
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get(":employeeId")
  getByEmployee(
    @Param("employeeId") employeeId: string,
  ): Promise<EmployeeBalancesResponseDto> {
    return this.balanceService.getByEmployee(employeeId);
  }

  @Get(":employeeId/:locationId")
  getByEmployeeAndLocation(
    @Param("employeeId") employeeId: string,
    @Param("locationId") locationId: string,
  ): Promise<EmployeeBalancesResponseDto> {
    return this.balanceService.getByEmployeeAndLocation(employeeId, locationId);
  }
}
