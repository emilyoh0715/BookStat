import { useState } from 'react';
import { useAuth, type ChildAccount } from '../contexts/AuthContext';
import { Mail, Lock, Eye, EyeOff, KeyRound, ArrowLeft, Baby } from 'lucide-react';

type MainTab = 'login' | 'signup';

export default function AuthScreen() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInAsChild, getStoredChildren } = useAuth();

  const [tab, setTab] = useState<MainTab>('login');
  const [showChildLogin, setShowChildLogin] = useState(false);
  const [selectedChild, setSelectedChild] = useState<ChildAccount | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [childPin, setChildPin] = useState('');
  const [showChildPin, setShowChildPin] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const storedChildren = getStoredChildren();

  const switchTab = (t: MainTab) => {
    setTab(t);
    setError(''); setMessage('');
    setEmail(''); setPassword('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error } = await signInWithEmail(email, password);
    if (error) setError(error);
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error } = await signUpWithEmail(email, password);
    if (error) {
      if (error.toLowerCase().includes('already') || error.toLowerCase().includes('registered')) {
        setError('이미 가입된 이메일이에요. 로그인 탭에서 로그인해주세요.');
      } else {
        setError(error);
      }
    } else {
      setMessage('가입 확인 이메일을 보냈어요.\n받은 편지함에서 링크를 클릭하면 가입이 완료돼요!');
    }
    setLoading(false);
  };

  const handleChildLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild) return;
    setError(''); setLoading(true);
    const { error } = await signInAsChild(selectedChild, childPin);
    if (error) setError('PIN이 올바르지 않아요.');
    setLoading(false);
  };

  // ── 자녀 선택 화면 ────────────────────────────────────
  if (showChildLogin) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">
            <img src="/logo.png" alt="북스탯" />
            <span>북스탯</span>
          </div>
          <button className="auth-back-btn" onClick={() => { setShowChildLogin(false); setSelectedChild(null); setChildPin(''); setError(''); }}>
            <ArrowLeft size={16} /> 뒤로
          </button>

          {!selectedChild ? (
            <>
              <p className="auth-subtitle">누구인가요?</p>
              <div className="child-list">
                {storedChildren.map(child => (
                  <button key={child.childId} className="child-profile-btn" onClick={() => { setSelectedChild(child); setError(''); }}>
                    <span className="child-avatar">{child.avatarEmoji}</span>
                    <span className="child-name">{child.name}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <form className="auth-form" onSubmit={handleChildLogin}>
              <div className="child-selected-header">
                <span className="child-avatar large">{selectedChild.avatarEmoji}</span>
                <p className="child-selected-name">{selectedChild.name}</p>
              </div>
              <div className="auth-field">
                <KeyRound size={16} className="auth-field-icon" />
                <input
                  type={showChildPin ? 'text' : 'password'}
                  inputMode="numeric"
                  placeholder="PIN 번호 입력"
                  value={childPin}
                  onChange={e => setChildPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  autoFocus
                />
                <button type="button" className="auth-pw-toggle" onClick={() => setShowChildPin(v => !v)}>
                  {showChildPin ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" className="btn-primary auth-submit" disabled={loading || childPin.length < 4}>
                {loading ? '확인 중...' : '로그인'}
              </button>
              <button type="button" className="auth-link-btn" onClick={() => { setSelectedChild(null); setChildPin(''); setError(''); }}>
                다른 자녀 선택
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/logo.png" alt="북스탯" />
          <span>북스탯</span>
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => switchTab('login')}>로그인</button>
          <button className={`auth-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => switchTab('signup')}>회원가입</button>
        </div>

        <div className="social-btns">
          <button className="social-btn google" onClick={signInWithGoogle}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Google로 계속하기
          </button>
        </div>

        <div className="auth-divider"><span>또는</span></div>

        <form className="auth-form" onSubmit={tab === 'login' ? handleLogin : handleSignup}>
          <div className="auth-field">
            <Mail size={16} className="auth-field-icon" />
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="auth-field">
            <Lock size={16} className="auth-field-icon" />
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="비밀번호"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />
            <button type="button" className="auth-pw-toggle" onClick={() => setShowPw(v => !v)}>
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-message">{message}</p>}
          <button type="submit" className="btn-primary auth-submit" disabled={loading}>
            {loading ? '처리 중...' : tab === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>

        {storedChildren.length > 0 && (
          <button className="child-login-btn" onClick={() => setShowChildLogin(true)}>
            <Baby size={16} /> 자녀 계정으로 로그인
          </button>
        )}
      </div>
    </div>
  );
}
