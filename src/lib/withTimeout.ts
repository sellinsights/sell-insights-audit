/** Races a promise against a timeout so a genuinely-hung request (network
 * stall, RLS deadlock, etc.) surfaces as a clear error instead of spinning
 * forever. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${(ms / 1000).toFixed(0)}s — the request may be hanging.`));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
