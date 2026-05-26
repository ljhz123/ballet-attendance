import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

const CHECKIN_URL = `${window.location.origin}/checkin`;

export default function AdminQR() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, CHECKIN_URL, {
        width: 400,
        margin: 2,
        color: { dark: '#831843', light: '#ffffff' },
      });
    }
  }, []);

  return (
    <div className="max-w-md mx-auto text-center print:max-w-none">
      <h1 className="text-xl font-bold mb-2 print:hidden">출석체크 QR 코드</h1>
      <p className="text-sm text-gray-600 mb-4 print:hidden">
        이 페이지를 인쇄해서 학원 입구에 붙여주세요. 회원이 폰 카메라로 스캔하면 자동으로 출석체크됩니다.
      </p>

      <div className="bg-white border-4 border-pink-200 rounded-2xl p-6 print:border-pink-700 print:border-2">
        <h2 className="text-2xl font-bold text-pink-700 mb-2">🩰 발레학원 출석</h2>
        <p className="text-sm text-gray-700 mb-4">폰 카메라로 QR을 찍어주세요</p>
        <canvas ref={canvasRef} className="mx-auto" />
        <p className="text-xs text-gray-500 mt-4">{CHECKIN_URL}</p>
        <p className="text-xs text-gray-600 mt-2">
          QR이 안 열리면 위 주소를 직접 입력해주세요
        </p>
      </div>

      <button
        onClick={() => window.print()}
        className="mt-6 bg-pink-500 text-white px-6 py-2 rounded-lg font-semibold print:hidden"
      >
        🖨️ 인쇄하기
      </button>
    </div>
  );
}
