import { BookOpen, CheckCircle, Clock, BookMarked, Star, StickyNote } from 'lucide-react';

interface Stats {
  finished: number;
  reading: number;
  wantToRead: number;
  totalVocab: number;
  totalNotes: number;
  avgRating: number;
}

export default function Dashboard({ stats }: { stats: Stats }) {
  const cards = [
    { icon: <CheckCircle size={22} />, label: '완독', value: stats.finished, color: '#2ecc71' },
    { icon: <BookOpen size={22} />, label: '읽는 중', value: stats.reading, color: '#3b7fd4' },
    { icon: <Clock size={22} />, label: '읽고 싶음', value: stats.wantToRead, color: '#5ba8e5' },
    { icon: <BookMarked size={22} />, label: '단어 기록', value: stats.totalVocab, color: '#f5c518' },
    { icon: <StickyNote size={22} />, label: '메모', value: stats.totalNotes, color: '#e8a020' },
    { icon: <Star size={22} />, label: '평균 별점', value: stats.avgRating ? stats.avgRating.toFixed(1) : '—', color: '#f5c518' },
  ];

  return (
    <div className="dashboard">
      {cards.map(c => (
        <div key={c.label} className="stat-card">
          <div className="stat-icon" style={{ color: c.color }}>{c.icon}</div>
          <div className="stat-value">{c.value}</div>
          <div className="stat-label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
