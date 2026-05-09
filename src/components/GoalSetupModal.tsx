import { useState, useRef } from 'react';
import { X, Camera, Loader, Check } from 'lucide-react';
import { MARKET_ITEMS } from './PointsMarket';
import { createGoal, uploadGoalImage } from '../services/goals';

interface Props {
  onClose: () => void;
  onCreated: () => void;
  preselected?: typeof MARKET_ITEMS[0] | null;
}

type Mode = 'preset' | 'custom';

export default function GoalSetupModal({ onClose, onCreated, preselected }: Props) {
  const [mode, setMode]               = useState<Mode>('preset');
  const [selectedPreset, setSelected] = useState<typeof MARKET_ITEMS[0] | null>(preselected ?? null);
  const [customName, setCustomName]   = useState('');
  const [customPoints, setCustomPoints] = useState('');
  const [imageFile, setImageFile]     = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = ev => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const canSubmit = mode === 'preset'
    ? !!selectedPreset
    : !!customName.trim() && !!customPoints && Number(customPoints) > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    if (mode === 'preset' && selectedPreset) {
      await createGoal({
        itemName:       selectedPreset.name,
        pointsRequired: selectedPreset.cost,
        emoji:          selectedPreset.emoji,
      });
    } else {
      let imageUrl: string | null = null;
      if (imageFile) {
        setUploading(true);
        imageUrl = await uploadGoalImage(imageFile);
        setUploading(false);
      }
      await createGoal({
        itemName:       customName.trim(),
        pointsRequired: Number(customPoints),
        imageUrl,
      });
    }

    setSubmitting(false);
    onCreated();
  };

  return (
    <div className="modal-overlay modal-overlay--center" onClick={() => !submitting && onClose()}>
      <div className="modal goal-modal" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="goal-modal-header">
          <h3>🎯 목표 설정</h3>
          <button className="icon-btn" onClick={onClose} disabled={submitting}><X size={18} /></button>
        </div>

        {/* 모드 탭 */}
        <div className="goal-mode-tabs">
          <button
            className={`goal-mode-tab ${mode === 'preset' ? 'active' : ''}`}
            onClick={() => setMode('preset')}
          >추천 보상</button>
          <button
            className={`goal-mode-tab ${mode === 'custom' ? 'active' : ''}`}
            onClick={() => setMode('custom')}
          >직접 설정</button>
        </div>

        <div className="goal-modal-body">
          {/* ── 추천 보상 ── */}
          {mode === 'preset' && (
            <div className="goal-preset-grid">
              {MARKET_ITEMS.map(item => {
                const isSelected = selectedPreset?.id === item.id;
                return (
                  <button
                    key={item.id}
                    className={`goal-preset-card ${isSelected ? 'selected' : ''}`}
                    style={{ '--item-color': item.color, '--item-bg': item.bg, '--item-border': item.border } as React.CSSProperties}
                    onClick={() => setSelected(item)}
                  >
                    {isSelected && <span className="goal-preset-check"><Check size={12} /></span>}
                    <div className="goal-preset-emoji">{item.emoji}</div>
                    <div className="goal-preset-name">{item.name}</div>
                    <div className="goal-preset-pts" style={{ color: item.color }}>{item.cost.toLocaleString()}p</div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── 직접 설정 ── */}
          {mode === 'custom' && (
            <div className="goal-custom-form">
              {/* 사진 업로드 */}
              <div className="goal-photo-upload" onClick={() => fileRef.current?.click()}>
                {imagePreview
                  ? <img src={imagePreview} alt="미리보기" className="goal-photo-preview" />
                  : <div className="goal-photo-placeholder">
                      <Camera size={24} />
                      <span>사진 추가</span>
                    </div>
                }
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </div>

              <div className="form-group">
                <label>보상 이름</label>
                <input
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="예: 닌텐도 게임, 영화 관람권"
                  maxLength={30}
                />
              </div>
              <div className="form-group">
                <label>필요 포인트</label>
                <input
                  type="number"
                  value={customPoints}
                  onChange={e => setCustomPoints(e.target.value)}
                  placeholder="예: 500"
                  min="1"
                  max="99999"
                />
              </div>
            </div>
          )}
        </div>

        {/* 안내 문구 */}
        <p className="goal-notice">
          목표를 설정하면 가족 중 한 명의 승인이 필요해요.
        </p>

        {/* 제출 버튼 */}
        <button
          className="btn-primary"
          style={{ width: '100%' }}
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting
            ? <><Loader size={15} className="spin" /> {uploading ? '사진 업로드 중...' : '요청 중...'}</>
            : '승인 요청 보내기'}
        </button>
      </div>
    </div>
  );
}
