import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class ReviewRequestDto {
  @ApiPropertyOptional({ example: "Approved, enjoy your time off" })
  @IsOptional()
  @IsString()
  reviewerNote?: string;
}
