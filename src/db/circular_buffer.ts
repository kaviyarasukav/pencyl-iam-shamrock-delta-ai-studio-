export class CircularBuffer<T> {
  private buffer: T[];
  private head: number = 0;
  private isFull: boolean = false;

  constructor(private capacity: number) {
    this.buffer = new Array<T>(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.head === 0) {
      this.isFull = true;
    }
  }

  toArray(): T[] {
    if (!this.isFull) {
      return this.buffer.slice(0, this.head);
    }
    return [
      ...this.buffer.slice(this.head, this.capacity),
      ...this.buffer.slice(0, this.head)
    ];
  }

  getCapacity(): number {
    return this.capacity;
  }

  getSize(): number {
    return this.isFull ? this.capacity : this.head;
  }
}

// Singletons for high-frequency market data
// 10,000 ticks is enough for most short-term indicators (VWAP, RSI) without bloating RAM
export const tickBuffer = new CircularBuffer<any>(10000);
export const depthBuffer = new CircularBuffer<any>(1000);
