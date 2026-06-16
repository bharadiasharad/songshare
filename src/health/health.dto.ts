import { ApiProperty } from '@nestjs/swagger';

/** Liveness probe response. */
export class LivenessResponse {
  @ApiProperty({ example: 'ok' })
  status: string;

  @ApiProperty({ format: 'date-time', example: '2026-01-01T12:00:00.000Z' })
  timestamp: string;
}

/** Readiness probe response (database connectivity). */
export class ReadinessResponse {
  @ApiProperty({ example: 'ok' })
  status: string;

  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  database: string;
}
