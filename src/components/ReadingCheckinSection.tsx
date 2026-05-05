import { useState } from 'react';
import { BookOpen, CheckCircle2, Circle, Flame } from 'lucide-react';
import type { Book } from '../types';

interface Props {
  books: Book[];
  userId: string;
}

type Checkins = Record<string, string[]>;

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const today = getToday();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const sorted = [...new Set(dates)].sort().reverse();
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.round(
      (new Date(sorted[i - 1]).getTime() - new Date(sorted[i]).getTime()) / 86400000
    );
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

const storageKey = (userId: string) => `bookstat-checkin-${userId}`;

export default function ReadingCheckinSection({ books, userId }: Props) {
  const readingBooks = books.filter(b => b.userId === userId && b.status === 'reading');

  const [checkins, setCheckins] = useState<Checkins>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey(userId)) ?? '{}');
    } catch { return {}; }
  });

  if (readingBooks.length === 0) return null;

  const today = getToday();

  const toggle = (bookId: string) => {
    const dates = checkins[bookId] ?? [];
    const hasToday = dates.includes(today);
    const next: Checkins = {
      ...checkins,
      [bookId]: hasToday ? dates.filter(d => d !== today) : [...dates, today],
    };
    setCheckins(next);
    localStorage.setItem(storageKey(userId), JSON.stringify(next));
  };

  const checkedCount = readingBooks.filter(b => (checkins[b.id] ?? []).includes(today)).length;
  const allChecked = checkedCount === readingBooks.length;

  return (
    <div className="checkin-section">
      <div className="checkin-header">
        <span className="checkin-title">오늘 독서 체크</span>
        <span className={`checkin-progress ${allChecked ? 'done' : ''}`}>
          {allChecked ? '모두 완료 🎉' : `${checkedCount} / ${readingBooks.length}`}
        </span>
      </div>
      <div className="checkin-list">
        {readingBooks.map(book => {
          const dates = checkins[book.id] ?? [];
          const checked = dates.includes(today);
          const streak = getStreak(dates);
          return (
            <button
              key={book.id}
              className={`checkin-item ${checked ? 'checked' : ''}`}
              onClick={() => toggle(book.id)}
            >
              {book.cover
                ? <img src={book.cover} alt="" className="checkin-cover" />
                : <div className="checkin-cover checkin-cover-empty"><BookOpen size={14} /></div>
              }
              <span className="checkin-book-title">{book.title}</span>
              {streak > 0 && (
                <span className="checkin-streak">
                  <Flame size={12} />{streak}일
                </span>
              )}
              <span className="checkin-check-icon">
                {checked ? <CheckCircle2 size={22} /> : <Circle size={22} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
