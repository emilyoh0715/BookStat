import type { ReadingStatus } from '../types';
import { BookOpen, CheckCircle, Clock, BookMarked, Star, StickyNote } from 'lucide-react';

interface Stats {
  finished: number;
  reading: number;
  wantToRead: number;
  totalVocab: number;
  totalNotes: number;
  avgRating: number;
}

interface Props {
  stats: Stats;
  statusFilter: ReadingStatus | 'all';
  onStatusFilter: (status: ReadingStatus | 'all') => void;
}

export default function Dashboard({ stats, statusFilter, onStatusFilter }: Props) {
  const clickable = [
    { icon: <CheckCircle size={22} />, label: '완독', value: stats.finished, color: '#2ecc71', filter: 'finished' as ReadingStatus },
    { icon: <BookOpen size={22} />, label: '읽는 중', value: stats.reading, color: '#3b7fd4', filter: 'reading' as ReadingStatus },
    { icon: <Clock size={22} />, label: '읽고 싶음', value: stats.wantToRead, color: '#5ba8e5', filter: 'want-to-read' as ReadingStatus },
  ];
  const info = [
    { icon: <BookMarked size={22} />, label: '단어 기록', value: stats.totalVocab, color: '#f5c518' },
    { icon: <StickyNote size={22} />, label: '메모', value: stats.totalNotes, color: '#e8a020' },
    { icon: <Star size={22} />, label: '평균 별점', value: stats.avgRating ? stats.avgRating.toFixed(1) : '—', color: '#f5c518' },
  ];

  return (
    <div className="dashboard">
      {clickable.map(c => (
        <button
          key={c.label}
          className={`stat-card stat-card-btn ${statusFilter === c.filter ? 'active' : ''}`}
          onClick={() => onStatusFilter(statusFilter === c.filter ? 'all' : c.filter)}
        >
          <div className="stat-icon" style={{ color: c.color }}>{c.icon}</div>
          <div className="stat-value">{c.value}</div>
          <div className="stat-label">{c.label}</div>
        </button>
      ))}
      {info.map(c => (
        <div key={c.label} className="stat-card">
          <div className="stat-icon" style={{ color: c.color }}>{c.icon}</div>
          <div className="stat-value">{c.value}</div>
          <div className="stat-label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
