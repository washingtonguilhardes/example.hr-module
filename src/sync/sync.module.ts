import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SyncLog } from "./sync-log.entity";
import { SyncService } from "./sync.service";
import { SyncController } from "./sync.controller";
import { BalanceModule } from "../balance/balance.module";

@Module({
  imports: [TypeOrmModule.forFeature([SyncLog]), BalanceModule],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
