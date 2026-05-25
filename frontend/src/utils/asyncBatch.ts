export const DEFAULT_BATCH_CONCURRENCY = 4;

export const allSettledWithConcurrency = async <T>(
  items: T[],
  worker: (item: T, index: number) => Promise<unknown>,
  concurrency = DEFAULT_BATCH_CONCURRENCY,
): Promise<PromiseSettledResult<unknown>[]> => {
  if (items.length === 0) return [];
  const workerCount = Math.max(1, Math.min(Math.floor(concurrency) || 1, items.length));
  const results: PromiseSettledResult<unknown>[] = new Array(items.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      try {
        const value = await worker(items[currentIndex], currentIndex);
        results[currentIndex] = { status: 'fulfilled', value };
      } catch (reason) {
        results[currentIndex] = { status: 'rejected', reason };
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return results;
};
