import { useState } from 'react';
import { getApiKey, setApiKey, getKakaoKey, setKakaoKey } from '../services/claudeVocab';
import { X, Key, Check } from 'lucide-react';

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [claudeKey, setClaudeKey] = useState(getApiKey());
  const [kakaoKey, setKakaoKeyState] = useState(getKakaoKey());
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setApiKey(claudeKey.trim());
    setKakaoKey(kakaoKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>설정</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-form">
          <div className="form-group">
            <label><Key size={13} style={{ display: 'inline', marginRight: 4 }} />Claude API 키</label>
            <input
              type="password"
              value={claudeKey}
              onChange={e => setClaudeKey(e.target.value)}
              placeholder="sk-ant-..."
              autoComplete="off"
            />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              단어 AI 자동 검색 기능에 사용됩니다.
            </p>
          </div>
          <div className="form-group">
            <label><Key size={13} style={{ display: 'inline', marginRight: 4 }} />카카오 REST API 키</label>
            <input
              type="password"
              value={kakaoKey}
              onChange={e => setKakaoKeyState(e.target.value)}
              placeholder="kakao REST API key..."
              autoComplete="off"
            />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              한국 책 표지 검색에 사용됩니다.{' '}
              <a href="https://developers.kakao.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                kakao developers
              </a>에서 앱을 만들면 무료로 발급 받을 수 있어요.
            </p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>닫기</button>
            <button type="button" className="btn-primary" onClick={handleSave}>
              {saved ? <><Check size={15} /> 저장됨</> : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
