export const STORAGE_UPLOAD_CONCURRENCY = 2

type PendingTask = {
  start: () => void
  cancel: () => void
}

export class StorageUploadQueue {
  private active = 0
  private readonly pending: PendingTask[] = []

  constructor(private readonly concurrency: number) {
    if (!Number.isSafeInteger(concurrency) || concurrency <= 0) {
      throw new Error('Storage upload concurrency must be a positive integer.')
    }
  }

  run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(uploadQueueAbortError())

    return new Promise<T>((resolve, reject) => {
      let started = false
      const onAbort = () => {
        if (started) return
        const index = this.pending.indexOf(entry)
        if (index >= 0) this.pending.splice(index, 1)
        reject(uploadQueueAbortError())
      }
      const entry: PendingTask = {
        start: () => {
          started = true
          signal?.removeEventListener('abort', onAbort)
          this.active += 1
          void task().then(resolve, reject).finally(() => {
            this.active = Math.max(0, this.active - 1)
            this.drain()
          })
        },
        cancel: onAbort,
      }

      signal?.addEventListener('abort', onAbort, { once: true })
      this.pending.push(entry)
      this.drain()
    })
  }

  private drain() {
    while (this.active < this.concurrency) {
      const next = this.pending.shift()
      if (!next) return
      next.start()
    }
  }
}

function uploadQueueAbortError() {
  return new DOMException('Upload cancelled.', 'AbortError')
}

export const storageUploadQueue = new StorageUploadQueue(STORAGE_UPLOAD_CONCURRENCY)
