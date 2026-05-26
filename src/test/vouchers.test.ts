import { describe, expect, it } from 'vitest';
import { calculateExpiryDate } from '../lib/vouchers';

describe('calculateExpiryDate', () => {
  it('10회권은 구매일로부터 1개월 후 만료', () => {
    expect(calculateExpiryDate('2026-05-27', 10)).toBe('2026-06-27');
  });

  it('20회권은 구매일로부터 2개월 후 만료', () => {
    expect(calculateExpiryDate('2026-05-27', 20)).toBe('2026-07-27');
  });

  it('30회권은 구매일로부터 3개월 후 만료', () => {
    expect(calculateExpiryDate('2026-05-27', 30)).toBe('2026-08-27');
  });

  it('월말 처리 — 1월 31일 + 1개월은 2월 말일', () => {
    expect(calculateExpiryDate('2026-01-31', 10)).toBe('2026-02-28');
  });
});
