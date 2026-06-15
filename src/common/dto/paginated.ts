import { ApiProperty } from '@nestjs/swagger';

export class PaginationMeta {
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPages: number;
}

export class PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Build a standard paginated response envelope.
 */
export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
