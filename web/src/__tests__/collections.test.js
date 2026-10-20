import { describe, it, expect } from 'vitest';
import { salesQueryPlan } from '../lib/collections';

describe('salesQueryPlan', () => {
  it('defaults to active-only sales sorted by businessDate desc', () => {
    const plan = salesQueryPlan();
    expect(plan.filters).toEqual([{ field: 'isActive', op: '==', value: true }]);
    expect(plan.sort).toEqual({ field: 'businessDate', direction: 'desc' });
  });

  it('omits the isActive filter when activeOnly is false', () => {
    const plan = salesQueryPlan({ activeOnly: false });
    expect(plan.filters).toEqual([]);
    expect(plan.sort).toEqual({ field: 'businessDate', direction: 'desc' });
  });

  it('scopes to a user when userId is provided', () => {
    const plan = salesQueryPlan({ userId: 'seller1' });
    expect(plan.filters).toEqual([
      { field: 'isActive', op: '==', value: true },
      { field: 'userId', op: '==', value: 'seller1' },
    ]);
  });

  it('adds an inclusive businessDate range when start and end dates are given', () => {
    const plan = salesQueryPlan({ activeOnly: true, startDate: '2026-10-01', endDate: '2026-10-18' });
    expect(plan.filters).toEqual([
      { field: 'isActive', op: '==', value: true },
      { field: 'businessDate', op: '>=', value: '2026-10-01' },
      { field: 'businessDate', op: '<=', value: '2026-10-18' },
    ]);
  });

  it('supports open-ended ranges', () => {
    expect(salesQueryPlan({ activeOnly: false, startDate: '2026-10-01' }).filters).toEqual([
      { field: 'businessDate', op: '>=', value: '2026-10-01' },
    ]);
    expect(salesQueryPlan({ activeOnly: false, endDate: '2026-10-18' }).filters).toEqual([
      { field: 'businessDate', op: '<=', value: '2026-10-18' },
    ]);
  });

  it('combines user scoping with a date range for a single seller period', () => {
    const plan = salesQueryPlan({ userId: 'seller1', startDate: '2026-10-01', endDate: '2026-10-31' });
    expect(plan.filters).toEqual([
      { field: 'isActive', op: '==', value: true },
      { field: 'userId', op: '==', value: 'seller1' },
      { field: 'businessDate', op: '>=', value: '2026-10-01' },
      { field: 'businessDate', op: '<=', value: '2026-10-31' },
    ]);
  });

  it('treats an empty userId as absent', () => {
    const plan = salesQueryPlan({ userId: '' });
    expect(plan.filters).toEqual([{ field: 'isActive', op: '==', value: true }]);
  });
});
