export class CreateRequestDto {
  employeeId: string;
  locationId: string;
  policyType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  idempotencyKey: string;
}
