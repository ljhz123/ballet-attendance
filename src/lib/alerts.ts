import { differenceInCalendarDays, parseISO } from 'date-fns';

export type Alert =
  | { kind: 'no_voucher' }
  | { kind: 'expiring_soon'; daysLeft: number; expiry: string }
  | { kind: 'low_count'; remaining: number }
  | { kind: 'checked_today'; at: string };

export interface ActiveVoucher {
  id: string;
  remaining_count: number;
  expiry_date: string;
}

export interface AlertContext {
  today: string;
  activeVouchers: ActiveVoucher[];
  todayAttendance: { checked_at: string } | null;
}

const EXPIRY_WARN_DAYS = 3;
const LOW_COUNT_THRESHOLD = 2;

export function computeAlerts(ctx: AlertContext): Alert[] {
  const alerts: Alert[] = [];

  if (ctx.activeVouchers.length === 0) {
    alerts.push({ kind: 'no_voucher' });
    return ctx.todayAttendance
      ? [...alerts, { kind: 'checked_today', at: ctx.todayAttendance.checked_at }]
      : alerts;
  }

  const soonest = [...ctx.activeVouchers].sort(
    (a, b) => a.expiry_date.localeCompare(b.expiry_date)
  )[0];

  const daysLeft = differenceInCalendarDays(parseISO(soonest.expiry_date), parseISO(ctx.today));
  if (daysLeft <= EXPIRY_WARN_DAYS && daysLeft >= 0) {
    alerts.push({ kind: 'expiring_soon', daysLeft, expiry: soonest.expiry_date });
  }

  const totalRemaining = ctx.activeVouchers.reduce((sum, v) => sum + v.remaining_count, 0);
  if (totalRemaining <= LOW_COUNT_THRESHOLD) {
    alerts.push({ kind: 'low_count', remaining: totalRemaining });
  }

  if (ctx.todayAttendance) {
    alerts.push({ kind: 'checked_today', at: ctx.todayAttendance.checked_at });
  }

  return alerts;
}
