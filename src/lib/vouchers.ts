import { addMonths, format, parseISO } from 'date-fns';

export function calculateExpiryDate(purchaseDate: string, totalCount: number): string {
  const months = totalCount / 10;
  const start = parseISO(purchaseDate);
  const candidate = addMonths(start, months);
  // date-fns의 addMonths는 1/31 + 1month → 2/28 같은 월말 처리를 자동 수행
  return format(candidate, 'yyyy-MM-dd');
}
