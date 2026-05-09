import { useEffect, useRef, useState } from 'react';
import { Award } from 'lucide-react';

interface Props {
  points: number;
  label: string;
  onDismiss: () => void;
}

const PARTICLES: { emoji: string; tx: string; ty: string; delay: string; dur: string }[] = [
  { emoji: '⭐', tx: '-60px', ty: '-80px', delay: '0s',    dur: '1.4s' },
  { emoji: '✨', tx: '20px',  ty: '-90px', delay: '0.08s', dur: '1.3s' },
  { emoji: '🎉', tx: '70px',  ty: '-70px', delay: '0.04s', dur: '1.5s' },
  { emoji: '⭐', tx: '-40px', ty: '-100px',delay: '0.12s', dur: '1.2s' },
  { emoji: '✨', tx: '80px',  ty: '-50px', delay: '0.16s', dur: '1.6s' },
  { emoji: '🌟', tx: '-80px', ty: '-55px', delay: '0.06s', dur: '1.35s'},
  { emoji: '⭐', tx: '50px',  ty: '-95px', delay: '0.1s',  dur: '1.45s'},
  { emoji: '✨', tx: '-20px', ty: '-85px', delay: '0.14s', dur: '1.25s'},
];

export default function PointsCelebration({ points, label, onDismiss }: Props) {
  const [dismissing, setDismissing] = useState(false);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; });

  useEffect(() => {
    const t1 = setTimeout(() => setDismissing(true), 1900);
    const t2 = setTimeout(() => onDismissRef.current(), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div
      className={`pts-overlay${dismissing ? ' pts-overlay--out' : ''}`}
      onClick={onDismiss}
    >
      <div className="pts-card" onClick={e => e.stopPropagation()}>
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="pts-particle"
            style={{ '--tx': p.tx, '--ty': p.ty, '--delay': p.delay, '--dur': p.dur } as React.CSSProperties}
          >
            {p.emoji}
          </span>
        ))}
        <Award size={32} className="pts-award-icon" />
        <div className="pts-number">
          <span className="pts-plus">+</span>
          <span className="pts-val">{points}</span>
          <span className="pts-unit">pt</span>
        </div>
        <p className="pts-label">{label}</p>
        <p className="pts-sub">포인트가 적립되었어요</p>
      </div>
    </div>
  );
}
