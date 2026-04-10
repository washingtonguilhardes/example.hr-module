import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, body } = req;
    const start = Date.now();

    const bodyLog = method !== "GET" && Object.keys(body || {}).length > 0
      ? ` | body: ${JSON.stringify(body)}`
      : "";

    this.logger.log(`--> ${method} ${originalUrl}${bodyLog}`);

    res.on("finish", () => {
      const duration = Date.now() - start;
      const { statusCode } = res;
      const level = statusCode >= 400 ? "warn" : "log";
      this.logger[level](`<-- ${method} ${originalUrl} ${statusCode} (${duration}ms)`);
    });

    next();
  }
}
