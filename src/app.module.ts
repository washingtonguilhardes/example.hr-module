import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { DatabaseModule } from "./database/database.module";
import { BalanceModule } from "./balance/balance.module";
import { RequestModule } from "./request/request.module";
import { HcmModule } from "./hcm/hcm.module";

@Module({
  imports: [DatabaseModule, BalanceModule, RequestModule, HcmModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
