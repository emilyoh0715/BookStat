import type { ReadingStatus } from '../types';
import { CheckCircle, BookOpen, PauseCircle, Clock, Star, Award, MessageSquare } from 'lucide-react';

interface Stats {
  finished: number;
  reading: number;
  paused: number;
  wantToRead: number;
  avgRating: number;
  reviewCount: number;
}

interface Props {
  stats: Stats;
  statusFilter: ReadingStatus | 'all';
  onStatusFilter: (status: ReadingStatus | 'all') => void;
  totalPoints?: number;
  onPointsClick?: () => void;
}

export default function Dashboard({ stats, statusFilter, onStatusFilter, totalPoints, onPointsClick }: Props) {
  const cards: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    color: string;
    filter?: ReadingStatus;
    onClick?: () => void;
  }[] = [
    // 포인트 — 첫 번째
    ...(totalPoints !== undefined ? [{
      icon: <Award size={22} />,
      label: '포인트',
      value: totalPoints,
      color: '#f5a623',
      onClick: onPointsClick,
    }] : []),
    // 독서 상태 (클릭하면 필터)
    { icon: <CheckCircle size={22} />, label: '완독',     value: stats.finished,  color: '#2ecc71', filter: 'finished'     as ReadingStatus },
    { icon: <BookOpen    size={22} />, label: '읽는 중',  value: stats.reading,   color: '#3b7fd4', filter: 'reading'      as ReadingStatus },
    { icon: <PauseCircle size={22} />, label: '잠시 멈춤', value: stats.paused,   color: '#a78bfa', filter: 'paused'       as ReadingStatus },
    { icon: <Clock       size={22} />, label: '읽고 싶음', value: stats.wantToRead, color: '#5ba8e5', filter: 'want-to-read' as ReadingStatus },
    // 후기
    { icon: <MessageSquare size={22} />, label: '후기', value: stats.reviewCount, color: '#e67e22' },
    // 정보
    { icon: <Star size={22} />, label: '평균 별점', value: stats.avgRating ? stats.avgRating.toFixed(1) : '—', color: '#f5c518' },
  ];

  return (
    <div className="dashboard">
      {cards.map(c => {
        const isActive = c.filter && statusFilter === c.filter;
        const handleClick = c.filter
          ? () => onStatusFilter(statusFilter === c.filter ? 'all' : c.filter!)
          : c.onClick;

        return handleClick ? (
          <button
            key={c.label}
            className={`stat-card stat-card-btn ${isActive ? 'active' : ''} ${c.label === '포인트' ? 'points-card' : ''}`}
            onClick={handleClick}
          >
            <div className="stat-icon" style={{ color: c.color }}>{c.icon}</div>
            <div className="stat-value">{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </button>
        ) : (
          <div key={c.label} className="stat-card">
            <div className="stat-icon" style={{ color: c.color }}>{c.icon}</div>
            <div className="stat-value">{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        );
      })}
    </div>
  );
}
