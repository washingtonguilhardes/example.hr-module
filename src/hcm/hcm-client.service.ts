import {
  Injectable,
  Logger,
  BadGatewayException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { HcmBalanceResponseDto } from "./dto/hcm-balance.dto";
import { HcmSubmitRequestDto, HcmSubmitResponseDto } from "./dto/hcm-submit.dto";

export interface HcmClientConfig {
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
}

const DEFAULT_CONFIG: HcmClientConfig = {
  baseUrl: process.env.HCM_BASE_URL || "http://localhost:3001",
  timeoutMs: 5000,
  maxRetries: 3,
};

@Injectable()
export class HcmClientService {
  private readonly logger = new Logger(HcmClientService.name);
  private config: HcmClientConfig;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }

  setConfig(config: Partial<HcmClientConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async getBalance(
    employeeId: string,
    locationId: string,
  ): Promise<HcmBalanceResponseDto> {
    const url = `${this.config.baseUrl}/hcm/balances/${employeeId}/${locationId}`;

    const response = await this.requestWithRetry("GET", url);

    if (!response.ok) {
      const body = await this.safeJson(response);
      if (response.status === 404) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          error: "HCM_VALIDATION_ERROR",
          message: `HCM: balance not found for employee ${employeeId} at ${locationId}`,
          details: body,
        });
      }
      throw new BadGatewayException({
        statusCode: 502,
        error: "HCM_UNAVAILABLE",
        message: `HCM returned error ${response.status}`,
        details: body,
      });
    }

    return response.json();
  }

  async submitTimeOff(
    dto: HcmSubmitRequestDto,
  ): Promise<HcmSubmitResponseDto> {
    const url = `${this.config.baseUrl}/hcm/time-off`;

    const response = await this.requestWithRetry("POST", url, dto);

    const body: HcmSubmitResponseDto = await response.json();

    if (!response.ok || body.status === "REJECTED") {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: "HCM_VALIDATION_ERROR",
        message: body.errorMessage || "HCM rejected the time-off submission",
        details: {
          hcmErrorCode: body.errorCode,
          employeeId: dto.employeeId,
          submissionId: body.submissionId,
        },
      });
    }

    return body;
  }

  private async requestWithRetry(
    method: string,
    url: string,
    body?: unknown,
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          this.config.timeoutMs,
        );

        const options: RequestInit = {
          method,
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        };

        if (body) {
          options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        clearTimeout(timeout);

        // Don't retry on 4xx client errors
        if (response.status >= 400 && response.status < 500) {
          return response;
        }

        // Retry on 5xx server errors
        if (response.status >= 500 && attempt < this.config.maxRetries) {
          this.logger.warn(
            `HCM returned ${response.status}, retry ${attempt + 1}/${this.config.maxRetries}`,
          );
          await this.backoff(attempt);
          continue;
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.config.maxRetries) {
          this.logger.warn(
            `HCM request failed (${lastError.message}), retry ${attempt + 1}/${this.config.maxRetries}`,
          );
          await this.backoff(attempt);
        }
      }
    }

    throw new BadGatewayException({
      statusCode: 502,
      error: "HCM_UNAVAILABLE",
      message: `HCM is unreachable after ${this.config.maxRetries} retries: ${lastError?.message}`,
    });
  }

  private async backoff(attempt: number): Promise<void> {
    const baseMs = 1000 * Math.pow(2, attempt);
    const jitter = Math.random() * 500;
    await new Promise((resolve) => setTimeout(resolve, baseMs + jitter));
  }

  private async safeJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
}
