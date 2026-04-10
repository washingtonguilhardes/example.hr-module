import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Response } from "express";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // If the service already returned a structured error, pass it through
      if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
        response.status(status).json(exceptionResponse);
        return;
      }

      response.status(status).json({
        statusCode: status,
        error: this.statusToErrorCode(status),
        message: exception.message,
      });
      return;
    }

    // Unexpected errors
    this.logger.error("Unhandled exception", exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    });
  }

  private statusToErrorCode(status: number): string {
    switch (status) {
      case 400: return "BAD_REQUEST";
      case 404: return "NOT_FOUND";
      case 409: return "DUPLICATE_REQUEST";
      case 422: return "VALIDATION_ERROR";
      case 502: return "HCM_UNAVAILABLE";
      default: return "INTERNAL_ERROR";
    }
  }
}
