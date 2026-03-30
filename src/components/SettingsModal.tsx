import { useState } from 'react';
import { getApiKey, setApiKey } from '../services/claudeVocab';
import { X, Key, Check } from 'lucide-react';

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [key, setKey] = useState(getApiKey());
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setApiKey(key.trim());
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
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="sk-ant-..."
              autoComplete="off"
            />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              단어 AI 자동 검색 기능에 사용됩니다. 키는 브라우저 로컬 스토리지에 저장됩니다.
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
