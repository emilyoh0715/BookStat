import { AuthContext } from './authStore';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  display_name: string;
  handle: string;
  avatar_url?: string;
  avatar_emoji?: string;
  full_name?: string;
  birth_date?: string;
  phone?: string;
  is_child?: boolean;
  parent_id?: string;
}

export interface ChildAccount {
  childId: string;
  childEmail: string;
  name: string;
  avatarEmoji: string;
  birthDate?: string;
}

const CHILDREN_STORAGE_KEY = 'bookstat-children';

function loadStoredChildren(): ChildAccount[] {
  try {
    return JSON.parse(localStorage.getItem(CHILDREN_STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function saveStoredChildren(children: ChildAccount[]) {
  localStorage.setItem(CHILDREN_STORAGE_KEY, JSON.stringify(children));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [connectionError, setConnectionError] = useState<string | null>(null);
  const profileRequest = useRef(0);

  const fetchProfile = useCallback(async (userId: string) => {
    const request = ++profileRequest.current;
    try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    if (request === profileRequest.current) { setProfile(data ?? null); setConnectionError(null); }
    } catch {
      if (request === profileRequest.current) setConnectionError('프로필에 연결하지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) throw error;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    }).catch(() => { setConnectionError('로그인 서버에 연결하지 못했어요. 다시 시도해주세요.'); setLoading(false); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) queueMicrotask(() => { void fetchProfile(session.user.id); });
      else { profileRequest.current++; setProfile(null); }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // ── 이메일 로그인/가입 ──────────────────────────────
  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUpWithEmail = async (email: string, password: string, fullName?: string, birthDate?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, birth_date: birthDate },
      },
    });
    if (error) return { error: error.message };
    if (data.user && data.user.identities?.length === 0) {
      return { error: '이미 가입된 이메일이에요. 로그인 탭에서 로그인해주세요.' };
    }
    // 프로필에 이름/생년월일 저장 (이메일 확인 후 로그인 시점에도 저장됨)
    if (data.user && fullName) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName,
        birth_date: birthDate || null,
      });
    }
    return { error: null };
  };

  // ── 휴대폰 OTP ──────────────────────────────────────
  const sendPhoneOtp = async (phone: string) => {
    const normalized = normalizePhone(phone);
    const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
    return { error: error?.message ?? null };
  };

  const verifyPhoneOtp = async (phone: string, token: string, fullName?: string, birthDate?: string) => {
    const normalized = normalizePhone(phone);
    const { data, error } = await supabase.auth.verifyOtp({
      phone: normalized,
      token,
      type: 'sms',
    });
    if (error) return { error: error.message };
    // 프로필에 이름/생년월일/전화번호 저장
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName || null,
        birth_date: birthDate || null,
        phone: normalized,
      });
    }
    return { error: null };
  };

  // ── 소셜 ─────────────────────────────────────────────
  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const signInWithKakao = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: window.location.origin },
    });
  };

  // ── 자녀 계정 ────────────────────────────────────────
  const createChildAccount = async (name: string, pin: string, birthDate: string, avatarEmoji = '🧒', legacyUserId?: string, nickname?: string) => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) return { error: '로그인이 필요합니다.' };

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const res = await fetch(`${supabaseUrl}/functions/v1/create-child-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSession.access_token}`,
      },
      body: JSON.stringify({ name, pin, birthDate, avatarEmoji, legacyUserId, nickname }),
    });

    const json = await res.json() as { error?: string; childId?: string; childEmail?: string; name?: string; avatarEmoji?: string; migratedBooks?: number };
    if (!res.ok || json.error) return { error: json.error ?? '자녀 계정 생성에 실패했어요.' };

    const child: ChildAccount = {
      childId: json.childId!,
      childEmail: json.childEmail!,
      name: json.name!,
      avatarEmoji: json.avatarEmoji ?? '🧒',
      birthDate,
    };

    // 로컬에 저장 (이 기기에서 자녀 로그인 가능)
    const existing = loadStoredChildren();
    saveStoredChildren([...existing.filter(c => c.childId !== child.childId), child]);

    return { error: null, child, migratedBooks: json.migratedBooks ?? 0 };
  };

  const signInAsChild = async (child: ChildAccount, pin: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: child.childEmail,
      password: pin,
    });
    return { error: error?.message ?? null };
  };

  const getStoredChildren = (): ChildAccount[] => loadStoredChildren();

  const removeStoredChild = (childId: string) => {
    saveStoredChildren(loadStoredChildren().filter(c => c.childId !== childId));
  };

  // ── 공통 ─────────────────────────────────────────────
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: '로그인이 필요합니다.' };
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, ...profile, ...updates });
    if (!error) await fetchProfile(user.id);
    return { error: error?.message ?? null };
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{
      connectionError,
      session, user, profile, loading,
      signInWithEmail, signUpWithEmail,
      sendPhoneOtp, verifyPhoneOtp,
      signInWithGoogle, signInWithKakao,
      createChildAccount, signInAsChild, getStoredChildren, removeStoredChild,
      signOut, updateProfile, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// 010-1234-5678 → +821012345678
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('82')) return `+${digits}`;
  if (digits.startsWith('0')) return `+82${digits.slice(1)}`;
  return `+82${digits}`;
}
