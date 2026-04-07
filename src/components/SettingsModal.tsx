import { useState } from 'react';
import { getAladinKey, setAladinKey } from '../services/claudeVocab';
import { X, Key, Check } from 'lucide-react';

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [aladinKey, setAladinKeyState] = useState(getAladinKey());
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setAladinKey(aladinKey.trim());
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
