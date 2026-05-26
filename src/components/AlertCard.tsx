import type { Alert } from '../lib/alerts';

function render(alert: Alert) {
  switch (alert.kind) {
    case 'no_voucher':
      return { icon: '🛍️', text: '활성 회원권이 없어요. 원장님께 결제 후 등록 부탁드려요.' };
    case 'expiring_soon':
      return alert.daysLeft === 0
        ? { icon: '⚠️', text: `회원권이 오늘 만료돼요 (${alert.expiry})` }
        : { icon: '⚠️', text: `회원권이 ${alert.daysLeft}일 후 만료돼요 (${alert.expiry})` };
    case 'low_count':
      return { icon: '⚠️', text: `남은 횟수가 ${alert.remaining}회 남았어요` };
    case 'checked_today':
      return { icon: '✅', text: '오늘 출석체크 됐어요' };
  }
}

export default function AlertCard({ alert }: { alert: Alert }) {
  const { icon, text } = render(alert);
  return (
    <div className="bg-white border border-pink-200 rounded-xl px-4 py-3 flex items-start gap-3 text-sm">
      <span className="text-lg">{icon}</span>
      <span className="text-gray-800">{text}</span>
    </div>
  );
}
