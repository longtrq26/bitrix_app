import * as crypto from 'crypto';
import { QueryLeadDto } from 'src/leads/dto/query-lead.dto';

export const buildCacheKey = (
  memberId: string,
  query: QueryLeadDto,
): string => {
  const relevantQuery = {
    find: query.find || '',
    status: query.status || '',
    source: query.source || '',
    date: query.date || '',
    sort: query.sort || '',
    page: query.page?.toString() || '1',
    limit: query.limit?.toString() || '50',
    domain: query.domain || '',
  };

  // Sắp xếp các key để đảm bảo thứ tự nhất quán
  const sortedQuery = Object.keys(relevantQuery)
    .sort()
    .reduce(
      (obj, key) => {
        obj[key] = relevantQuery[key];
        return obj;
      },
      {} as Record<string, string>,
    );

  const hash = crypto
    .createHash('md5')
    .update(JSON.stringify(sortedQuery))
    .digest('hex');

  return `leads:${memberId}:${hash}`;
};
