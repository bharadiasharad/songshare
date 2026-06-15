import { paginate } from './paginated';

describe('paginate', () => {
  it('wraps data with correct meta', () => {
    const result = paginate(['a', 'b'], 12, 2, 5);
    expect(result.data).toEqual(['a', 'b']);
    expect(result.meta).toEqual({ page: 2, limit: 5, total: 12, totalPages: 3 });
  });

  it('reports at least one page when there is no data', () => {
    const result = paginate([], 0, 1, 20);
    expect(result.meta.totalPages).toBe(1);
    expect(result.data).toHaveLength(0);
  });

  it('rounds partial pages up', () => {
    expect(paginate([], 21, 1, 10).meta.totalPages).toBe(3);
  });
});
