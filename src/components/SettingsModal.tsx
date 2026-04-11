import { useState } from 'react';
import { getAladinKey, setAladinKey } from '../services/claudeVocab';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { X, Key, Check, User, AtSign } from 'lucide-react';

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { profile, updateProfile } = useAuth();

  const [aladinKey, setAladinKeyState] = useState(getAladinKey());
  const [aladinSaved, setAladinSaved] = useState(false);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [handle, setHandle] = useState(profile?.handle ?? '');
  const [handleError, setHandleError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');

  const checkHandle = async (h: string) => {
    const cleaned = h.replace(/[^a-z0-9_]/gi, '').toLowerCase();
    setHandle(cleaned);
    setHandleError('');
    if (cleaned.length < 2) return;
    if (cleaned === profile?.handle) return; // 본인 핸들이면 중복 아님
    const { data } = await supabase.from('profiles').select('id').eq('handle', cleaned).maybeSingle();
    if (data) setHandleError('이미 사용 중인 핸들이에요.');
  };

  const handleSaveAladinKey = () => {
    setAladinKey(aladinKey.trim());
    setAladinSaved(true);
    setTimeout(() => setAladinSaved(false), 2000);
  };

  const handleSaveProfile = async () => {
    if (handleError) return;
    if (!displayName.trim()) { setProfileError('닉네임을 입력해주세요.'); return; }
    if (handle.length < 2) { setProfileError('핸들은 2자 이상이어야 해요.'); return; }
    setProfileSaving(true);
    setProfileError('');

    // 저장 직전 중복 재확인
    if (handle !== profile?.handle) {
      const { data } = await supabase.from('profiles').select('id').eq('handle', handle).maybeSingle();
      if (data) { setHandleError('이미 사용 중인 핸들이에요.'); setProfileSaving(false); return; }
    }

    const { error } = await updateProfile({ display_name: displayName.trim(), handle });
    if (error) {
      setProfileError(error);
    } else {
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    }
    setProfileSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>설정</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-form">

          {/* 프로필 */}
          <div className="settings-section">
            <h3 className="settings-section-title">프로필</h3>
            <div className="form-group">
              <label><User size={13} style={{ display: 'inline', marginRight: 4 }} />닉네임</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="닉네임"
                maxLength={20}
              />
            </div>
            <div className="form-group">
              <label><AtSign size={13} style={{ display: 'inline', marginRight: 4 }} />핸들</label>
              <input
                type="text"
                value={handle}
                onChange={e => checkHandle(e.target.value)}
                placeholder="handle (영문·숫자·_)"
                maxLength={20}
              />
              {handleError && <p style={{ fontSize: 12, color: 'var(--danger)', margin: '4px 0 0' }}>{handleError}</p>}
            </div>
            {profileError && <p style={{ fontSize: 12, color: 'var(--danger)', margin: '4px 0 0' }}>{profileError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveProfile}
                disabled={profileSaving || !!handleError}
              >
                {profileSaved ? <><Check size={15} /> 저장됨</> : profileSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>

          <div className="settings-divider" />

          {/* 알라딘 API */}
          <div className="settings-section">
            <h3 className="settings-section-title">API 설정</h3>
            <div className="form-group">
              <label><Key size={13} style={{ display: 'inline', marginRight: 4 }} />알라딘 TTBKey</label>
              <input
                type="password"
                value={aladinKey}
                onChange={e => setAladinKeyState(e.target.value)}
                placeholder="ttbxxxxxxxx"
                autoComplete="off"
              />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                한국 책 표지 검색에 사용됩니다.{' '}
                <a href="http://www.aladin.co.kr/ttb/wapi/wapireadme.aspx" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                  알라딘 Open API
                </a>에서 무료로 발급받을 수 있어요.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn-primary" onClick={handleSaveAladinKey}>
                {aladinSaved ? <><Check size={15} /> 저장됨</> : '저장'}
              </button>
            </div>
          </div>

          <div className="modal-footer" style={{ marginTop: 8 }}>
            <button type="button" className="btn-secondary" onClick={onClose}>닫기</button>
          </div>
        </div>
      </div>
    </div>
  );
}
