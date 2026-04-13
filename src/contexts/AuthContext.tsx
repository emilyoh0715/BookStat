import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  // 이메일 인증
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, fullName?: string, birthDate?: string) => Promise<{ error: string | null }>;
  // 휴대폰 OTP
  sendPhoneOtp: (phone: string) => Promise<{ error: string | null }>;
  verifyPhoneOtp: (phone: string, token: string, fullName?: string, birthDate?: string) => Promise<{ error: string | null }>;
  // 소셜
  signInWithGoogle: () => Promise<void>;
  signInWithKakao: () => Promise<void>;
  // 자녀 계정
  createChildAccount: (name: string, pin: string, birthDate: string, avatarEmoji?: string) => Promise<{ error: string | null; child?: ChildAccount }>;
  signInAsChild: (child: ChildAccount, pin: string) => Promise<{ error: string | null }>;
  getStoredChildren: () => ChildAccount[];
  removeStoredChild: (childId: string) => void;
  // 공통
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data ?? null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

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
  const createChildAccount = async (name: string, pin: string, birthDate: string, avatarEmoji = '🧒') => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) return { error: '로그인이 필요합니다.' };

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const res = await fetch(`${supabaseUrl}/functions/v1/create-child-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSession.access_token}`,
      },
      body: JSON.stringify({ name, pin, birthDate, avatarEmoji }),
    });

    const json = await res.json() as { error?: string; childId?: string; childEmail?: string; name?: string; avatarEmoji?: string };
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

    // DB에도 저장 (다른 기기에서도 복원 가능)
    if (user) {
      await supabase.from('child_accounts').insert({
        parent_id: user.id,
        child_user_id: child.childId,
        name: child.name,
        avatar_emoji: child.avatarEmoji,
        birth_date: birthDate || null,
        child_email: child.childEmail,
      });
    }

    return { error: null, child };
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

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// 010-1234-5678 → +821012345678
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('82')) return `+${digits}`;
  if (digits.startsWith('0')) return `+82${digits.slice(1)}`;
  return `+82${digits}`;
}
