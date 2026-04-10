import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiResponse } from "@nestjs/swagger";
import { RequestService } from "./request.service";
import { CreateRequestDto } from "./dto/create-request.dto";
import { ReviewRequestDto } from "./dto/review-request.dto";
import { RequestStatus } from "./request.entity";
import {
  TimeOffRequestResponseDto,
  PaginatedRequestsResponseDto,
} from "./dto/request-response.dto";

@ApiTags("Requests")
@Controller("requests")
export class RequestController {
  constructor(private readonly requestService: RequestService) {}

  @Post()
  @ApiOperation({ summary: "Create a time-off request" })
  @ApiResponse({ status: 201, description: "Request created with PENDING status" })
  @ApiResponse({ status: 409, description: "Duplicate idempotency key" })
  @ApiResponse({ status: 422, description: "Validation failure" })
  create(@Body() dto: CreateRequestDto): Promise<TimeOffRequestResponseDto> {
    return this.requestService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "List time-off requests" })
  @ApiQuery({ name: "employeeId", required: false })
  @ApiQuery({ name: "status", required: false, enum: RequestStatus })
  @ApiQuery({ name: "page", required: false, example: 1 })
  @ApiQuery({ name: "limit", required: false, example: 20 })
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
  @ApiOperation({ summary: "Approve a time-off request" })
  @ApiParam({ name: "id", description: "Request UUID" })
  @ApiResponse({ status: 200, description: "Request approved" })
  @ApiResponse({ status: 422, description: "Validation or HCM rejection" })
  @ApiResponse({ status: 502, description: "HCM unavailable" })
  approve(
    @Param("id") id: string,
    @Body() dto: ReviewRequestDto,
  ): Promise<TimeOffRequestResponseDto> {
    return this.requestService.approve(id, dto?.reviewerNote);
  }

  @Patch(":id/reject")
  @ApiOperation({ summary: "Reject a time-off request" })
  @ApiParam({ name: "id", description: "Request UUID" })
  reject(
    @Param("id") id: string,
    @Body() dto: ReviewRequestDto,
  ): Promise<TimeOffRequestResponseDto> {
    return this.requestService.reject(id, dto?.reviewerNote);
  }

  @Patch(":id/cancel")
  @ApiOperation({ summary: "Cancel a time-off request" })
  @ApiParam({ name: "id", description: "Request UUID" })
  cancel(@Param("id") id: string): Promise<TimeOffRequestResponseDto> {
    return this.requestService.cancel(id);
  }
}
