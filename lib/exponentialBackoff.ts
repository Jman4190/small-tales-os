export async function exponentialBackoff(attempt: number, baseDelay = 100) {
  const delay = Math.pow(2, attempt) * baseDelay;
  return new Promise((resolve) => setTimeout(resolve, delay));
}
