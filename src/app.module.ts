import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { DatabaseModule } from "./database/database.module";
import { BalanceModule } from "./balance/balance.module";
import { RequestModule } from "./request/request.module";

@Module({
  imports: [DatabaseModule, BalanceModule, RequestModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
