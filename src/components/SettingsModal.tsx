import { useState, useEffect } from 'react';
import { getAladinKey, getApiKey, setAladinKey, setApiKey } from '../services/geminiAi';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../useTheme';
import { supabase } from '../lib/supabase';
import { X, Key, Check, User, AtSign, Baby, Plus, Trash2, Eye, EyeOff, Pencil, Sun, Moon } from 'lucide-react';

const AVATAR_OPTIONS = ['🧒', '👦', '👧', '🧑', '👩', '👨', '🐣', '🦊', '🐬', '🦄', '🐱', '🐶'];

interface DbChild {
  child_user_id: string;
  full_name: string;
  nickname: string;
  avatar_emoji: string;
  birth_date?: string;
}

export default function SettingsModal({ onClose, onGroupChange }: { onClose: () => void; onGroupChange?: () => void }) {
  const { profile, user, updateProfile, createChildAccount, removeStoredChild } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [aladinKey, setAladinKeyState] = useState(getAladinKey());
  const [aladinSaved, setAladinSaved] = useState(false);
  const [geminiKey, setGeminiKeyState] = useState(getApiKey());
  const [geminiSaved, setGeminiSaved] = useState(false);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [handle, setHandle] = useState(profile?.handle ?? '');
  const [handleError, setHandleError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');

  // 자녀 계정 추가
  const [showAddChild, setShowAddChild] = useState(false);
  const [childName, setChildName] = useState('');
  const [childNickname, setChildNickname] = useState('');
  const [childBirthDate, setChildBirthDate] = useState('');
  const [childPin, setChildPin] = useState('');
  const [childPinConfirm, setChildPinConfirm] = useState('');
  const [childAvatar, setChildAvatar] = useState('🧒');
  const [childLegacyId, setChildLegacyId] = useState('');
  const [showChildPin, setShowChildPin] = useState(false);
  const [childSaving, setChildSaving] = useState(false);
  const [childError, setChildError] = useState('');
  const [childSuccess, setChildSuccess] = useState('');

  // DB 기반 자녀 목록 (localStorage 대신 child_accounts 테이블)
  const [dbChildren, setDbChildren] = useState<DbChild[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(false);

  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editingChildName, setEditingChildName] = useState('');
  const [editingChildNickname, setEditingChildNickname] = useState('');
  const [fetchError, setFetchError] = useState('');
  const [resetPinChildId, setResetPinChildId] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [pinResetting, setPinResetting] = useState(false);
  const [pinResetMsg, setPinResetMsg] = useState('');

  const fetchDbChildren = async () => {
    if (!user) return;
    setChildrenLoading(true);
    setFetchError('');
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, full_name, avatar_emoji, birth_date')
      .eq('parent_id', user.id)
      .eq('is_child', true);
    if (error) setFetchError(`오류: ${error.message}`);
    setDbChildren((data ?? []).map(p => ({
      child_user_id: p.id,
      full_name: p.full_name ?? p.display_name,
      nickname: p.display_name,
      avatar_emoji: p.avatar_emoji ?? '🧒',
      birth_date: p.birth_date,
    })));
    setChildrenLoading(false);
  };

  useEffect(() => {
    if (!profile?.is_child) fetchDbChildren();
  }, [user?.id]);

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

  const handleSaveGeminiKey = () => {
    setApiKey(geminiKey.trim());
    setGeminiSaved(true);
    setTimeout(() => setGeminiSaved(false), 2000);
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
    if (!childBirthDate) { setChildError('생년월일을 입력해주세요.'); return; }
    if (childPin.length < 4) { setChildError('PIN은 4자리 이상이어야 해요.'); return; }
    if (childPin !== childPinConfirm) { setChildError('PIN이 일치하지 않아요.'); return; }
    setChildSaving(true);
    try {
      const { error, child, migratedBooks } = await createChildAccount(
        childName, childPin, childBirthDate, childAvatar, childLegacyId || undefined, childNickname.trim() || undefined
      );
      if (error) {
        setChildError(error);
      } else if (child) {
        const migrateMsg = migratedBooks ? ` (기존 책 ${migratedBooks}권 통합 완료)` : '';
        setChildSuccess(`${child.name} 서재가 만들어졌어요!${migrateMsg}`);
        await fetchDbChildren();
        onGroupChange?.();
        setChildName(''); setChildNickname(''); setChildBirthDate(''); setChildPin(''); setChildPinConfirm('');
        setChildAvatar('🧒'); setChildLegacyId('');
        setTimeout(() => { setChildSuccess(''); setShowAddChild(false); }, 3000);
      }
    } catch (err) {
      setChildError((err as Error).message ?? '오류가 발생했어요. 다시 시도해주세요.');
    } finally {
      setChildSaving(false);
    }
  };

  const handleRemoveChild = async (childId: string) => {
    if (!confirm('자녀 서재를 삭제할까요?\n자녀의 책 데이터는 유지됩니다.')) return;
    setDbChildren(prev => prev.filter(c => c.child_user_id !== childId));
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${supabaseUrl}/functions/v1/delete-child-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ childId }),
    });
    const json = await res.json() as { error?: string };
    if (json.error) {
      setFetchError(`삭제 오류: ${json.error}`);
      await fetchDbChildren();
      return;
    }
    removeStoredChild(childId);
    onGroupChange?.();
  };

  const handleResetPin = async (childId: string) => {
    if (newPin.length < 4) { setPinResetMsg('PIN은 4자리 이상이어야 해요.'); return; }
    if (newPin !== newPinConfirm) { setPinResetMsg('PIN이 일치하지 않아요.'); return; }
    setPinResetting(true); setPinResetMsg('');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${supabaseUrl}/functions/v1/reset-child-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ childId, newPin }),
    });
    const json = await res.json() as { error?: string };
    if (json.error) { setPinResetMsg(`오류: ${json.error}`); }
    else {
      setPinResetMsg('PIN이 변경됐어요!');
      setTimeout(() => { setResetPinChildId(null); setNewPin(''); setNewPinConfirm(''); setPinResetMsg(''); }, 1500);
    }
    setPinResetting(false);
  };

  const handleRenameChild = async (childId: string) => {
    const fullName = editingChildName.trim();
    const nickname = editingChildNickname.trim();
    if (!fullName) return;
    const displayName = nickname || fullName;
    await supabase.from('profiles').update({ display_name: displayName, full_name: fullName }).eq('id', childId);
    await supabase.from('child_accounts').update({ name: displayName }).eq('child_user_id', childId);
    const stored = JSON.parse(localStorage.getItem('bookstat-children') ?? '[]');
    localStorage.setItem('bookstat-children', JSON.stringify(
      stored.map((c: { childId: string }) => c.childId === childId ? { ...c, name: displayName } : c)
    ));
    setDbChildren(prev => prev.map(c =>
      c.child_user_id === childId ? { ...c, full_name: fullName, nickname: displayName } : c
    ));
    setEditingChildId(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>설정</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-form">

          {/* 화면 모드 */}
          <div className="settings-section">
            <h3 className="settings-section-title">화면 모드</h3>
            <div className="settings-theme-row">
              <button
                className={`settings-theme-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => theme === 'dark' && toggleTheme()}
              >
                <Sun size={16} /> 라이트 모드
              </button>
              <button
                className={`settings-theme-btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => theme === 'light' && toggleTheme()}
              >
                <Moon size={16} /> 다크 모드
              </button>
            </div>
          </div>

          <div className="settings-divider" />

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
                {fetchError && (
                  <p style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 8, wordBreak: 'break-all' }}>{fetchError}</p>
                )}
                {childrenLoading ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>불러오는 중...</p>
                ) : dbChildren.length > 0 && (
                  <div className="child-account-list">
                    {dbChildren.map(child => (
                      <div key={child.child_user_id} className="child-account-item" style={{ flexWrap: 'wrap' }}>
                        <span className="child-avatar">{child.avatar_emoji}</span>
                        {editingChildId === child.child_user_id ? (
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <input
                              value={editingChildName}
                              onChange={e => setEditingChildName(e.target.value)}
                              placeholder="이름 (실제 이름)"
                              style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text)' }}
                              autoFocus
                            />
                            <input
                              value={editingChildNickname}
                              onChange={e => setEditingChildNickname(e.target.value)}
                              placeholder="닉네임 (비워두면 이름 사용)"
                              style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--bg-base)', color: 'var(--text)' }}
                            />
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn-primary" style={{ flex: 1, padding: '4px 10px', fontSize: 12 }} onClick={() => handleRenameChild(child.child_user_id)}>저장</button>
                              <button className="btn-secondary" style={{ flex: 1, padding: '4px 10px', fontSize: 12 }} onClick={() => setEditingChildId(null)}>취소</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div style={{ flex: 1 }}>
                              <div className="child-account-name">{child.nickname}</div>
                              {child.full_name !== child.nickname && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{child.full_name}</div>
                              )}
                            </div>
                            <button className="icon-btn" title="이름/닉네임 수정" onClick={() => { setEditingChildId(child.child_user_id); setEditingChildName(child.full_name); setEditingChildNickname(child.nickname === child.full_name ? '' : child.nickname); }}>
                              <Pencil size={14} />
                            </button>
                            <button className="icon-btn" title="PIN 변경" onClick={() => { setResetPinChildId(child.child_user_id); setNewPin(''); setNewPinConfirm(''); setPinResetMsg(''); }}>
                              <Key size={14} />
                            </button>
                          </>
                        )}
                        <button
                          className="icon-btn danger-icon"
                          onClick={() => handleRemoveChild(child.child_user_id)}
                          title="삭제"
                        >
                          <Trash2 size={15} />
                        </button>
                        {resetPinChildId === child.child_user_id && (
                          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                            <input type="password" inputMode="numeric" placeholder="새 PIN (4~6자리)" value={newPin}
                              onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              style={{ fontSize: 13, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--bg-base)', color: 'var(--text)' }} />
                            <input type="password" inputMode="numeric" placeholder="PIN 확인" value={newPinConfirm}
                              onChange={e => setNewPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              style={{ fontSize: 13, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text)' }} />
                            {pinResetMsg && <p style={{ fontSize: 12, color: pinResetMsg.includes('변경') ? 'var(--success)' : 'var(--danger)', margin: 0 }}>{pinResetMsg}</p>}
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn-primary" style={{ flex: 1, padding: '4px 10px', fontSize: 12 }} disabled={pinResetting} onClick={() => handleResetPin(child.child_user_id)}>
                                {pinResetting ? '변경 중...' : 'PIN 변경'}
                              </button>
                              <button className="btn-secondary" style={{ flex: 1, padding: '4px 10px', fontSize: 12 }} onClick={() => setResetPinChildId(null)}>취소</button>
                            </div>
                          </div>
                        )}
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
                      <label>이름 <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input placeholder="실제 이름" value={childName} onChange={e => setChildName(e.target.value)} maxLength={20} required />
                    </div>
                    <div className="form-group">
                      <label>닉네임 <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(선택 · 서재에 표시될 이름)</span></label>
                      <input placeholder="예: 수연이, 딸기공주 (비워두면 이름 사용)" value={childNickname} onChange={e => setChildNickname(e.target.value)} maxLength={20} />
                    </div>
                    <div className="form-group">
                      <label>생년월일 <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input type="date" value={childBirthDate} onChange={e => setChildBirthDate(e.target.value)} max={new Date().toISOString().split('T')[0]} required />
                    </div>
                    <div className="form-group">
                      <label>PIN (4~6자리 숫자) <span style={{ color: 'var(--danger)' }}>*</span></label>
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

                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                        기존 서재 데이터 연결 (선택)
                      </label>
                      <select value={childLegacyId} onChange={e => setChildLegacyId(e.target.value)} style={{ marginTop: 4 }}>
                        <option value="">연결 안 함</option>
                        <option value="suyeon">수연 서재 가져오기</option>
                        <option value="mom">엄마 서재 가져오기</option>
                        <option value="dad">아빠 서재 가져오기</option>
                      </select>
                      {childLegacyId && (
                        <p style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>
                          ✓ 기존 서재의 책 데이터가 새 계정으로 통합돼요.
                        </p>
                      )}
                    </div>

                    {childError && <p style={{ fontSize: 12, color: 'var(--danger)', margin: '4px 0' }}>{childError}</p>}
                    {childSuccess && <p style={{ fontSize: 12, color: 'var(--success)', margin: '4px 0' }}>{childSuccess}</p>}

                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowAddChild(false); setChildError(''); setChildLegacyId(''); }}>
                        취소
                      </button>
                      <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={childSaving}>
                        {childSaving ? '생성 중...' : '서재 만들기'}
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
              <label><Key size={13} style={{ display: 'inline', marginRight: 4 }} />Gemini API Key</label>
              <input
                type="password"
                value={geminiKey}
                onChange={e => setGeminiKeyState(e.target.value)}
                placeholder="AIza..."
                autoComplete="off"
              />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                AI 후기 검증, 독후감 생성, 단어 검색, 표지 인식, 통계 분석에 사용됩니다.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn-primary" onClick={handleSaveGeminiKey}>
                  {geminiSaved ? <><Check size={15} /> 저장됨</> : '저장'}
                </button>
              </div>
            </div>

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
