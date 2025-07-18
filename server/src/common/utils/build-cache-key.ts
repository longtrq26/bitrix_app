import * as crypto from 'crypto';
import { QueryLeadDto } from 'src/leads/dto/query-lead.dto';

export const buildCacheKey = (
  memberId: string,
  query: QueryLeadDto,
): string => {
  const relevantQuery = {
    search: query.find,
    status: query.status,
    source: query.source,
    date: query.date,
    sort: query.sort,
  };

  const hash = crypto
    .createHash('md5')
    .update(JSON.stringify(relevantQuery))
    .digest('hex');

  return `leads:${memberId}:${hash}`;
};
