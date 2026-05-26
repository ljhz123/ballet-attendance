import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { getCurrentMember } from './auth';
import type { Member } from './types';

export function useCurrentMember() {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const m = await getCurrentMember();
      if (!cancelled) {
        setMember(m);
        setLoading(false);
      }
    }
    load();

    // 안전장치: 모바일 네트워크 등으로 인증 확인이 5초 안에 안 끝나면 로딩 종료 → 로그인 화면으로
    const timeoutId = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 5000);

    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      sub.subscription.unsubscribe();
    };
  }, []);

  return { member, loading };
}
