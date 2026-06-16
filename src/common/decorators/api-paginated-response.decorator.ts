import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginationMeta } from '../dto/paginated';

/**
 * Documents a `200 OK` paginated envelope — `{ data: Model[], meta: PaginationMeta }` —
 * for list endpoints, so the response shape is visible in Swagger.
 *
 * @example
 *   @ApiPaginatedResponse(SongResponse)
 *   list(): Promise<PaginatedResult<SongResponse>> { ... }
 */
export const ApiPaginatedResponse = <TModel extends Type<unknown>>(model: TModel) =>
  applyDecorators(
    ApiExtraModels(PaginationMeta, model),
    ApiOkResponse({
      description: `Paginated list of ${model.name}`,
      schema: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          meta: { $ref: getSchemaPath(PaginationMeta) },
        },
      },
    }),
  );
