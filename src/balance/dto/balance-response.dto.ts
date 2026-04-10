export class BalanceItemDto {
  locationId: string;
  policyType: string;
  available: number;
  used: number;
  pending: number;
  effectiveAvailable: number;
  lastSyncedAt: string | null;
}

export class EmployeeBalancesResponseDto {
  employeeId: string;
  balances: BalanceItemDto[];
}
