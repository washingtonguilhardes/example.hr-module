import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SyncLog, SyncType, SyncStatus } from "./sync-log.entity";
import { BalanceService } from "../balance/balance.service";
import {
  BatchSyncRequestDto,
  BatchSyncResponseDto,
  BatchSyncConflictDetail,
} from "./dto/batch-sync.dto";

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(SyncLog)
    private readonly syncLogRepo: Repository<SyncLog>,
    private readonly balanceService: BalanceService,
  ) {}

  async batchSync(dto: BatchSyncRequestDto): Promise<BatchSyncResponseDto> {
    const received = dto.balances.length;
    let applied = 0;
    const conflictDetails: BatchSyncConflictDetail[] = [];

    for (const item of dto.balances) {
      // Check for conflicts: does this employee have pending requests
      // that would become insufficient with the new balance?
      const existing = await this.balanceService.findOne(
        item.employeeId,
        item.locationId,
        item.policyType,
      );

      if (existing && Number(existing.pending) > 0) {
        const newEffective = item.available - item.used - Number(existing.pending);
        if (newEffective < 0) {
          conflictDetails.push({
            employeeId: item.employeeId,
            locationId: item.locationId,
            reason: `Employee has ${existing.pending} pending days; new HCM balance (${item.available} available, ${item.used} used) would make it insufficient`,
          });
        }
      }

      // Apply the balance update regardless of conflict (HCM is source of truth)
      await this.balanceService.upsert(
        item.employeeId,
        item.locationId,
        item.policyType,
        item.available,
        item.used,
      );
      applied++;
    }

    // Log the sync operation
    const syncLog = this.syncLogRepo.create({
      type: SyncType.BATCH_INBOUND,
      status: conflictDetails.length > 0 ? SyncStatus.PARTIAL : SyncStatus.SUCCESS,
      recordsReceived: received,
      recordsApplied: applied,
      conflicts: conflictDetails.length,
    });
    await this.syncLogRepo.save(syncLog);

    this.logger.log(
      `Batch sync from ${dto.source}: ${applied}/${received} applied, ${conflictDetails.length} conflicts`,
    );

    return {
      received,
      applied,
      conflicts: conflictDetails.length,
      conflictDetails,
    };
  }
}
