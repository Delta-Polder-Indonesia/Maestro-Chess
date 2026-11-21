/** Stop asynchronous work before it can write data after its owner canceled. */
export function pastikanTidakDibatalkan(signal) {
  if (!signal?.aborted) return;
  const error = new Error("dibatalkan");
  error.name = "AbortError";
  throw error;
}
