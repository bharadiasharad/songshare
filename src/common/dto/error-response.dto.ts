import { ApiProperty } from '@nestjs/swagger';

/**
 * The uniform error envelope produced by {@link AllExceptionsFilter}. Documented as
 * a schema so every error response in Swagger references a single, consistent shape.
 */
export class ErrorResponse {
  @ApiProperty({ example: 404, description: 'HTTP status code.' })
  statusCode: number;

  @ApiProperty({ example: 'NotFound', description: 'Short, stable error identifier.' })
  error: string;

  @ApiProperty({
    example: 'Song abc123 not found',
    description: 'Human-readable message, or an array of validation messages.',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message: string | string[];

  @ApiProperty({ example: '/songs/abc123', description: 'Request path that produced the error.' })
  path: string;

  @ApiProperty({ example: '2026-01-01T12:00:00.000Z', format: 'date-time' })
  timestamp: string;
}
