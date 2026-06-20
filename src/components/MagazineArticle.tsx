import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, CalendarDays, MessageSquare, Quote, Star, Trophy, Languages, Plus } from 'lucide-react';

export type MagazineArticleType = 'points' | 'books';

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

interface PointMission {
  title: string;
  points: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
}

const MISSIONS: PointMission[] = [
  {
    title: '책 추가',
    points: '+2',
    desc: '읽고 싶은 책을 서재에 담으면 독서 출발!',
    icon: <Plus size={19} />,
    color: '#3b82f6',
  },
  {
    title: '읽기 기록',
    points: '+2',
    desc: '오늘 읽은 쪽수나 시간을 짧게 남겨요.',
    icon: <CalendarDays size={19} />,
    color: '#10b981',
  },
  {
    title: '한 줄 감상',
    points: '+4',
    desc: '읽는 중 떠오른 생각 하나면 충분해요.',
    icon: <MessageSquare size={19} />,
    color: '#f97316',
  },
  {
    title: '책속 문장 저장',
    points: '+5',
    desc: '마음에 남은 문장은 나만의 보물 문장으로.',
    icon: <Quote size={19} />,
    color: '#8b5cf6',
  },
  {
    title: '완독',
    points: '+10~25',
    desc: '마지막 장까지 도착하면 페이지 수만큼 쑥!',
    icon: <Trophy size={19} />,
    color: '#f59e0b',
  },
  {
    title: '완독 감상문',
    points: '+15~40',
    desc: '다 읽은 뒤 생각을 정리하면 가장 큰 기록 완성.',
    icon: <Star size={19} />,
    color: '#ec4899',
  },
];

function MissionCard({ mission }: { mission: PointMission }) {
  return (
    <div className="mag-point-card">
      <div className="mag-point-icon" style={{ color: mission.color, background: `${mission.color}16` }}>
        {mission.icon}
      </div>
      <div className="mag-point-copy">
        <h4>{mission.title}</h4>
        <p>{mission.desc}</p>
      </div>
      <strong className="mag-point-value" style={{ color: mission.color }}>{mission.points}</strong>
    </div>
  );
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
    desc: '돼지 윌버의 목숨을 구하기 위해 거미 샬롯이 선택한 방법은... 거미줄에 글씨를 쓰는 거야! 우정이 뭔지 진짜로 보여 주는 이야기, 마지막엔 울 수도 있어.',
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

interface Props {
  article: MagazineArticleType;
  onClose: () => void;
}

export default function MagazineArticle({ article, onClose }: Props) {
  const [covers, setCovers] = useState<Record<number, string>>({});

  useEffect(() => {
    if (article !== 'books') return;
    BOOKS.forEach(book => {
      fetchAladinCover(book.title).then(url => {
        if (url) setCovers(prev => ({ ...prev, [book.num]: url }));
      });
    });
  }, [article]);

  return (
    <div className="mag-overlay">
      <div className="mag-topbar">
        <button className="mag-back-btn" onClick={onClose}>
          <ArrowLeft size={17} /> 뒤로
        </button>
        <span className="mag-topbar-label">북스탯 매거진</span>
        <div style={{ width: 64 }} />
      </div>

      {article === 'points' ? (
      <article className="mag-body">
        <section className="mag-hero mag-hero--points">
          <div className="mag-hero-content">
            <div className="mag-hero-text">
              <span className="mag-hero-badge">POINT GUIDE</span>
              <h1 className="mag-hero-title">
                북스탯 포인트<br />
                <em className="mag-hero-accent">모으는 법</em>
              </h1>
              <p className="mag-hero-sub">읽고, 남기고, 도전하면<br />포인트가 차곡차곡 쌓여요.</p>
            </div>
            <div className="mag-point-visual" aria-hidden="true">
              <div className="mag-point-coin mag-point-coin--big">P</div>
              <div className="mag-point-book"><BookOpen size={34} /></div>
              <span className="mag-point-spark mag-point-spark--one">+2</span>
              <span className="mag-point-spark mag-point-spark--two">+5</span>
            </div>
          </div>
        </section>

        <section className="mag-greeting mag-greeting--points">
          <p className="mag-greeting-hi">책을 다 읽은 날만 특별한 건 아니에요.</p>
          <div className="mag-greeting-body">
            <p>오늘 조금 읽은 기록, 갑자기 떠오른 생각, 다시 보고 싶은 문장도 전부 독서의 일부예요.</p>
            <p>북스탯에서는 그런 작은 순간들이 포인트로 쌓입니다.</p>
          </div>
        </section>

        <section className="mag-point-section">
          <div className="mag-list-hd">
            <span>⭐</span>
            <span>포인트 미션</span>
          </div>
          <div className="mag-point-list">
            {MISSIONS.map(mission => <MissionCard key={mission.title} mission={mission} />)}
          </div>
        </section>

        <section className="mag-bonus-card">
          <div className="mag-bonus-icon">
            <Languages size={24} />
          </div>
          <div className="mag-bonus-copy">
            <span className="mag-bonus-label">도전 보너스</span>
            <h3>원서나 다른 언어 책은 1.5배</h3>
            <p>영어 원서처럼 다른 언어로 읽는 책은 더 큰 도전이에요. 그래서 완독 포인트와 완독 감상문 포인트가 1.5배로 쌓입니다.</p>
          </div>
        </section>

        <section className="mag-example-card">
          <p className="mag-example-kicker">예를 들면</p>
          <p className="mag-example-main">완독 포인트가 20점인 책을 원서로 읽으면</p>
          <div className="mag-example-equation">
            <span>20점</span>
            <span>×</span>
            <span>1.5</span>
            <span>=</span>
            <strong>30점</strong>
          </div>
        </section>

        <section className="mag-closing">
          <h3>포인트는 점수보다 기록에 가까워요.</h3>
          <p>내가 읽은 책, 붙잡은 문장, 남긴 생각이 독서노트에 쌓이고 포인트가 됩니다. 오늘은 어떤 기록을 남겨볼까요?</p>
        </section>

        <div className="mag-footer">
          <p>북스탯 매거진 · 포인트 가이드</p>
        </div>
      </article>
      ) : (
      <article className="mag-body">
        <section className="mag-hero mag-hero--books">
          <div className="mag-hero-content">
            <div className="mag-hero-text">
              <span className="mag-hero-badge">BOOK LIST</span>
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
        </section>

        <section className="mag-greeting">
          <p className="mag-greeting-hi">안녕하세요, Bookstat 친구들!</p>
          <div className="mag-greeting-body">
            <p>책 읽는 걸 좋아하는 친구도 있고, "음... 아직은 게임이 더 재밌는데?" 하는 친구도 있을 거예요.</p>
            <p>근데 신기하게도, 딱 맞는 책을 만나면 시간이 훅 지나가요.</p>
            <p>오늘은 Bookstat이 웃기고, 신기하고, 생각할 거리도 있는 <strong>"10살 친구들이 읽기 좋은 책 10권"</strong>을 골라봤어요!</p>
          </div>
          <span className="mag-greeting-heart" aria-hidden="true">♡</span>
        </section>

        <section>
          <div className="mag-list-hd">
            <span>⭐</span>
            <span>추천 도서 10권</span>
          </div>
          <div className="mag-book-list">
            {BOOKS.map(b => <BookCard key={b.num} book={b} coverUrl={covers[b.num]} />)}
          </div>
        </section>

        <div className="mag-footer">
          <p>북스탯 매거진 · 추천 도서</p>
        </div>
      </article>
      )}
    </div>
  );
}
