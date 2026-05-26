import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="max-w-2xl mx-auto p-4">
      <Link to="/login" className="text-sm text-gray-500">← 돌아가기</Link>
      <h1 className="text-xl font-bold mt-4 mb-2">개인정보처리방침</h1>
      <p className="text-xs text-gray-500">시행일: 2026-05-27</p>

      <h2 className="font-semibold mt-4">1. 수집 항목</h2>
      <ul className="list-disc pl-5 text-sm">
        <li>이름, 전화번호 (가입 시)</li>
        <li>비밀번호 (암호화 저장, 평문 보관하지 않음)</li>
        <li>회원권 정보, 출석 이력 (수업 운영 목적)</li>
      </ul>

      <h2 className="font-semibold mt-4">2. 이용 목적</h2>
      <ul className="list-disc pl-5 text-sm">
        <li>회원 식별 및 인증</li>
        <li>회원권 잔여 횟수 관리, 만료일 안내</li>
        <li>출석체크 및 수업 운영</li>
      </ul>

      <h2 className="font-semibold mt-4">3. 보유 기간</h2>
      <p className="text-sm">회원 자격 종료(탈퇴/비활성화) 시 즉시 식별 정보 접근을 차단합니다. 회계 및 분쟁 대응을 위해 출석/회원권 이력은 최대 5년간 보관 후 파기합니다.</p>

      <h2 className="font-semibold mt-4">4. 제3자 제공</h2>
      <p className="text-sm">수집된 정보는 제3자에게 제공하지 않습니다. 단, 시스템 운영을 위해 Supabase 및 Vercel 클라우드를 통해 처리됩니다.</p>

      <h2 className="font-semibold mt-4">5. 이용자 권리</h2>
      <p className="text-sm">본인 정보 조회·수정·삭제를 원하시면 학원에 직접 문의해주세요.</p>

      <h2 className="font-semibold mt-4">6. 문의처</h2>
      <p className="text-sm">○○발레학원 (학원명·연락처를 학원 운영자가 직접 채워주세요)</p>
    </div>
  );
}
