import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_KEY  as string;

async function fetchAladinCover(title: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/aladin-cover?title=${encodeURIComponent(title)}`,
      { headers: { Authorization: `Bearer ${SUPABASE_ANON}` } },
    );
    const json = await res.json();
    return (json.cover as string | null) ?? null;
  } catch {
    return null;
  }
}

interface BookEntry {
  num:    number;
  title:  string;
  author: string;
  emoji:  string;
  color:  string;
  desc:   string;
  tags:   string[];
}

const BOOKS: BookEntry[] = [
  {
    num: 1, title: '마당을 나온 암탉', author: '황선미',
    emoji: '🐔', color: '#f97316',
    desc: '닭장에 갇혀 살던 암탉이 어느 날 결심했어. "나도 알을 품어 보고 싶어!" 용감하게 탈출한 잎싹의 여정, 도대체 어떻게 끝날까? 마지막 장면은 각오하고 읽어.',
    tags: ['성장', '용기'],
  },
  {
    num: 2, title: '내 짝꿍 최영대', author: '채인선',
    emoji: '🤝', color: '#3b82f6',
    desc: '반 친구가 따돌림을 당하고 있는데 나는 어떻게 해야 할까? 이 책의 주인공도 똑같이 고민했어. 진짜 용기가 뭔지, 읽고 나면 알게 될 거야.',
    tags: ['우정', '공감'],
  },
  {
    num: 3, title: '만복이네 떡집', author: '김리리',
    emoji: '🍡', color: '#8b5cf6',
    desc: '소원을 이뤄 주는 신기한 떡이 있다면 넌 뭘 빌겠어? 만복이는 이 특별한 떡집에서 진짜 원하는 게 뭔지 알아가게 돼. 결말이 생각보다 따뜻해!',
    tags: ['판타지', '소원'],
  },
  {
    num: 4, title: '과학하고 앉아있네 1', author: '이정모',
    emoji: '🔬', color: '#10b981',
    desc: '방귀는 왜 냄새날까? 하늘은 왜 파랄까? 매일 궁금했던 것들을 속 시원하게 알려 주는 책이야. 읽다 보면 나도 모르게 친구한테 떠들고 싶어질 거야!',
    tags: ['과학', '호기심'],
  },
  {
    num: 5, title: '어린이 살아있는 한국사 교과서', author: '이이화 외',
    emoji: '🏯', color: '#f59e0b',
    desc: '교과서보다 훨씬 재밌는 우리나라 역사 이야기! 삼국시대부터 조선까지, 그림과 함께 읽다 보면 역사 시험도 겁나지 않아.',
    tags: ['역사', '한국'],
  },
  {
    num: 6, title: '샬롯의 거미줄', author: 'E.B. 화이트',
    emoji: '🕸️', color: '#6366f1',
    desc: '돼지 윌버의 목숨을 구하기 위해 거미 샬롯이 선택한 방법은… 거미줄에 글씨를 쓰는 거야! 우정이 뭔지 진짜로 보여 주는 이야기, 마지막엔 울 수도 있어.',
    tags: ['우정', '감동'],
  },
  {
    num: 7, title: '내 이름은 삐삐', author: '아스트리드 린드그렌',
    emoji: '⚡', color: '#ef4444',
    desc: '부모님 없이 혼자 사는 아홉 살 소녀인데, 세상에서 제일 힘센 사람이야! 괴짜 삐삐의 엉뚱한 모험을 읽다 보면 나도 마음껏 자유롭고 싶어질 거야.',
    tags: ['자유', '모험'],
  },
  {
    num: 8, title: '찰리와 초콜릿 공장', author: '로알드 달',
    emoji: '🍫', color: '#a16207',
    desc: '황금 티켓 하나로 초콜릿 공장에 들어갈 수 있다면? 찰리는 과연 어떻게 될까? 읽는 내내 입에 침이 고이는, 세상에서 가장 달콤한 이야기!',
    tags: ['판타지', '상상'],
  },
  {
    num: 9, title: '파브르 곤충기 (어린이판)', author: '장 앙리 파브르',
    emoji: '🐛', color: '#16a34a',
    desc: '개미는 진짜 부지런할까? 사마귀는 왜 짝을 잡아먹을까? 40년 동안 곤충만 관찰한 파브르 아저씨의 놀라운 발견들! 자연이 이렇게 신기하다고?',
    tags: ['자연', '관찰'],
  },
  {
    num: 10, title: '어린 왕자', author: '앙투안 드 생텍쥐페리',
    emoji: '🌹', color: '#ec4899',
    desc: '"진짜 중요한 건 눈에 보이지 않아." 작은 행성에서 온 왕자와 사막에 불시착한 비행사의 이야기. 읽을 때마다 새로운 걸 발견하는 신기한 책이야.',
    tags: ['철학', '감성'],
  },
];

function BookCard({ book, coverUrl }: { book: BookEntry; coverUrl?: string | null }) {
  return (
    <div className="mag-book-card">
      <div className="mag-book-left">
        <div className="mag-book-num-circle" style={{ background: book.color }}>
          {book.num}
        </div>
        <div
          className="mag-book-cover"
          style={coverUrl ? undefined : { background: `${book.color}20`, border: `1.5px solid ${book.color}35` }}
        >
          {coverUrl
            ? <img src={coverUrl} alt={book.title} className="mag-book-cover-img" />
            : <span className="mag-book-cover-emoji">{book.emoji}</span>
          }
        </div>
      </div>
      <div className="mag-book-content">
        <h4 className="mag-book-title">{book.title}</h4>
        <p className="mag-book-author">{book.author}</p>
        <p className="mag-book-desc">{book.desc}</p>
        <div className="mag-book-tags">
          {book.tags.map(t => (
            <span key={t} className="mag-book-tag" style={{ background: `${book.color}18`, color: book.color }}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

interface Props { onClose: () => void; }

export default function MagazineArticle({ onClose }: Props) {
  const [covers, setCovers] = useState<Record<number, string>>({});

  useEffect(() => {
    BOOKS.forEach(book => {
      fetchAladinCover(book.title).then(url => {
        if (url) setCovers(prev => ({ ...prev, [book.num]: url }));
      });
    });
  }, []);

  return (
    <div className="mag-overlay">
      {/* Sticky topbar */}
      <div className="mag-topbar">
        <button className="mag-back-btn" onClick={onClose}>
          <ArrowLeft size={17} /> 뒤로
        </button>
        <span className="mag-topbar-label">오늘의 매거진</span>
        <div style={{ width: 64 }} />
      </div>

      <div className="mag-body">
        {/* Hero */}
        <div className="mag-hero">
          <div className="mag-hero-content">
            <div className="mag-hero-text">
              <span className="mag-hero-badge">📚 BOOK LIST</span>
              <h1 className="mag-hero-title">
                초3~초4가 읽기 좋은<br />
                <em className="mag-hero-accent">책 10권</em>
              </h1>
              <p className="mag-hero-sub">재밌어서 읽다 보면<br />생각이 자라는 책들</p>
            </div>
            <div className="mag-hero-visual" aria-hidden="true">
              <span className="mag-hero-deco-star1">⭐</span>
              <span className="mag-hero-deco-circle" />
              <div className="mag-hero-char">
                <span className="mag-hero-char-emoji">🧒</span>
                <div className="mag-hero-char-books">📚</div>
                <span className="mag-hero-char-label">Bookstat</span>
              </div>
              <span className="mag-hero-deco-sparkle">✦</span>
            </div>
          </div>
        </div>

        {/* Greeting */}
        <div className="mag-greeting">
          <p className="mag-greeting-hi">👋 안녕하세요, Bookstat 친구들!</p>
          <div className="mag-greeting-body">
            <p>책 읽는 걸 좋아하는 친구도 있고,<br />"음… 아직은 게임이 더 재밌는데?" 하는 친구도 있을 거예요.</p>
            <p>근데 신기하게도, 딱 맞는 책을 만나면 시간이 훅 지나가요.</p>
            <p>오늘은 Bookstat이 웃기고, 신기하고, 생각할 거리도 있는<br /><strong>"10살 친구들이 읽기 좋은 책 10권"</strong>을 골라봤어요!</p>
          </div>
          <span className="mag-greeting-heart" aria-hidden="true">🩵</span>
        </div>

        {/* Book list */}
        <div className="mag-list-hd">
          <span>⭐</span>
          <span>추천 도서 10권</span>
        </div>
        <div className="mag-book-list">
          {BOOKS.map(b => <BookCard key={b.num} book={b} coverUrl={covers[b.num]} />)}
        </div>

        {/* Footer */}
        <div className="mag-footer">
          <p>북스탯 매거진 · 2026년 5월호</p>
        </div>
      </div>
    </div>
  );
}
