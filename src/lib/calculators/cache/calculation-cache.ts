import type { QuoteId, QuoteCalculation } from '../types';

/**
 * Simple in-memory calculation cache stub.
 * A production implementation would use Redis or similar.
 */
export class CalculationCache {
  private store = new Map<string, QuoteCalculation>();

  async get(quoteId: QuoteId): Promise<QuoteCalculation | null> {
    return this.store.get(quoteId as string) ?? null;
  }

  async set(quoteId: QuoteId, result: QuoteCalculation): Promise<void> {
    this.store.set(quoteId as string, result);
  }

  async invalidate(quoteId: QuoteId): Promise<void> {
    this.store.delete(quoteId as string);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
