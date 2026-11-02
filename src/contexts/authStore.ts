import { createContext, useContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile, ChildAccount } from './AuthContext';

interface AuthContextValue {
  connectionError: string | null;
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
  createChildAccount: (name: string, pin: string, birthDate: string, avatarEmoji?: string, legacyUserId?: string, nickname?: string) => Promise<{ error: string | null; child?: ChildAccount; migratedBooks?: number }>;
  signInAsChild: (child: ChildAccount, pin: string) => Promise<{ error: string | null }>;
  getStoredChildren: () => ChildAccount[];
  removeStoredChild: (childId: string) => void;
  // 공통
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

