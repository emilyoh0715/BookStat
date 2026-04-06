import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

export default function AuthScreen() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithKakao } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    if (mode === 'login') {
      const { error } = await signInWithEmail(email, password);
      if (error) setError(error);
    } else {
      const { error } = await signUpWithEmail(email, password);
      if (error) setError(error);
      else setMessage('가입 확인 이메일을 보냈어요. 이메일을 확인해주세요!');
    }
    setLoading(false);
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/logo.png" alt="북스탯" />
          <span>북스탯</span>
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError(''); setMessage(''); }}>로그인</button>
          <button className={`auth-tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => { setMode('signup'); setError(''); setMessage(''); }}>회원가입</button>
        </div>

        {/* 소셜 로그인 */}
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
          <button className="social-btn kakao" onClick={signInWithKakao}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 0C4.029 0 0 3.134 0 7c0 2.493 1.607 4.677 4.027 5.934L3.09 16.5l4.09-2.72A10.77 10.77 0 009 14c4.971 0 9-3.134 9-7S13.971 0 9 0z" fill="#3A1D1D"/>
            </svg>
            카카오로 계속하기
          </button>
        </div>

        <div className="auth-divider"><span>또는</span></div>

        <form className="auth-form" onSubmit={handleSubmit}>
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
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            <button type="button" className="auth-pw-toggle" onClick={() => setShowPw(v => !v)}>
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-message">{message}</p>}
          <button type="submit" className="btn-primary auth-submit" disabled={loading}>
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>
      </div>
    </div>
  );
}
