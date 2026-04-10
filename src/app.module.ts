import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { DatabaseModule } from "./database/database.module";
import { BalanceModule } from "./balance/balance.module";
import { RequestModule } from "./request/request.module";
import { HcmModule } from "./hcm/hcm.module";
import { SyncModule } from "./sync/sync.module";
import { RequestLoggerMiddleware } from "./common/middleware/request-logger.middleware";

@Module({
  imports: [DatabaseModule, BalanceModule, RequestModule, HcmModule, SyncModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes("*");
  }
}
