import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { User, AtSign, Link, Calendar } from 'lucide-react';

const LEGACY_USERS = [
  { id: 'mom', label: '엄마 👩' },
  { id: 'dad', label: '아빠 👨' },
  { id: 'suyeon', label: '수연 👧' },
];

export default function ProfileSetup() {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.full_name ?? '');
  const [handle, setHandle] = useState('');
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? '');
  const [legacyClaim, setLegacyClaim] = useState<string>('');
  const [handleError, setHandleError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const checkHandle = async (h: string) => {
    setHandle(h);
    setHandleError('');
    if (h.length < 2) return;
    const { data } = await supabase.from('profiles').select('id').eq('handle', h).single();
    if (data) setHandleError('이미 사용 중인 핸들이에요.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (handleError) return;
    setError('');
    setLoading(true);

    const { error: profileError } = await supabase.from('profiles').insert({
      id: user.id,
      display_name: displayName.trim(),
      handle: handle.trim().toLowerCase(),
      full_name: displayName.trim(),
      birth_date: birthDate || null,
    });
    if (profileError) { setError(profileError.message); setLoading(false); return; }

    if (legacyClaim) {
      await supabase.from('books').update({ user_id: user.id }).eq('user_id', legacyClaim);
    }

    await refreshProfile();
    setLoading(false);
  };

  return (
    <div className="auth-screen">
      <div className="auth-card" style={{ maxWidth: 440 }}>
        <div className="auth-logo">
          <img src="/logo.png" alt="북스탯" />
          <span>프로필 설정</span>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
          처음이시네요! 닉네임과 핸들을 설정해주세요.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <User size={16} className="auth-field-icon" />
            <input
              placeholder="닉네임 (예: 엄마, 홍길동)"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
              maxLength={20}
            />
          </div>

          <div className="auth-field">
            <AtSign size={16} className="auth-field-icon" />
            <input
              placeholder="핸들 (예: mom2026) — 가족 검색에 사용"
              value={handle}
              onChange={e => checkHandle(e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase())}
              required
              minLength={2}
              maxLength={20}
            />
          </div>
          {handleError && <p className="auth-error">{handleError}</p>}

          <div className="auth-field">
            <Calendar size={16} className="auth-field-icon" />
            <input
              type="date"
              placeholder="생년월일 (선택)"
              value={birthDate}
              onChange={e => setBirthDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="form-group" style={{ marginTop: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
              <Link size={14} /> 기존 서재 데이터 연결 (선택)
            </label>
            <select value={legacyClaim} onChange={e => setLegacyClaim(e.target.value)} style={{ marginTop: 6 }}>
              <option value="">연결 안 함</option>
              {LEGACY_USERS.map(u => (
                <option key={u.id} value={u.id}>{u.label} 서재 데이터 가져오기</option>
              ))}
            </select>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              기존에 입력된 책 데이터를 내 계정으로 이전할 수 있어요.
            </p>
          </div>

          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="btn-primary auth-submit" disabled={loading || !!handleError}>
            {loading ? '설정 중...' : '시작하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
