import { useState, useMemo } from 'react';
import { BookOpen, TrendingUp, Clock, RefreshCw, Sparkles, CheckCircle, PauseCircle, Bookmark, Star, MessageSquare, Award } from 'lucide-react';
import type { Book } from '../types';
import type { Profile } from '../contexts/AuthContext';
import type { MemberStat } from './GroupDashboard';
import { generateStatsSummary, getApiKey } from '../services/geminiAi';

type Period = 'month' | 'year' | 'all';
type ChartMetric = 'count' | 'pages';

interface Props {
  books: Book[];
  userId: string;
  groupMembers: Profile[];
  groupMemberPoints: MemberStat[];
}

const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
const GENRE_COLORS = ['#7AA7FF', '#7CCEB4', '#FFC857', '#ab47bc', '#e91e8c', '#26c6da', '#f5a623', '#2ecc71', '#e74c3c', '#95a5a6'];

function fmtPages(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function fmtVal(n: number, metric: ChartMetric): string {
  if (metric === 'pages') return fmtPages(n);
  return `${n}`;
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  const d = [`M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i];
    const mx = ((p.x + c.x) / 2).toFixed(1);
    d.push(`C ${mx} ${p.y.toFixed(1)},${mx} ${c.y.toFixed(1)},${c.x.toFixed(1)} ${c.y.toFixed(1)}`);
  }
  return d.join(' ');
}

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p className="stats-empty">데이터 없음</p>;

  const r = 38, cx = 50, cy = 50, sw = 16;
  let angle = -Math.PI / 2;

  const arcs = data.map(d => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle), y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    return {
      path: `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      color: d.color, label: d.label,
      pct: Math.round((d.value / total) * 100),
    };
  });

  return (
    <div className="stats-donut-wrap">
      <svg viewBox="0 0 100 100" className="stats-donut-svg">
        {arcs.map((a, i) => (
          <path key={i} d={a.path} fill="none" stroke={a.color} strokeWidth={sw} />
        ))}
        <circle cx={cx} cy={cy} r={r - sw / 2 - 1} fill="var(--bg-surface)" />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
          fontSize="14" fontWeight="800" fill="var(--text-heading)">{total}</text>
        <text x={cx} y={cy + 13} textAnchor="middle" dominantBaseline="middle"
          fontSize="7" fill="var(--text-muted)">권</text>
      </svg>
      <div className="stats-donut-legend">
        {arcs.map((a, i) => (
          <div key={i} className="stats-donut-item">
            <span className="stats-donut-dot" style={{ background: a.color }} />
            <span className="stats-donut-lbl">{a.label}</span>
            <span className="stats-donut-pct">{a.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StatsView({ books, userId, groupMembers, groupMemberPoints }: Props) {
  const [period, setPeriod] = useState<Period>('month');
  const [chartMetric, setChartMetric] = useState<ChartMetric>('count');
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const now = new Date();

  const inPeriod = (dateStr: string | undefined): boolean => {
    if (!dateStr) return false;
    if (period === 'all') return true;
    const d = new Date(dateStr);
    if (period === 'month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    return d.getFullYear() === now.getFullYear();
  };

  const targetBooks = useMemo(() =>
    books.filter(b => b.userId === userId),
    [books, userId]
  );

  // ── 내 통계 현황 (누적, 기간 무관) ──
  const myOverviewStats = useMemo(() => {
    const myBooks = books.filter(b => b.userId === userId);
    const finished   = myBooks.filter(b => b.status === 'finished').length;
    const reading    = myBooks.filter(b => b.status === 'reading').length;
    const paused     = myBooks.filter(b => b.status === 'paused').length;
    const wantToRead = myBooks.filter(b => b.status === 'want-to-read').length;
    const reviews    = myBooks.filter(b => b.review?.trim()).length;
    const ratedBooks = myBooks.filter(b => (b.rating ?? 0) > 0);
    const avgRating  = ratedBooks.length > 0
      ? (ratedBooks.reduce((s, b) => s + (b.rating ?? 0), 0) / ratedBooks.length).toFixed(1)
      : null;
    const points = groupMemberPoints.find(m => m.user_id === userId)?.total_points ?? 0;
    return { finished, reading, paused, wantToRead, reviews, avgRating, points };
  }, [books, userId, groupMemberPoints]);

  // ── 가족 통계 현황 (누적, 기간 무관) ──
  const familyOverviewStats = useMemo(() => {
    const finished   = books.filter(b => b.status === 'finished').length;
    const reading    = books.filter(b => b.status === 'reading').length;
    const paused     = books.filter(b => b.status === 'paused').length;
    const wantToRead = books.filter(b => b.status === 'want-to-read').length;
    const reviews    = books.filter(b => b.review?.trim()).length;
    const ratedBooks = books.filter(b => (b.rating ?? 0) > 0);
    const avgRating  = ratedBooks.length > 0
      ? (ratedBooks.reduce((s, b) => s + (b.rating ?? 0), 0) / ratedBooks.length).toFixed(1)
      : null;
    const points = groupMemberPoints.reduce((s, m) => s + (m.total_points ?? 0), 0);
    return { finished, reading, paused, wantToRead, reviews, avgRating, points };
  }, [books, groupMemberPoints]);

  // ── 기간별 분석 ──
  const finishedInPeriod = useMemo(() =>
    targetBooks.filter(b => b.status === 'finished' && inPeriod(b.finishDate)),
    [targetBooks, period] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const totalPages = finishedInPeriod.reduce((s, b) => s + (b.totalPages ?? 0), 0);
  const hasPages = finishedInPeriod.some(b => (b.totalPages ?? 0) > 0);

  const avgDaysPerBook = useMemo(() => {
    const withDates = finishedInPeriod.filter(b => b.startDate && b.finishDate);
    if (withDates.length === 0) return null;
    const total = withDates.reduce((s, b) => {
      const diff = (new Date(b.finishDate!).getTime() - new Date(b.startDate!).getTime()) / 86400000;
      return s + Math.max(diff, 0);
    }, 0);
    return Math.round(total / withDates.length);
  }, [finishedInPeriod]);

  const genreData = useMemo(() => {
    const counts: Record<string, number> = {};
    finishedInPeriod.forEach(b => {
      const g = b.genre?.trim() || '미분류';
      counts[g] = (counts[g] ?? 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v], i) => ({ label: k, value: v, color: GENRE_COLORS[i % GENRE_COLORS.length] }));
  }, [finishedInPeriod]);

  const dowData = useMemo(() => {
    const counts = Array(7).fill(0);
    finishedInPeriod.forEach(b => {
      if (b.finishDate) counts[new Date(b.finishDate).getDay()]++;
    });
    return counts;
  }, [finishedInPeriod]);
  const maxDow = Math.max(...dowData, 1);

  // ── 추이 차트 데이터 (기간에 따라 달라짐) ──
  const chartData = useMemo(() => {
    if (period === 'month') {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const weekBuckets = [
        { label: '1주', start: 1, end: 7 },
        { label: '2주', start: 8, end: 14 },
        { label: '3주', start: 15, end: 21 },
        { label: '4주', start: 22, end: daysInMonth },
      ];
      return weekBuckets.map(w => {
        const wb = targetBooks.filter(b => {
          if (b.status !== 'finished' || !b.finishDate) return false;
          const d = new Date(b.finishDate);
          return d.getFullYear() === now.getFullYear() &&
                 d.getMonth() === now.getMonth() &&
                 d.getDate() >= w.start && d.getDate() <= w.end;
        });
        return { label: w.label, count: wb.length, pages: wb.reduce((s, b) => s + (b.totalPages ?? 0), 0) };
      });
    }
    if (period === 'year') {
      return Array.from({ length: 12 }, (_, i) => {
        const key = `${now.getFullYear()}-${String(i + 1).padStart(2, '0')}`;
        const mb = targetBooks.filter(b => b.status === 'finished' && b.finishDate?.startsWith(key));
        return { label: `${i + 1}월`, count: mb.length, pages: mb.reduce((s, b) => s + (b.totalPages ?? 0), 0) };
      });
    }
    // 'all' — group by year
    const finished = targetBooks.filter(b => b.status === 'finished' && b.finishDate);
    if (finished.length === 0) return [{ label: `${now.getFullYear()}`, count: 0, pages: 0 }];
    const minYear = Math.min(...finished.map(b => new Date(b.finishDate!).getFullYear()));
    const maxYear = Math.max(...finished.map(b => new Date(b.finishDate!).getFullYear()), now.getFullYear());
    return Array.from({ length: maxYear - minYear + 1 }, (_, i) => {
      const year = minYear + i;
      const yb = finished.filter(b => new Date(b.finishDate!).getFullYear() === year);
      return { label: `${year}`, count: yb.length, pages: yb.reduce((s, b) => s + (b.totalPages ?? 0), 0) };
    });
  }, [targetBooks, period]); // eslint-disable-line react-hooks/exhaustive-deps

  const cW = 300, cH = 110, pL = 28, pR = 12, pT = 14, pB = 22;
  const iW = cW - pL - pR, iH = cH - pT - pB;
  const n = chartData.length;
  const maxVal = Math.max(...chartData.map(d => chartMetric === 'count' ? d.count : d.pages), 1);
  const pts = chartData.map((d, i) => ({
    x: pL + (n > 1 ? i / (n - 1) : 0.5) * iW,
    y: pT + iH - ((chartMetric === 'count' ? d.count : d.pages) / maxVal) * iH,
  }));

  const chartTitle = period === 'month' ? '주차별 독서 추이' : period === 'year' ? '월별 독서 추이' : '연도별 독서 추이';

  const generateAi = async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setAiSummary('설정에서 Gemini API 키를 입력하면 AI 분석을 사용할 수 있어요 🔑');
      return;
    }
    setAiLoading(true);
    setAiSummary(null);
    const pLabel = period === 'month' ? '이번 달' : period === 'year' ? '올해' : '전체 기간';
    const scopeLabel = '나';
    const topGenre = genreData[0]?.label ?? '기록 없음';
    const bestDay = DAYS_KO[dowData.indexOf(Math.max(...dowData))];
    const prompt = `${scopeLabel}의 독서 통계:
- ${pLabel} 완독: ${finishedInPeriod.length}권
- 총 읽은 페이지: ${hasPages ? totalPages.toLocaleString() + 'p' : '기록 없음'}
- 평균 완독 기간: ${avgDaysPerBook != null ? avgDaysPerBook + '일/권' : '기록 없음'}
- 가장 많이 읽은 장르: ${topGenre}
- 완독이 많은 요일: ${bestDay}요일

이 독서 습관을 분석해서 따뜻하고 구체적인 칭찬/응원을 한 문장으로 써줘. 이모지 1개 포함. 한국어로만.`;
    try {
      const summary = await generateStatsSummary(prompt);
      setAiSummary(summary || '분석을 생성하지 못했어요.');
    } catch {
      setAiSummary('분석 중 오류가 발생했어요. 다시 시도해주세요.');
    }
    setAiLoading(false);
  };

  const scopeName = groupMembers.find(m => m.id === userId)?.display_name ?? '나';

  const periodLabel = period === 'month' ? '이번 달' : period === 'year' ? '올해' : '전체 기간';

  // overview items helper
  const renderOverviewItems = (stats: typeof myOverviewStats) => (
    <>
      <div className="stats-overview-status">
        <div className="stats-overview-item">
          <CheckCircle size={14} className="stats-overview-icon" style={{ color: '#2ecc71' }} />
          <span className="stats-overview-val">{stats.finished}</span>
          <span className="stats-overview-lbl">완독</span>
        </div>
        <div className="stats-overview-item">
          <BookOpen size={14} className="stats-overview-icon" style={{ color: '#3b7fd4' }} />
          <span className="stats-overview-val">{stats.reading}</span>
          <span className="stats-overview-lbl">읽는 중</span>
        </div>
        <div className="stats-overview-item">
          <PauseCircle size={14} className="stats-overview-icon" style={{ color: '#a78bfa' }} />
          <span className="stats-overview-val">{stats.paused}</span>
          <span className="stats-overview-lbl">멈춤</span>
        </div>
        <div className="stats-overview-item">
          <Bookmark size={14} className="stats-overview-icon" style={{ color: '#5ba8e5' }} />
          <span className="stats-overview-val">{stats.wantToRead}</span>
          <span className="stats-overview-lbl">읽고 싶음</span>
        </div>
      </div>
      <div className="stats-overview-meta">
        <div className="stats-overview-item">
          <Star size={14} className="stats-overview-icon" style={{ color: '#f5c518' }} />
          <span className="stats-overview-val">{stats.avgRating ?? '—'}</span>
          <span className="stats-overview-lbl">평균 별점</span>
        </div>
        <div className="stats-overview-item">
          <MessageSquare size={14} className="stats-overview-icon" style={{ color: '#e67e22' }} />
          <span className="stats-overview-val">{stats.reviews}</span>
          <span className="stats-overview-lbl">후기</span>
        </div>
        <div className="stats-overview-item">
          <Award size={14} className="stats-overview-icon" style={{ color: '#f5a623' }} />
          <span className="stats-overview-val">{stats.points.toLocaleString()}</span>
          <span className="stats-overview-lbl">포인트</span>
        </div>
      </div>
    </>
  );

  return (
    <div className="stats-view">

      {/* 왼쪽: 항상 표시되는 개요 카드들 */}
      <div className="stats-left-col">

        {/* 내 통계 */}
        <div className="stats-scope-card">
          <p className="stats-scope-card-title">내 통계</p>
          {renderOverviewItems(myOverviewStats)}
        </div>

        {/* 가족 통계 */}
        {groupMembers.length > 1 && (
          <div className="stats-scope-card">
            <p className="stats-scope-card-title">가족 통계</p>
            {renderOverviewItems(familyOverviewStats)}
          </div>
        )}

      </div>

      {/* 오른쪽: 기간별 차트 */}
      <div className="stats-right-col">

        {/* 기간 선택 */}
        <div className="stats-period-bar">
          <span className="stats-period-label">내 독서 분석</span>
          <div className="stats-seg-group">
            {(['month', 'year', 'all'] as Period[]).map(p => (
              <button key={p}
                className={`stats-seg-btn ${period === p ? 'active' : ''}`}
                onClick={() => setPeriod(p)}>
                {p === 'month' ? '월간' : p === 'year' ? '연간' : '전체기간'}
              </button>
            ))}
          </div>
        </div>

        <p className="stats-scope-label">{scopeName} · {periodLabel}</p>

        {/* 기간별 요약 3카드 */}
        <div className="stats-summary-row">
          <div className="stats-summary-card">
            <BookOpen size={15} className="stats-summary-icon" style={{ color: 'var(--accent)' }} />
            <span className="stats-summary-val">{finishedInPeriod.length}</span>
            <span className="stats-summary-unit">권</span>
            <span className="stats-summary-lbl">읽은 책</span>
          </div>
          <div className="stats-summary-card">
            <TrendingUp size={15} className="stats-summary-icon" style={{ color: 'var(--accent-yellow)' }} />
            <span className="stats-summary-val">
              {hasPages ? fmtPages(totalPages) : '--'}
            </span>
            {hasPages && <span className="stats-summary-unit">p</span>}
            <span className="stats-summary-lbl">읽은 페이지</span>
          </div>
          <div className="stats-summary-card">
            <Clock size={15} className="stats-summary-icon" style={{ color: '#7CCEB4' }} />
            <span className="stats-summary-val">{avgDaysPerBook != null ? avgDaysPerBook : '--'}</span>
            {avgDaysPerBook != null && <span className="stats-summary-unit">일</span>}
            <span className="stats-summary-lbl">평균 완독 기간</span>
          </div>
        </div>

        {/* 독서 추이 차트 */}
        <div className="stats-card">
          <div className="stats-card-header">
            <span className="stats-card-title">{chartTitle}</span>
            <div className="stats-metric-toggle">
              <button
                className={`stats-metric-btn ${chartMetric === 'count' ? 'active' : ''}`}
                onClick={() => setChartMetric('count')}>
                책 수
              </button>
              <button
                className={`stats-metric-btn ${chartMetric === 'pages' ? 'active' : ''}`}
                onClick={() => setChartMetric('pages')}>
                페이지
              </button>
            </div>
          </div>
          <svg viewBox={`0 0 ${cW} ${cH}`} className="stats-line-chart">
            {[0, 0.5, 1].map(t => (
              <line key={t}
                x1={pL} y1={pT + iH * (1 - t)}
                x2={cW - pR} y2={pT + iH * (1 - t)}
                stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
            ))}
            <path
              d={`${smoothPath(pts)} L ${pts[n - 1].x.toFixed(1)} ${(pT + iH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(pT + iH).toFixed(1)} Z`}
              fill="var(--accent)" opacity="0.08" />
            <path d={smoothPath(pts)} fill="none"
              stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
            {pts.map((p, i) => {
              const val = chartMetric === 'count' ? chartData[i].count : chartData[i].pages;
              return (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="4" fill="var(--bg-surface)" stroke="var(--accent)" strokeWidth="2" />
                  {val > 0 && (
                    <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill="var(--accent)" fontWeight="700">
                      {fmtVal(val, chartMetric)}
                    </text>
                  )}
                </g>
              );
            })}
            {chartData.map((d, i) => (period !== 'year' || i % 2 === 0) && (
              <text key={i}
                x={pL + (n > 1 ? i / (n - 1) : 0.5) * iW} y={cH - 4}
                textAnchor="middle" fontSize="9" fill="var(--text-muted)">
                {d.label}
              </text>
            ))}
            <text x={pL - 4} y={pT + 3} textAnchor="end" fontSize="8" fill="var(--text-muted)">
              {fmtVal(maxVal, chartMetric)}
            </text>
            <text x={pL - 4} y={pT + iH + 3} textAnchor="end" fontSize="8" fill="var(--text-muted)">0</text>
          </svg>
        </div>

        {/* 장르 비율 + 요일별 완독 */}
        <div className="stats-two-col">
          <div className="stats-card">
            <span className="stats-card-title">장르 비율</span>
            <DonutChart data={genreData} />
          </div>
          <div className="stats-card">
            <span className="stats-card-title">요일별 완독</span>
            <div className="stats-dow-chart">
              {dowData.map((v, i) => (
                <div key={i} className="stats-dow-col">
                  <div className="stats-dow-bar-track">
                    <div
                      className="stats-dow-bar"
                      style={{
                        height: `${(v / maxDow) * 100}%`,
                        background: v === Math.max(...dowData) && v > 0 ? 'var(--accent)' : v > 0 ? 'color-mix(in srgb, var(--accent) 45%, transparent)' : 'var(--border)',
                      }}
                    />
                  </div>
                  <span className="stats-dow-lbl">{DAYS_KO[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI 한줄 분석 */}
        <div className="stats-ai-card">
          <div className="stats-ai-header">
            <span className="stats-ai-tag">
              <Sparkles size={13} /> AI 독서 분석
            </span>
            <button className="stats-ai-btn" onClick={generateAi} disabled={aiLoading}>
              {aiLoading
                ? <><RefreshCw size={11} className="spin" /> 분석 중</>
                : aiSummary ? '다시 생성' : '분석하기'}
            </button>
          </div>
          {aiSummary
            ? <p className="stats-ai-text">{aiSummary}</p>
            : <p className="stats-ai-placeholder">버튼을 누르면 AI가 내 독서 습관을 한 문장으로 분석해드려요 ✨</p>
          }
        </div>

      </div>

    </div>
  );
}
