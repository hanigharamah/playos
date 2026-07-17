/**
 * Rejects instead of hanging forever. supabase-js's session calls
 * (getSession/getUser) can stall indefinitely if a session lock gets stuck
 * (seen after heavy multi-tab/incognito auth churn) or the network is down —
 * this turns that into a normal, catchable error instead of an endless spinner.
 */
export function withTimeout<T>(p: PromiseLike<T>, ms = 10000): Promise<T> {
  return Promise.race([
    p as Promise<T>,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`No response after ${ms / 1000}s`)), ms),
    ),
  ]);
}
