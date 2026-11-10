// src/utils/settleAll.js
import pLimit from 'p-limit';

export const settleAll = async (items, fn, concurrency = 4) => {
  const limit = pLimit(concurrency);
  const results = await Promise.allSettled(
    items.map((item, i) => limit(() => fn(item, i)))
  );
  return results.map((r, i) => ({
    item: items[i],
    ok: r.status === 'fulfilled',
    value: r.status === 'fulfilled' ? r.value : undefined,
    error: r.status === 'rejected' ? r.reason : undefined,
  }));
};