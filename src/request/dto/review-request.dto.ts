import { ApiPropertyOptional } from "@nestjs/swagger";

export class ReviewRequestDto {
  @ApiPropertyOptional({ example: "Approved, enjoy your time off" })
  reviewerNote?: string;
}
