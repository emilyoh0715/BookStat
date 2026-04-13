import { useState } from 'react';
import { useAuth, type ChildAccount } from '../contexts/AuthContext';
import { Mail, Lock, Eye, EyeOff, Phone, KeyRound, User, Calendar, ArrowLeft, Baby } from 'lucide-react';

type MainTab = 'login' | 'signup';
type LoginMethod = 'email' | 'phone';
type SignupStep =
  | 'method'       // 이메일 / 휴대폰 선택
  | 'email-form'   // 이메일 가입 폼
  | 'phone-form'   // 휴대폰 번호 입력
  | 'phone-otp';   // OTP 입력

export default function AuthScreen() {
  const {
    signInWithEmail, signUpWithEmail,
    sendPhoneOtp, verifyPhoneOtp,
    signInWithGoogle, signInAsChild, getStoredChildren,
  } = useAuth();

  const [tab, setTab] = useState<MainTab>('login');
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');
  const [signupStep, setSignupStep] = useState<SignupStep>('method');
  const [showChildLogin, setShowChildLogin] = useState(false);
  const [selectedChild, setSelectedChild] = useState<ChildAccount | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [childPin, setChildPin] = useState('');
  const [showChildPin, setShowChildPin] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const storedChildren = getStoredChildren();

  const reset = () => {
    setError(''); setMessage('');
    setEmail(''); setPassword(''); setPhone(''); setOtp('');
    setFullName(''); setBirthDate(''); setChildPin('');
    setSignupStep('method'); setLoginMethod('email');
    setShowChildLogin(false); setSelectedChild(null);
  };

  const switchTab = (t: MainTab) => { setTab(t); reset(); };

  // ── 이메일 로그인 ──────────────────────────────────────
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error } = await signInWithEmail(email, password);
    if (error) setError(error);
    setLoading(false);
  };

  // ── 휴대폰 로그인: OTP 발송 ────────────────────────────
  const handleSendLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error } = await sendPhoneOtp(phone);
    if (error) { setError(error); setLoading(false); return; }
    setMessage('인증번호를 발송했어요. 문자를 확인해주세요.');
    setLoading(false);
  };

  // ── 휴대폰 로그인: OTP 검증 ────────────────────────────
  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error } = await verifyPhoneOtp(phone, otp);
    if (error) setError(error);
    setLoading(false);
  };

  // ── 이메일 회원가입 ────────────────────────────────────
  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error } = await signUpWithEmail(email, password, fullName, birthDate);
    if (error) {
      setError(error);
    } else {
      setMessage('가입 확인 이메일을 보냈어요.\n받은 편지함에서 링크를 클릭하면 가입이 완료돼요!');
    }
    setLoading(false);
  };

  // ── 휴대폰 가입: OTP 발송 ─────────────────────────────
  const handleSendSignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { setError('이름을 입력해주세요.'); return; }
    setError(''); setLoading(true);
    const { error } = await sendPhoneOtp(phone);
    if (error) { setError(error); setLoading(false); return; }
    setMessage('인증번호를 발송했어요. 문자를 확인해주세요.');
    setSignupStep('phone-otp');
    setLoading(false);
  };

  // ── 휴대폰 가입: OTP 검증 ─────────────────────────────
  const handleVerifySignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error } = await verifyPhoneOtp(phone, otp, fullName, birthDate);
    if (error) setError(error);
    setLoading(false);
  };

  // ── 자녀 PIN 로그인 ───────────────────────────────────
  const handleChildLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild) return;
    setError(''); setLoading(true);
    const { error } = await signInAsChild(selectedChild, childPin);
    if (error) {
      setError('PIN이 올바르지 않아요.');
    }
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
                  <button
                    key={child.childId}
                    className="child-profile-btn"
                    onClick={() => { setSelectedChild(child); setError(''); }}
                  >
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

        {/* 로그인 / 회원가입 탭 */}
        <div className="auth-tabs">
          <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => switchTab('login')}>로그인</button>
          <button className={`auth-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => switchTab('signup')}>회원가입</button>
        </div>

        {/* ── 로그인 ────────────────────────────────────── */}
        {tab === 'login' && (
          <>
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

            {/* 이메일 / 휴대폰 토글 */}
            <div className="auth-method-toggle">
              <button className={loginMethod === 'email' ? 'active' : ''} onClick={() => { setLoginMethod('email'); setError(''); setMessage(''); }}>
                <Mail size={14} /> 이메일
              </button>
              <button className={loginMethod === 'phone' ? 'active' : ''} onClick={() => { setLoginMethod('phone'); setError(''); setMessage(''); }}>
                <Phone size={14} /> 휴대폰
              </button>
            </div>

            {loginMethod === 'email' ? (
              <form className="auth-form" onSubmit={handleEmailLogin}>
                <div className="auth-field">
                  <Mail size={16} className="auth-field-icon" />
                  <input type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div className="auth-field">
                  <Lock size={16} className="auth-field-icon" />
                  <input type={showPw ? 'text' : 'password'} placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
                  <button type="button" className="auth-pw-toggle" onClick={() => setShowPw(v => !v)}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {error && <p className="auth-error">{error}</p>}
                <button type="submit" className="btn-primary auth-submit" disabled={loading}>
                  {loading ? '로그인 중...' : '로그인'}
                </button>
              </form>
            ) : (
              <form className="auth-form" onSubmit={message ? handleVerifyLoginOtp : handleSendLoginOtp}>
                <div className="auth-field">
                  <Phone size={16} className="auth-field-icon" />
                  <input
                    type="tel"
                    placeholder="휴대폰 번호 (010-0000-0000)"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                    disabled={!!message}
                  />
                </div>
                {message && (
                  <div className="auth-field">
                    <KeyRound size={16} className="auth-field-icon" />
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="인증번호 6자리"
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      autoFocus
                    />
                  </div>
                )}
                {error && <p className="auth-error">{error}</p>}
                {message && <p className="auth-message">{message}</p>}
                <button type="submit" className="btn-primary auth-submit" disabled={loading}>
                  {loading ? '처리 중...' : message ? '인증번호 확인' : '인증번호 받기'}
                </button>
                {message && (
                  <button type="button" className="auth-link-btn" onClick={() => { setMessage(''); setOtp(''); }} >
                    번호 다시 입력
                  </button>
                )}
              </form>
            )}

            {/* 자녀 계정 로그인 */}
            {storedChildren.length > 0 && (
              <button className="child-login-btn" onClick={() => setShowChildLogin(true)}>
                <Baby size={16} /> 자녀 계정으로 로그인
              </button>
            )}
          </>
        )}

        {/* ── 회원가입 ──────────────────────────────────── */}
        {tab === 'signup' && (
          <>
            {/* Step 1: 방법 선택 */}
            {signupStep === 'method' && (
              <>
                <p className="auth-subtitle">가입 방법을 선택해주세요</p>
                <div className="signup-method-list">
                  <button className="signup-method-card" onClick={() => setSignupStep('email-form')}>
                    <Mail size={22} />
                    <div>
                      <strong>이메일로 가입</strong>
                      <span>이메일 주소와 비밀번호로 가입해요</span>
                    </div>
                  </button>
                  <button className="signup-method-card" onClick={() => setSignupStep('phone-form')}>
                    <Phone size={22} />
                    <div>
                      <strong>휴대폰으로 가입</strong>
                      <span>문자 인증번호로 빠르게 가입해요</span>
                    </div>
                  </button>
                </div>
                <div className="auth-divider"><span>또는</span></div>
                <button className="social-btn google" onClick={signInWithGoogle}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                  Google로 계속하기
                </button>
              </>
            )}

            {/* Step 2a: 이메일 가입 폼 */}
            {signupStep === 'email-form' && (
              <>
                <button className="auth-back-btn" onClick={() => { setSignupStep('method'); setError(''); setMessage(''); }}>
                  <ArrowLeft size={16} /> 뒤로
                </button>
                {message ? (
                  <p className="auth-message" style={{ textAlign: 'center', marginTop: 16 }}>{message}</p>
                ) : (
                  <form className="auth-form" onSubmit={handleEmailSignup}>
                    <div className="auth-field">
                      <User size={16} className="auth-field-icon" />
                      <input placeholder="이름 (실명)" value={fullName} onChange={e => setFullName(e.target.value)} required maxLength={20} />
                    </div>
                    <div className="auth-field">
                      <Calendar size={16} className="auth-field-icon" />
                      <input type="date" placeholder="생년월일" value={birthDate} onChange={e => setBirthDate(e.target.value)} max={new Date().toISOString().split('T')[0]} />
                    </div>
                    <div className="auth-field">
                      <Mail size={16} className="auth-field-icon" />
                      <input type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                    </div>
                    <div className="auth-field">
                      <Lock size={16} className="auth-field-icon" />
                      <input type={showPw ? 'text' : 'password'} placeholder="비밀번호 (6자 이상)" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
                      <button type="button" className="auth-pw-toggle" onClick={() => setShowPw(v => !v)}>
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {error && <p className="auth-error">{error}</p>}
                    <button type="submit" className="btn-primary auth-submit" disabled={loading}>
                      {loading ? '처리 중...' : '회원가입'}
                    </button>
                  </form>
                )}
              </>
            )}

            {/* Step 2b: 휴대폰 번호 입력 */}
            {signupStep === 'phone-form' && (
              <>
                <button className="auth-back-btn" onClick={() => { setSignupStep('method'); setError(''); setMessage(''); }}>
                  <ArrowLeft size={16} /> 뒤로
                </button>
                <form className="auth-form" onSubmit={handleSendSignupOtp}>
                  <div className="auth-field">
                    <User size={16} className="auth-field-icon" />
                    <input placeholder="이름 (실명)" value={fullName} onChange={e => setFullName(e.target.value)} required maxLength={20} />
                  </div>
                  <div className="auth-field">
                    <Calendar size={16} className="auth-field-icon" />
                    <input type="date" placeholder="생년월일" value={birthDate} onChange={e => setBirthDate(e.target.value)} max={new Date().toISOString().split('T')[0]} />
                  </div>
                  <div className="auth-field">
                    <Phone size={16} className="auth-field-icon" />
                    <input type="tel" placeholder="휴대폰 번호 (010-0000-0000)" value={phone} onChange={e => setPhone(e.target.value)} required />
                  </div>
                  {error && <p className="auth-error">{error}</p>}
                  <button type="submit" className="btn-primary auth-submit" disabled={loading}>
                    {loading ? '발송 중...' : '인증번호 받기'}
                  </button>
                </form>
              </>
            )}

            {/* Step 3b: 휴대폰 OTP 입력 */}
            {signupStep === 'phone-otp' && (
              <>
                <button className="auth-back-btn" onClick={() => { setSignupStep('phone-form'); setOtp(''); setMessage(''); setError(''); }}>
                  <ArrowLeft size={16} /> 뒤로
                </button>
                <form className="auth-form" onSubmit={handleVerifySignupOtp}>
                  <p className="auth-subtitle">{phone}으로 발송된<br />6자리 인증번호를 입력해주세요.</p>
                  <div className="auth-field otp-field">
                    <KeyRound size={16} className="auth-field-icon" />
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="인증번호 6자리"
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      autoFocus
                    />
                  </div>
                  {error && <p className="auth-error">{error}</p>}
                  {message && <p className="auth-message">{message}</p>}
                  <button type="submit" className="btn-primary auth-submit" disabled={loading || otp.length < 6}>
                    {loading ? '확인 중...' : '인증 완료'}
                  </button>
                  <button type="button" className="auth-link-btn" onClick={() => { sendPhoneOtp(phone); setMessage('인증번호를 다시 발송했어요.'); setOtp(''); }}>
                    인증번호 재발송
                  </button>
                </form>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
