import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from "@nestjs/common";
import { RequestService } from "./request.service";
import { CreateRequestDto } from "./dto/create-request.dto";
import { ReviewRequestDto } from "./dto/review-request.dto";
import { RequestStatus } from "./request.entity";
import {
  TimeOffRequestResponseDto,
  PaginatedRequestsResponseDto,
} from "./dto/request-response.dto";

@Controller("requests")
export class RequestController {
  constructor(private readonly requestService: RequestService) {}

  @Post()
  create(@Body() dto: CreateRequestDto): Promise<TimeOffRequestResponseDto> {
    return this.requestService.create(dto);
  }

  @Get()
  list(
    @Query("employeeId") employeeId?: string,
    @Query("status") status?: RequestStatus,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<PaginatedRequestsResponseDto> {
    return this.requestService.list(
      { employeeId, status },
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Patch(":id/approve")
  approve(
    @Param("id") id: string,
    @Body() dto: ReviewRequestDto,
  ): Promise<TimeOffRequestResponseDto> {
    return this.requestService.approve(id, dto?.reviewerNote);
  }

  @Patch(":id/reject")
  reject(
    @Param("id") id: string,
    @Body() dto: ReviewRequestDto,
  ): Promise<TimeOffRequestResponseDto> {
    return this.requestService.reject(id, dto?.reviewerNote);
  }

  @Patch(":id/cancel")
  cancel(@Param("id") id: string): Promise<TimeOffRequestResponseDto> {
    return this.requestService.cancel(id);
  }
}
