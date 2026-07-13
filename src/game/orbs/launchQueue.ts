export class LaunchQueue {
  private readonly ids: number[] = [];
  private readonly queued = new Set<number>();
  private nextReleaseMs: number | undefined;

  constructor(private readonly intervalMs: number) {}

  enqueue(id: number): void {
    if (this.queued.has(id)) return;
    this.ids.push(id);
    this.queued.add(id);
  }

  drain(nowMs: number): number[] {
    if (this.ids.length === 0) {
      this.nextReleaseMs = undefined;
      return [];
    }
    if (this.nextReleaseMs !== undefined && nowMs < this.nextReleaseMs) return [];

    const id = this.ids.shift();
    if (id === undefined) return [];
    this.queued.delete(id);
    this.nextReleaseMs = this.ids.length === 0 ? undefined : nowMs + this.intervalMs;
    return [id];
  }

  clear(): void {
    this.ids.length = 0;
    this.queued.clear();
    this.nextReleaseMs = undefined;
  }
}
