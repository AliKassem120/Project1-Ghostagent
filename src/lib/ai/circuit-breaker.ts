export class CircuitBreaker {
  private failures = 0;
  private lastFailure: number | null = null;
  private readonly threshold = 5;
  private readonly resetTimeoutMs = 30000;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  canExecute(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (Date.now() - (this.lastFailure || 0) > this.resetTimeoutMs) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }
    return true; // half-open
  }

  recordSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }
}

// Singleton per provider:
export const deepseekCircuit = new CircuitBreaker();
