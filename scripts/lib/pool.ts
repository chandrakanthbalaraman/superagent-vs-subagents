export async function runPool<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    return;
  }
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (;;) {
      const next = queue.shift();
      if (next === undefined) {
        return;
      }
      await task(next);
    }
  });
  await Promise.all(workers);
}
