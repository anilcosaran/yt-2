export class InFlightRequestRegistry {
  private readonly requests = new Map<string, Promise<unknown>>()

  has(key: string) {
    return this.requests.has(key)
  }

  run<T>(key: string, requestFactory: () => Promise<T>): Promise<T> {
    const existing = this.requests.get(key)
    if (existing) return existing as Promise<T>

    const request = Promise.resolve().then(requestFactory)
    this.requests.set(key, request)

    const cleanup = () => {
      if (this.requests.get(key) === request) this.requests.delete(key)
    }
    void request.then(cleanup, cleanup)
    return request
  }
}
