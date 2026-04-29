import { Client } from '@notionhq/client';

let clientInstance: Client | null = null;

export function getNotionClient(apiKey: string): Client {
  if (!clientInstance) {
    clientInstance = new Client({ auth: apiKey });
  }
  return clientInstance;
}

export function resetClient(): void {
  clientInstance = null;
}

let lastRequestTime = 0;
const MIN_INTERVAL = 334;

export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const now = Date.now();
      const elapsed = now - lastRequestTime;
      if (elapsed < MIN_INTERVAL) {
        await new Promise(r => setTimeout(r, MIN_INTERVAL - elapsed));
      }
      lastRequestTime = Date.now();
      return await fn();
    } catch (error: any) {
      const isRetryable = error?.status === 429 || error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT';
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      const retryAfter = error?.headers?.['retry-after']
        ? parseInt(error.headers['retry-after']) * 1000
        : Math.pow(2, attempt) * 1000;
      await new Promise(r => setTimeout(r, retryAfter));
    }
  }
  throw new Error('Max retries exceeded');
}
