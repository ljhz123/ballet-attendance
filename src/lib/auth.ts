import { supabase } from './supabase';
import type { Member } from './types';

// 010-1234-5678 → 01012345678
export function normalizePhone(input: string): string {
  return input.replace(/[^0-9]/g, '');
}

// 전화번호를 Supabase Auth의 이메일로 매핑 (외부 노출 X)
function phoneToEmail(phone: string): string {
  return `${normalizePhone(phone)}@ballet.local`;
}

export async function signUpWithPhone(args: {
  phone: string;
  password: string;
  name: string;
}): Promise<Member> {
  const phone = normalizePhone(args.phone);
  const { data, error } = await supabase.auth.signUp({
    email: phoneToEmail(phone),
    password: args.password,
  });
  if (error) throw error;
  if (!data.user) throw new Error('signup returned no user');

  const { data: member, error: insErr } = await supabase
    .from('members')
    .insert({
      phone,
      name: args.name,
      role: 'member',
      status: 'pending',
      auth_user_id: data.user.id,
    })
    .select()
    .single();
  if (insErr) throw insErr;
  return member as Member;
}

export async function signInWithPhone(phone: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: phoneToEmail(phone),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  // scope: 'local'은 서버 호출 없이 바로 로컬 세션만 삭제 — 네트워크 끊겨도 즉시 동작
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // 무시: 어차피 아래에서 강제로 페이지 이동
  }
}

export async function getCurrentMember(): Promise<Member | null> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return null;
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('auth_user_id', session.session.user.id)
    .single();
  if (error) return null;
  return data as Member;
}
