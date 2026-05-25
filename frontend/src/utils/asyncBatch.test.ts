import { allSettledWithConcurrency } from './asyncBatch';

const deferred = () => {
  let resolve!: (value?: unknown) => void;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('allSettledWithConcurrency', () => {
  it('preserves result order while limiting active work', async () => {
    const gates = [deferred(), deferred(), deferred(), deferred()];
    let active = 0;
    let maxActive = 0;
    const started: number[] = [];

    const run = allSettledWithConcurrency([1, 2, 3, 4], async (value, index) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      started.push(value);
      await gates[index].promise;
      active -= 1;
      return value * 10;
    }, 2);

    await flushPromises();
    expect(started).toEqual([1, 2]);
    expect(maxActive).toBe(2);

    gates[1].resolve();
    await flushPromises();
    expect(started).toEqual([1, 2, 3]);

    gates[0].resolve();
    gates[2].resolve();
    gates[3].resolve();
    await expect(run).resolves.toEqual([
      { status: 'fulfilled', value: 10 },
      { status: 'fulfilled', value: 20 },
      { status: 'fulfilled', value: 30 },
      { status: 'fulfilled', value: 40 },
    ]);
  });

  it('captures rejections and clamps invalid concurrency', async () => {
    const results = await allSettledWithConcurrency([1, 2], async (value) => {
      if (value === 2) throw new Error('failed');
      return value;
    }, 0);

    expect(results[0]).toEqual({ status: 'fulfilled', value: 1 });
    expect(results[1].status).toBe('rejected');
  });
});
