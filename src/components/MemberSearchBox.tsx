interface Props {
  value: string;
  onChange: (s: string) => void;
}
export default function MemberSearchBox({ value, onChange }: Props) {
  return (
    <input
      autoFocus
      type="search"
      value={value}
      onChange={e=>onChange(e.target.value)}
      placeholder="이름 또는 전화번호 뒷자리 검색"
      className="w-full border rounded-lg px-3 py-2 mb-3"
    />
  );
}
