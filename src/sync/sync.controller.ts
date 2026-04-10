import { Controller, Post, Body } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { SyncService } from "./sync.service";
import { BatchSyncRequestDto, BatchSyncResponseDto } from "./dto/batch-sync.dto";

@ApiTags("Sync")
@Controller("sync")
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post("batch")
  @ApiOperation({ summary: "Receive bulk balance data from HCM" })
  @ApiResponse({ status: 200, description: "Batch sync completed" })
  @ApiResponse({ status: 422, description: "Invalid payload format" })
  batchSync(@Body() dto: BatchSyncRequestDto): Promise<BatchSyncResponseDto> {
    return this.syncService.batchSync(dto);
  }
}
