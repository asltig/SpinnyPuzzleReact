/**
 * retryQueue.ts
 * Failed network request queue backed by MMKV.
 * Replaces: WaitingRequest CoreData entity + fetchWaitingRequests + sendWaitingRequests.
 *
 * On network reconnect (NetInfo event), flush() replays all queued requests.
 */
import { storage } from '../../storage/mmkv';

const KEY_RETRY_QUEUE = 'retryQueue';

interface QueuedRequest {
  method: string;
  url:    string;
  data:   unknown;
  /** ISO timestamp of when the request was queued. */
  queuedAt: string;
}

function load(): QueuedRequest[] {
  const raw = storage.getString(KEY_RETRY_QUEUE);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedRequest[];
  } catch {
    return [];
  }
}

function save(queue: QueuedRequest[]): void {
  storage.set(KEY_RETRY_QUEUE, JSON.stringify(queue));
}

export const retryQueue = {
  enqueue(request: Omit<QueuedRequest, 'queuedAt'>): void {
    const queue = load();
    queue.push({ ...request, queuedAt: new Date().toISOString() });
    save(queue);
  },

  /** Replay all queued requests. Call when network becomes available. */
  async flush(sendFn: (req: QueuedRequest) => Promise<void>): Promise<void> {
    const queue = load();
    if (!queue.length) return;

    const failed: QueuedRequest[] = [];
    for (const req of queue) {
      try {
        await sendFn(req);
      } catch {
        failed.push(req);
      }
    }
    save(failed);
  },

  clear(): void {
    storage.delete(KEY_RETRY_QUEUE);
  },

  count(): number {
    return load().length;
  },
};
