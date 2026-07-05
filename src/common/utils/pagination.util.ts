import { PaginationDto } from '../dto/pagination.dto';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function getPaginationParams(dto: PaginationDto) {
  const page = dto.page && dto.page > 0 ? Number(dto.page) : 1;
  const limit = dto.limit && dto.limit > 0 ? Number(dto.limit) : 10;
  const skip = (page - 1) * limit;
  return { skip, take: limit, page, limit };
}

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export interface PrismaModelDelegate<T> {
  findMany: (args: any) => Promise<T[]>;
  count: (args: any) => Promise<number>;
}

export async function paginate<T>(
  model: PrismaModelDelegate<T>,
  dto: PaginationDto,
  options: {
    where?: unknown;
    select?: unknown;
    include?: unknown;
    orderBy?: unknown;
  } = {},
): Promise<PaginatedResult<T>> {
  const { skip, take, page, limit } = getPaginationParams(dto);
  const { where, select, include, orderBy } = options;

  // Build prisma findMany query parameters safely using Record<string, unknown>
  const queryArgs: Record<string, unknown> = {
    skip,
    take,
  };

  if (where) queryArgs.where = where;
  if (select) queryArgs.select = select;
  if (include) queryArgs.include = include;
  if (orderBy) queryArgs.orderBy = orderBy;

  const [data, total] = await Promise.all([
    model.findMany(queryArgs),
    model.count({ where }),
  ]);

  return createPaginatedResponse(data, total, page, limit);
}
