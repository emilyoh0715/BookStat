import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { KeyRound, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import type { ChildAccount } from '../contexts/AuthContext';

interface ChildInfo {
  childId: string;
  childEmail: string;
  name: string;
  avatarEmoji: string;
}

interface Props {
  onContinueAsParent: () => void;
}

export default function ProfileSelector({ onContinueAsParent }: Props) {
  const { user, profile, signInAsChild } = useAuth();
  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [selectedChild, setSelectedChild] = useState<ChildInfo | null>(null);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_emoji')
        .eq('parent_id', user.id)
        .eq('is_child', true);

      if (!profileData || profileData.length === 0) {
        onContinueAsParent();
        return;
      }

      const { data: accounts } = await supabase
        .from('child_accounts')
        .select('child_user_id, child_email')
        .eq('parent_id', user.id);

      const emailMap = new Map((accounts ?? []).map(a => [a.child_user_id, a.child_email]));

      setChildren(profileData.map(p => ({
        childId: p.id,
        childEmail: emailMap.get(p.id) ?? '',
        name: p.display_name,
        avatarEmoji: p.avatar_emoji ?? '🧒',
      })));
      setLoadingChildren(false);
    };
    load();
  }, [user]);

  const handleChildLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild) return;
    setError('');
    setSigningIn(true);
    const child: ChildAccount = {
      childId: selectedChild.childId,
      childEmail: selectedChild.childEmail,
      name: selectedChild.name,
      avatarEmoji: selectedChild.avatarEmoji,
    };
    const { error } = await signInAsChild(child, pin);
    if (error) {
      setError('PIN이 올바르지 않아요.');
      setSigningIn(false);
    }
  };

  if (loadingChildren) return null;

  return (
    <div className="auth-screen">
      <div className="auth-card profile-selector-card">
        <div className="auth-logo">
          <img src="/logo-vertical.png" alt="북스탯" className="auth-logo-img" />
        </div>

        {!selectedChild ? (
          <>
            <p className="profile-selector-title">누구의 서재를 볼까요?</p>
            <div className="profile-selector-list">
              <button className="profile-selector-item" onClick={onContinueAsParent}>
                <span className="profile-selector-avatar-circle">
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} className="profile-selector-avatar-img" />
                    : (profile?.display_name?.[0] ?? '?').toUpperCase()}
                </span>
                <span className="profile-selector-name">{profile?.display_name}</span>
                <span className="profile-selector-badge">나</span>
              </button>

              {children.map(child => (
                <button
                  key={child.childId}
                  className="profile-selector-item child"
                  onClick={() => { setSelectedChild(child); setPin(''); setError(''); }}
                >
                  <span className="profile-selector-emoji">{child.avatarEmoji}</span>
                  <span className="profile-selector-name">{child.name}</span>
                  <span className="profile-selector-badge child-badge">자녀</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <form className="auth-form" onSubmit={handleChildLogin}>
            <button
              type="button"
              className="auth-back-btn"
              onClick={() => { setSelectedChild(null); setPin(''); setError(''); }}
            >
              <ArrowLeft size={16} /> 뒤로
            </button>
            <div className="child-selected-header">
              <span className="child-avatar large">{selectedChild.avatarEmoji}</span>
              <p className="child-selected-name">{selectedChild.name}</p>
            </div>
            <div className="auth-field">
              <KeyRound size={16} className="auth-field-icon" />
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                placeholder="PIN 번호 입력"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoFocus
              />
              <button type="button" className="auth-pw-toggle" onClick={() => setShowPin(v => !v)}>
                {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {error && <p className="auth-error">{error}</p>}
            <button
              type="submit"
              className="btn-primary auth-submit"
              disabled={signingIn || pin.length < 4}
            >
              {signingIn ? '확인 중...' : '로그인'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
