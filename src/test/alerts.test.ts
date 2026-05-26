import { describe, expect, it } from 'vitest';
import { computeAlerts, type AlertContext } from '../lib/alerts';

const today = '2026-05-27';

function ctx(overrides: Partial<AlertContext> = {}): AlertContext {
  return {
    today,
    activeVouchers: [],
    todayAttendance: null,
    ...overrides,
  };
}

describe('computeAlerts', () => {
  it('활성 회원권 없으면 재구매 안내', () => {
    const alerts = computeAlerts(ctx());
    expect(alerts).toEqual([{ kind: 'no_voucher' }]);
  });

  it('만료까지 3일 이하면 만료임박 알림', () => {
    const alerts = computeAlerts(ctx({
      activeVouchers: [{ id: 'v1', remaining_count: 5, expiry_date: '2026-05-30' }],
    }));
    expect(alerts).toContainEqual({ kind: 'expiring_soon', daysLeft: 3, expiry: '2026-05-30' });
  });

  it('만료 당일이면 daysLeft 0으로 표시', () => {
    const alerts = computeAlerts(ctx({
      activeVouchers: [{ id: 'v1', remaining_count: 5, expiry_date: '2026-05-27' }],
    }));
    expect(alerts).toContainEqual({ kind: 'expiring_soon', daysLeft: 0, expiry: '2026-05-27' });
  });

  it('잔여 2회 이하면 잔여 부족 알림', () => {
    const alerts = computeAlerts(ctx({
      activeVouchers: [{ id: 'v1', remaining_count: 2, expiry_date: '2026-07-01' }],
    }));
    expect(alerts).toContainEqual({ kind: 'low_count', remaining: 2 });
  });

  it('오늘 출석 기록이 있으면 출석완료 알림', () => {
    const alerts = computeAlerts(ctx({
      activeVouchers: [{ id: 'v1', remaining_count: 10, expiry_date: '2026-07-01' }],
      todayAttendance: { checked_at: '2026-05-27T10:00:00Z' },
    }));
    expect(alerts).toContainEqual({ kind: 'checked_today', at: '2026-05-27T10:00:00Z' });
  });

  it('여러 조건 동시 만족 — 모두 표시', () => {
    const alerts = computeAlerts(ctx({
      activeVouchers: [{ id: 'v1', remaining_count: 1, expiry_date: '2026-05-29' }],
      todayAttendance: { checked_at: '2026-05-27T10:00:00Z' },
    }));
    expect(alerts.map(a => a.kind).sort()).toEqual(
      ['checked_today', 'expiring_soon', 'low_count'].sort()
    );
  });
});
