import type { Voucher } from '../lib/types';
import { differenceInCalendarDays, parseISO } from 'date-fns';

export default function VoucherCard({ voucher, today }: { voucher: Voucher; today: string }) {
  const daysLeft = differenceInCalendarDays(parseISO(voucher.expiry_date), parseISO(today));
  return (
    <div className="bg-gradient-to-br from-pink-100 to-pink-50 rounded-2xl p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-gray-600">남은 횟수</span>
        <span className="text-xs text-gray-500">총 {voucher.total_count}회</span>
      </div>
      <div className="text-4xl font-bold text-pink-700 my-2">{voucher.remaining_count}<span className="text-lg ml-1">회</span></div>
      <hr className="my-3 border-pink-200" />
      <div className="text-sm text-gray-700">
        <div>만료일 <span className="font-semibold">{voucher.expiry_date}</span> {daysLeft >= 0 ? `(D-${daysLeft})` : '(만료됨)'}</div>
        <div className="text-xs text-gray-500 mt-1">다음 결제 예정일: {voucher.expiry_date}</div>
      </div>
    </div>
  );
}
