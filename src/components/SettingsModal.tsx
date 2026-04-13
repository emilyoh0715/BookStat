import { useState } from 'react';
import { getAladinKey, setAladinKey } from '../services/claudeVocab';
import { useAuth, type ChildAccount } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { X, Key, Check, User, AtSign, Baby, Plus, Trash2, Eye, EyeOff } from 'lucide-react';

const AVATAR_OPTIONS = ['🧒', '👦', '👧', '🧑', '👩', '👨', '🐣', '🦊', '🐬', '🦄', '🐱', '🐶'];

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { profile, updateProfile, createChildAccount, getStoredChildren, removeStoredChild } = useAuth();

  const [aladinKey, setAladinKeyState] = useState(getAladinKey());
  const [aladinSaved, setAladinSaved] = useState(false);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [handle, setHandle] = useState(profile?.handle ?? '');
  const [handleError, setHandleError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');

  // 자녀 계정 추가
  const [showAddChild, setShowAddChild] = useState(false);
  const [childName, setChildName] = useState('');
  const [childBirthDate, setChildBirthDate] = useState('');
  const [childPin, setChildPin] = useState('');
  const [childPinConfirm, setChildPinConfirm] = useState('');
  const [childAvatar, setChildAvatar] = useState('🧒');
  const [showChildPin, setShowChildPin] = useState(false);
  const [childSaving, setChildSaving] = useState(false);
  const [childError, setChildError] = useState('');
  const [childSuccess, setChildSuccess] = useState('');
  const [storedChildren, setStoredChildren] = useState<ChildAccount[]>(getStoredChildren());

  const checkHandle = async (h: string) => {
    const cleaned = h.replace(/[^a-z0-9_]/gi, '').toLowerCase();
    setHandle(cleaned);
    setHandleError('');
    if (cleaned.length < 2) return;
    if (cleaned === profile?.handle) return;
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
    setProfileSaving(true); setProfileError('');
    if (handle !== profile?.handle) {
      const { data } = await supabase.from('profiles').select('id').eq('handle', handle).maybeSingle();
      if (data) { setHandleError('이미 사용 중인 핸들이에요.'); setProfileSaving(false); return; }
    }
    const { error } = await updateProfile({ display_name: displayName.trim(), handle });
    if (error) { setProfileError(error); } else { setProfileSaved(true); setTimeout(() => setProfileSaved(false), 2000); }
    setProfileSaving(false);
  };

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    setChildError('');
    if (!childName.trim()) { setChildError('이름을 입력해주세요.'); return; }
    if (childPin.length < 4) { setChildError('PIN은 4자리 이상이어야 해요.'); return; }
    if (childPin !== childPinConfirm) { setChildError('PIN이 일치하지 않아요.'); return; }
    setChildSaving(true);
    const { error, child } = await createChildAccount(childName, childPin, childBirthDate, childAvatar);
    if (error) {
      setChildError(error);
    } else if (child) {
      setChildSuccess(`${child.name} 계정이 만들어졌어요!`);
      setStoredChildren(getStoredChildren());
      setChildName(''); setChildBirthDate(''); setChildPin(''); setChildPinConfirm(''); setChildAvatar('🧒');
      setTimeout(() => { setChildSuccess(''); setShowAddChild(false); }, 2000);
    }
    setChildSaving(false);
  };

  const handleRemoveChild = (childId: string) => {
    if (!confirm('이 기기에서 자녀 계정을 삭제할까요?\n자녀의 책 데이터는 유지됩니다.')) return;
    removeStoredChild(childId);
    setStoredChildren(getStoredChildren());
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
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="닉네임" maxLength={20} />
            </div>
            <div className="form-group">
              <label><AtSign size={13} style={{ display: 'inline', marginRight: 4 }} />핸들</label>
              <input type="text" value={handle} onChange={e => checkHandle(e.target.value)} placeholder="handle (영문·숫자·_)" maxLength={20} />
              {handleError && <p style={{ fontSize: 12, color: 'var(--danger)', margin: '4px 0 0' }}>{handleError}</p>}
            </div>
            {profileError && <p style={{ fontSize: 12, color: 'var(--danger)', margin: '4px 0 0' }}>{profileError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn-primary" onClick={handleSaveProfile} disabled={profileSaving || !!handleError}>
                {profileSaved ? <><Check size={15} /> 저장됨</> : profileSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>

          <div className="settings-divider" />

          {/* 자녀 계정 */}
          {!profile?.is_child && (
            <>
              <div className="settings-section">
                <h3 className="settings-section-title"><Baby size={15} style={{ display: 'inline', marginRight: 6 }} />자녀 계정</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                  자녀가 이름과 PIN으로 이 기기에서 로그인할 수 있어요.
                </p>

                {/* 등록된 자녀 목록 */}
                {storedChildren.length > 0 && (
                  <div className="child-account-list">
                    {storedChildren.map(child => (
                      <div key={child.childId} className="child-account-item">
                        <span className="child-avatar">{child.avatarEmoji}</span>
                        <span className="child-account-name">{child.name}</span>
                        <button
                          className="icon-btn danger-icon"
                          onClick={() => handleRemoveChild(child.childId)}
                          title="이 기기에서 삭제"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 자녀 추가 폼 */}
                {showAddChild ? (
                  <form className="child-add-form" onSubmit={handleAddChild}>
                    <p style={{ fontWeight: 600, marginBottom: 10 }}>자녀 계정 추가</p>

                    <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>아바타</label>
                    <div className="avatar-picker">
                      {AVATAR_OPTIONS.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          className={`avatar-option ${childAvatar === emoji ? 'selected' : ''}`}
                          onClick={() => setChildAvatar(emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    <div className="form-group" style={{ marginTop: 8 }}>
                      <label>이름</label>
                      <input placeholder="자녀 이름" value={childName} onChange={e => setChildName(e.target.value)} maxLength={20} required />
                    </div>
                    <div className="form-group">
                      <label>생년월일 (선택)</label>
                      <input type="date" value={childBirthDate} onChange={e => setChildBirthDate(e.target.value)} max={new Date().toISOString().split('T')[0]} />
                    </div>
                    <div className="form-group">
                      <label>PIN (4~6자리 숫자)</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showChildPin ? 'text' : 'password'}
                          inputMode="numeric"
                          placeholder="PIN 설정"
                          value={childPin}
                          onChange={e => setChildPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          required
                        />
                        <button type="button" className="auth-pw-toggle" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }} onClick={() => setShowChildPin(v => !v)}>
                          {showChildPin ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>PIN 확인</label>
                      <input
                        type={showChildPin ? 'text' : 'password'}
                        inputMode="numeric"
                        placeholder="PIN 다시 입력"
                        value={childPinConfirm}
                        onChange={e => setChildPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        required
                      />
                    </div>

                    {childError && <p style={{ fontSize: 12, color: 'var(--danger)', margin: '4px 0' }}>{childError}</p>}
                    {childSuccess && <p style={{ fontSize: 12, color: 'var(--success)', margin: '4px 0' }}>{childSuccess}</p>}

                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowAddChild(false); setChildError(''); }}>
                        취소
                      </button>
                      <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={childSaving}>
                        {childSaving ? '생성 중...' : '계정 만들기'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    onClick={() => setShowAddChild(true)}
                  >
                    <Plus size={15} /> 자녀 계정 추가
                  </button>
                )}
              </div>

              <div className="settings-divider" />
            </>
          )}

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
