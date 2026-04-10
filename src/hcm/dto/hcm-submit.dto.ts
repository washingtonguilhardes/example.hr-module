export class HcmSubmitRequestDto {
  employeeId: string;
  locationId: string;
  policyType: string;
  days: number;
  startDate: string;
  endDate: string;
}

export class HcmSubmitResponseDto {
  submissionId: string;
  status: "ACCEPTED" | "REJECTED";
  errorCode?: string;
  errorMessage?: string;
}
