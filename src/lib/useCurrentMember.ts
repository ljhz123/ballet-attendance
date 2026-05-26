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

    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { member, loading };
}
