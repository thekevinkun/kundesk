// Async utility helpers — pure functions for controlling async concurrency
// No external dependencies — no library needed for this pattern

// Runs an array of async tasks with a concurrency limit
// Instead of Promise.all (all at once), runs at most `limit` tasks simultaneously
// Example: 200 embedding calls with limit=10 → 20 sequential batches of 10
export async function batchedAsync<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length) as R[];

  // Process in slices of `limit` — each slice runs in parallel, slices run sequentially
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);

    // Run this batch in parallel — but wait for all to finish before next batch
    const batchResults = await Promise.all(
      batch.map((item, batchIndex) => fn(item, i + batchIndex)),
    );

    // Place results in correct positions — preserves original order
    batchResults.forEach((result, batchIndex) => {
      results[i + batchIndex] = result;
    });
  }

  return results;
}
