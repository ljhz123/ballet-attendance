import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import { useCurrentMember } from '../lib/useCurrentMember';

type Status =
  | { kind: 'scanning' }
  | { kind: 'checking' }
  | { kind: 'success'; remaining: number; alreadyChecked: boolean }
  | { kind: 'error'; message: string };

export default function Scan() {
  const { member } = useCurrentMember();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>({ kind: 'scanning' });
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const elementId = 'qr-scanner-container';

  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode(elementId);
    scannerRef.current = scanner;

    async function start() {
      try {
        await scanner.start(
          { facingMode: 'environment' }, // 후면 카메라 우선
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async () => {
            if (cancelled) return;
            // 어떤 QR을 스캔했든 출석체크 진행 (내용은 검증 안 함)
            try {
              await scanner.stop();
            } catch { /* 이미 멈춤 */ }
            if (cancelled) return;
            setStatus({ kind: 'checking' });

            const { data, error } = await supabase.rpc('self_check_attendance');
            if (cancelled) return;
            if (error) {
              let msg = error.message;
              if (msg.includes('no active voucher')) msg = '활성 회원권이 없어요. 원장님께 문의해주세요.';
              else if (msg.includes('not authenticated')) msg = '로그인이 만료됐어요. 다시 로그인해주세요.';
              setStatus({ kind: 'error', message: msg });
              return;
            }
            const row = (data as Array<{ remaining_after: number; already_checked_today: boolean }>)[0];
            setStatus({
              kind: 'success',
              remaining: row.remaining_after,
              alreadyChecked: row.already_checked_today,
            });
            // 2.5초 후 /me로 복귀
            setTimeout(() => {
              if (!cancelled) navigate('/me', { replace: true });
            }, 2500);
          },
          () => { /* 스캔 실패 콜백 — 무시 */ }
        );
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setStatus({
          kind: 'error',
          message: msg.includes('Permission') || msg.includes('NotAllowed')
            ? '카메라 권한을 허용해주세요. 폰 설정 → 앱 → 권한에서 카메라 ON'
            : '카메라를 열 수 없어요: ' + msg,
        });
      }
    }
    start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s && s.isScanning) {
        s.stop().catch(() => { /* 이미 멈춤 */ });
      }
    };
  }, [navigate]);

  return (
    <div className="min-h-full flex flex-col bg-black">
      <header className="bg-pink-600 text-white px-4 py-3 flex justify-between items-center">
        <span className="font-bold">🩰 QR 출석체크</span>
        <button onClick={() => navigate('/me')} className="text-sm underline">취소</button>
      </header>

      {/* Scanner / Result area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {status.kind === 'scanning' && (
          <>
            <p className="text-white text-sm mb-4">학원 입구의 QR 코드를 비춰주세요</p>
            <div id={elementId} className="w-full max-w-md bg-black rounded-lg overflow-hidden" />
          </>
        )}

        {status.kind === 'checking' && (
          <div className="bg-white rounded-2xl p-8 text-center w-full max-w-sm">
            <div className="text-5xl mb-3 animate-pulse">⏳</div>
            <p className="text-gray-600">출석 처리 중...</p>
          </div>
        )}

        {status.kind === 'success' && (
          <div className="bg-white rounded-2xl p-8 text-center w-full max-w-sm">
            <div className="text-6xl mb-3">{status.alreadyChecked ? '✓' : '✅'}</div>
            <h1 className="text-2xl font-bold mb-2">
              {status.alreadyChecked ? '이미 오늘 출석했어요' : '출석 완료!'}
            </h1>
            <p className="text-gray-600">
              {member?.name}님, 남은 횟수 <span className="font-bold text-pink-600">{status.remaining}회</span>
            </p>
            <p className="text-xs text-gray-400 mt-3">곧 메인으로 돌아갑니다...</p>
          </div>
        )}

        {status.kind === 'error' && (
          <div className="bg-white rounded-2xl p-8 text-center w-full max-w-sm">
            <div className="text-5xl mb-3">⚠️</div>
            <h1 className="text-xl font-bold mb-2">출석 실패</h1>
            <p className="text-red-600 mb-4 text-sm">{status.message}</p>
            <button onClick={() => navigate('/me')} className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg">내 정보로</button>
          </div>
        )}
      </div>
    </div>
  );
}
