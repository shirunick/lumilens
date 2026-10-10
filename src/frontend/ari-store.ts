export class AriStore {
  url: string | null = null
  private subs = new Set<(url: string | null) => void>()

  set(url: string | null): void {
    this.url = url
    for (const cb of this.subs) cb(url)
  }

  subscribe(cb: (url: string | null) => void): () => void {
    this.subs.add(cb)
    return () => this.subs.delete(cb)
  }
}
