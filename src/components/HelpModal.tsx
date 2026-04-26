import { X } from 'lucide-react';

const STEPS = [
  {
    emoji: '📸',
    title: '책 추가',
    desc: '카메라로 표지를 찍으면 제목이 자동 인식돼요. 직접 검색하거나 마이크로 말해서 추가할 수도 있어요.',
  },
  {
    emoji: '⭐',
    title: '독서 후기 작성',
    desc: '책을 다 읽으면 별점과 후기를 남겨요. 마이크 버튼을 누르면 음성으로 입력할 수 있어요.',
  },
  {
    emoji: '🏆',
    title: '포인트 획득',
    desc: '책 등록, 독서 완료, 후기 작성마다 포인트를 받아요. 페이지가 많을수록, 원서일수록 더 많이 받아요.',
  },
  {
    emoji: '👨‍👩‍👧',
    title: '가족 그룹',
    desc: '상단 그룹 아이콘에서 가족을 초대해요. 서로의 서재와 독서 현황을 함께 볼 수 있어요.',
  },
  {
    emoji: '🛍️',
    title: '포인트 마켓',
    desc: '모은 포인트로 간식, 문구용품, 장난감을 신청할 수 있어요. 그룹장이 승인하면 포인트가 차감돼요.',
  },
  {
    emoji: '🧒',
    title: '자녀 계정',
    desc: '설정에서 자녀 계정을 만들 수 있어요. 자녀는 이름과 PIN으로 이 기기에서 바로 로그인해요.',
  },
];

export default function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>북스탯 사용법</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="help-modal-body">
          {STEPS.map((step, i) => (
            <div key={i} className="help-step">
              <div className="help-step-emoji">{step.emoji}</div>
              <div className="help-step-content">
                <strong className="help-step-title">{step.title}</strong>
                <p className="help-step-desc">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
