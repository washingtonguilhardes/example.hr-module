import { RequestStatus } from "../request.entity";

export class TimeOffRequestResponseDto {
  id: string;
  employeeId: string;
  locationId: string;
  policyType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: RequestStatus;
  reason: string | null;
  reviewerNote: string | null;
  hcmSubmissionId: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export class PaginatedRequestsResponseDto {
  data: TimeOffRequestResponseDto[];
  total: number;
  page: number;
  limit: number;
}
