import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not, In } from "typeorm";
import {
  TimeOffRequest,
  RequestStatus,
  isValidTransition,
} from "./request.entity";
import { BalanceService } from "../balance/balance.service";
import { CreateRequestDto } from "./dto/create-request.dto";
import {
  TimeOffRequestResponseDto,
  PaginatedRequestsResponseDto,
} from "./dto/request-response.dto";

@Injectable()
export class RequestService {
  constructor(
    @InjectRepository(TimeOffRequest)
    private readonly requestRepo: Repository<TimeOffRequest>,
    private readonly balanceService: BalanceService,
  ) {}

  async create(dto: CreateRequestDto): Promise<TimeOffRequestResponseDto> {
    // Idempotency check
    const existing = await this.requestRepo.findOne({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) {
      return this.toDto(existing);
    }

    // Validate date range
    if (dto.startDate > dto.endDate) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: "INVALID_DATE_RANGE",
        message: "Start date must be before or equal to end date",
        details: { startDate: dto.startDate, endDate: dto.endDate },
      });
    }

    if (dto.days <= 0) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: "INVALID_DATE_RANGE",
        message: "Requested days must be greater than zero",
        details: { days: dto.days },
      });
    }

    // Validate balance exists (dimension check)
    const balance = await this.balanceService.findOne(
      dto.employeeId,
      dto.locationId,
      dto.policyType,
    );
    if (!balance) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: "INVALID_DIMENSIONS",
        message: `No balance found for employee ${dto.employeeId} at location ${dto.locationId} with policy ${dto.policyType}`,
        details: {
          employeeId: dto.employeeId,
          locationId: dto.locationId,
          policyType: dto.policyType,
        },
      });
    }

    // Check date overlap with existing non-cancelled requests
    const overlap = await this.findOverlapping(
      dto.employeeId,
      dto.startDate,
      dto.endDate,
    );
    if (overlap) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: "INVALID_DATE_RANGE",
        message: `Request overlaps with existing request ${overlap.id} (${overlap.startDate} to ${overlap.endDate})`,
        details: {
          existingRequestId: overlap.id,
          existingStartDate: overlap.startDate,
          existingEndDate: overlap.endDate,
        },
      });
    }

    // Validate balance sufficiency
    const effectiveAvailable = balance.effectiveAvailable;
    if (effectiveAvailable < dto.days) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: "INSUFFICIENT_BALANCE",
        message: `Employee ${dto.employeeId} has ${effectiveAvailable} effective days available but requested ${dto.days}`,
        details: {
          employeeId: dto.employeeId,
          locationId: dto.locationId,
          available: Number(balance.available),
          used: Number(balance.used),
          pending: Number(balance.pending),
          requested: dto.days,
        },
      });
    }

    // Create request and hold pending
    const request = this.requestRepo.create({
      employeeId: dto.employeeId,
      locationId: dto.locationId,
      policyType: dto.policyType,
      startDate: dto.startDate,
      endDate: dto.endDate,
      days: dto.days,
      reason: dto.reason ?? null,
      idempotencyKey: dto.idempotencyKey,
      status: RequestStatus.PENDING,
    });

    const saved = await this.requestRepo.save(request);
    await this.balanceService.holdPending(balance, dto.days);

    return this.toDto(saved);
  }

  async approve(
    requestId: string,
    reviewerNote?: string,
  ): Promise<TimeOffRequestResponseDto> {
    const request = await this.findOrFail(requestId);

    this.assertTransition(request, RequestStatus.APPROVED);

    // Re-validate balance sufficiency before approval
    const balance = await this.balanceService.findOne(
      request.employeeId,
      request.locationId,
      request.policyType,
    );
    if (!balance) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: "INVALID_DIMENSIONS",
        message: "Balance record no longer exists",
      });
    }

    // Check that effective available (excluding this request's pending hold) is sufficient
    // The pending hold is already counted, so effectiveAvailable already accounts for it
    // We just need to make sure the balance hasn't gone negative due to sync
    const availableAfterDeduct =
      Number(balance.available) - Number(balance.used) - Number(balance.pending) + Number(request.days) - Number(request.days);
    if (balance.effectiveAvailable < 0) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: "INSUFFICIENT_BALANCE",
        message: `Balance is insufficient after recent sync. Effective available: ${balance.effectiveAvailable}`,
        details: {
          employeeId: request.employeeId,
          available: Number(balance.available),
          used: Number(balance.used),
          pending: Number(balance.pending),
        },
      });
    }

    // Transition: move from pending to used
    await this.balanceService.deductUsed(balance, Number(request.days));

    request.status = RequestStatus.APPROVED;
    request.reviewerNote = reviewerNote ?? null;
    const saved = await this.requestRepo.save(request);

    return this.toDto(saved);
  }

  async reject(
    requestId: string,
    reviewerNote?: string,
  ): Promise<TimeOffRequestResponseDto> {
    const request = await this.findOrFail(requestId);

    this.assertTransition(request, RequestStatus.REJECTED);

    // Release pending hold
    const balance = await this.balanceService.findOne(
      request.employeeId,
      request.locationId,
      request.policyType,
    );
    if (balance) {
      await this.balanceService.releasePending(balance, Number(request.days));
    }

    request.status = RequestStatus.REJECTED;
    request.reviewerNote = reviewerNote ?? null;
    const saved = await this.requestRepo.save(request);

    return this.toDto(saved);
  }

  async cancel(requestId: string): Promise<TimeOffRequestResponseDto> {
    const request = await this.findOrFail(requestId);

    this.assertTransition(request, RequestStatus.CANCELLED);

    const balance = await this.balanceService.findOne(
      request.employeeId,
      request.locationId,
      request.policyType,
    );

    if (balance) {
      if (request.status === RequestStatus.PENDING) {
        // Release pending hold
        await this.balanceService.releasePending(balance, Number(request.days));
      } else if (request.status === RequestStatus.APPROVED) {
        // Restore used days
        await this.balanceService.restoreUsed(balance, Number(request.days));
      }
    }

    request.status = RequestStatus.CANCELLED;
    const saved = await this.requestRepo.save(request);

    return this.toDto(saved);
  }

  async list(
    filters: { employeeId?: string; status?: RequestStatus },
    page = 1,
    limit = 20,
  ): Promise<PaginatedRequestsResponseDto> {
    const where: Record<string, unknown> = {};
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.status) where.status = filters.status;

    const [data, total] = await this.requestRepo.findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: data.map((r) => this.toDto(r)),
      total,
      page,
      limit,
    };
  }

  private async findOrFail(requestId: string): Promise<TimeOffRequest> {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException({
        statusCode: 404,
        error: "NOT_FOUND",
        message: `Request ${requestId} not found`,
      });
    }
    return request;
  }

  private assertTransition(
    request: TimeOffRequest,
    targetStatus: RequestStatus,
  ): void {
    if (!isValidTransition(request.status, targetStatus)) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: "INVALID_TRANSITION",
        message: `Cannot ${targetStatus.toLowerCase()} a request with status ${request.status}`,
        details: {
          currentStatus: request.status,
          attemptedTransition: targetStatus.toLowerCase(),
        },
      });
    }
  }

  private async findOverlapping(
    employeeId: string,
    startDate: string,
    endDate: string,
  ): Promise<TimeOffRequest | null> {
    return this.requestRepo
      .createQueryBuilder("r")
      .where("r.employeeId = :employeeId", { employeeId })
      .andWhere("r.status NOT IN (:...excludedStatuses)", {
        excludedStatuses: [RequestStatus.CANCELLED, RequestStatus.REJECTED],
      })
      .andWhere("r.startDate <= :endDate", { endDate })
      .andWhere("r.endDate >= :startDate", { startDate })
      .getOne();
  }

  private toDto(request: TimeOffRequest): TimeOffRequestResponseDto {
    return {
      id: request.id,
      employeeId: request.employeeId,
      locationId: request.locationId,
      policyType: request.policyType,
      startDate: request.startDate,
      endDate: request.endDate,
      days: Number(request.days),
      status: request.status,
      reason: request.reason,
      reviewerNote: request.reviewerNote,
      hcmSubmissionId: request.hcmSubmissionId,
      idempotencyKey: request.idempotencyKey,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }
}
