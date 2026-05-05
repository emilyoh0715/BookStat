import { useState, useMemo } from 'react';
import { BookOpen, TrendingUp, Clock, RefreshCw, Sparkles } from 'lucide-react';
import type { Book } from '../types';
import type { Profile } from '../contexts/AuthContext';
import type { MemberStat } from './GroupDashboard';
import { getApiKey } from '../services/claudeVocab';

type Period = 'week' | 'month' | 'year';
type Scope = 'mine' | 'family';

interface Props {
  books: Book[];
  userId: string;
  groupMembers: Profile[];
  groupMemberPoints: MemberStat[];
}

const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
const GENRE_COLORS = ['#7AA7FF', '#7CCEB4', '#FFC857', '#ab47bc', '#e91e8c', '#26c6da', '#f5a623', '#2ecc71', '#e74c3c', '#95a5a6'];

// 점들을 부드러운 베지어 곡선으로 연결
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

// 도넛 차트
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

export default function StatsView({ books, userId, groupMembers }: Props) {
  const [period, setPeriod] = useState<Period>('month');
  const [scope, setScope] = useState<Scope>('mine');
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const now = new Date();

  const inPeriod = (dateStr: string | undefined): boolean => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (period === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      return d >= weekAgo && d <= now;
    }
    if (period === 'month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    return d.getFullYear() === now.getFullYear();
  };

  const targetBooks = useMemo(() =>
    scope === 'family' ? books : books.filter(b => b.userId === userId),
    [books, userId, scope]
  );

  const finishedInPeriod = useMemo(() =>
    targetBooks.filter(b => b.status === 'finished' && inPeriod(b.finishDate)),
    [targetBooks, period] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const totalPages = finishedInPeriod.reduce((s, b) => s + (b.totalPages ?? 0), 0);
  const hasPages = finishedInPeriod.some(b => (b.totalPages ?? 0) > 0);

  // 평균 완독 기간 (startDate → finishDate 일수 평균)
  const avgDaysPerBook = useMemo(() => {
    const withDates = finishedInPeriod.filter(b => b.startDate && b.finishDate);
    if (withDates.length === 0) return null;
    const total = withDates.reduce((s, b) => {
      const diff = (new Date(b.finishDate!).getTime() - new Date(b.startDate!).getTime()) / 86400000;
      return s + Math.max(diff, 0);
    }, 0);
    return Math.round(total / withDates.length);
  }, [finishedInPeriod]);

  // 장르 비율
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

  // 요일별 완독 분포
  const dowData = useMemo(() => {
    const counts = Array(7).fill(0);
    finishedInPeriod.forEach(b => {
      if (b.finishDate) counts[new Date(b.finishDate).getDay()]++;
    });
    return counts;
  }, [finishedInPeriod]);
  const maxDow = Math.max(...dowData, 1);

  // 월별 추이 (최근 6개월)
  const months6 = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const mb = targetBooks.filter(b => b.status === 'finished' && b.finishDate?.startsWith(key));
      return {
        label: `${d.getMonth() + 1}월`,
        count: mb.length,
        pages: mb.reduce((s, b) => s + (b.totalPages ?? 0), 0),
      };
    });
  }, [targetBooks]);

  // SVG 라인 차트 좌표 계산
  const cW = 300, cH = 110, pL = 28, pR = 12, pT = 14, pB = 22;
  const iW = cW - pL - pR, iH = cH - pT - pB;
  const maxCnt = Math.max(...months6.map(m => m.count), 1);
  const maxPgs = Math.max(...months6.map(m => m.pages), 1);
  const n = months6.length;

  const countPts = months6.map((m, i) => ({
    x: pL + (i / (n - 1)) * iW,
    y: pT + iH - (m.count / maxCnt) * iH,
  }));
  const pagePts = months6.map((m, i) => ({
    x: pL + (i / (n - 1)) * iW,
    y: pT + iH - (m.pages / maxPgs) * iH,
  }));

  // AI 한줄 요약 생성
  const generateAi = async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setAiSummary('설정에서 Claude API 키를 입력하면 AI 분석을 사용할 수 있어요 🔑');
      return;
    }
    setAiLoading(true);
    setAiSummary(null);
    const periodLabel = period === 'week' ? '이번 주' : period === 'month' ? '이번 달' : '올해';
    const scopeLabel = scope === 'mine' ? '나' : '우리 가족';
    const topGenre = genreData[0]?.label ?? '기록 없음';
    const bestDay = DAYS_KO[dowData.indexOf(Math.max(...dowData))];
    const prompt = `${scopeLabel}의 독서 통계:
- ${periodLabel} 완독: ${finishedInPeriod.length}권
- 총 읽은 페이지: ${hasPages ? totalPages.toLocaleString() + 'p' : '기록 없음'}
- 평균 완독 기간: ${avgDaysPerBook != null ? avgDaysPerBook + '일/권' : '기록 없음'}
- 가장 많이 읽은 장르: ${topGenre}
- 완독이 많은 요일: ${bestDay}요일

이 독서 습관을 분석해서 따뜻하고 구체적인 칭찬/응원을 한 문장으로 써줘. 이모지 1개 포함. 한국어로만.`;
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 150,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json() as { content?: { text: string }[] };
      setAiSummary(data.content?.[0]?.text?.trim() ?? '분석을 생성하지 못했어요.');
    } catch {
      setAiSummary('분석 중 오류가 발생했어요. 다시 시도해주세요.');
    }
    setAiLoading(false);
  };

  const scopeName = scope === 'mine'
    ? (groupMembers.find(m => m.id === userId)?.display_name ?? '나')
    : '가족 전체';

  const periodLabel = period === 'week' ? '이번 주' : period === 'month' ? '이번 달' : '올해';

  return (
    <div className="stats-view">

      {/* 기간 + 범위 선택 */}
      <div className="stats-controls">
        <div className="stats-seg-group">
          {(['week', 'month', 'year'] as Period[]).map(p => (
            <button key={p}
              className={`stats-seg-btn ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}>
              {p === 'week' ? '주간' : p === 'month' ? '월간' : '연간'}
            </button>
          ))}
        </div>
        <div className="stats-seg-group">
          <button className={`stats-seg-btn ${scope === 'mine' ? 'active' : ''}`} onClick={() => setScope('mine')}>
            내 통계
          </button>
          {groupMembers.length > 1 && (
            <button className={`stats-seg-btn ${scope === 'family' ? 'active' : ''}`} onClick={() => setScope('family')}>
              가족 통계
            </button>
          )}
        </div>
      </div>

      <p className="stats-scope-label">{scopeName} · {periodLabel}</p>

      {/* 요약 카드 3개 */}
      <div className="stats-summary-row">
        <div className="stats-summary-card">
          <BookOpen size={15} className="stats-summary-icon" style={{ color: 'var(--accent)' }} />
          <span className="stats-summary-val">{finishedInPeriod.length}</span>
          <span className="stats-summary-unit">권</span>
          <span className="stats-summary-lbl">읽은 책</span>
        </div>
        <div className="stats-summary-card">
          <TrendingUp size={15} className="stats-summary-icon" style={{ color: 'var(--accent-yellow)' }} />
          <span className="stats-summary-val" style={{ fontSize: hasPages && totalPages > 999 ? 18 : undefined }}>
            {hasPages ? totalPages.toLocaleString() : '--'}
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

      {/* 월별 독서 추이 */}
      <div className="stats-card">
        <div className="stats-card-header">
          <span className="stats-card-title">월별 독서 추이</span>
          <div className="stats-chart-legend">
            <span className="stats-legend-item">
              <span className="stats-legend-dot" style={{ background: 'var(--accent)' }} /> 책 수
            </span>
            {months6.some(m => m.pages > 0) && (
              <span className="stats-legend-item">
                <span className="stats-legend-dot" style={{ background: 'var(--accent-yellow)' }} /> 페이지
              </span>
            )}
          </div>
        </div>
        <svg viewBox={`0 0 ${cW} ${cH}`} className="stats-line-chart">
          {/* 수평 그리드 */}
          {[0, 0.5, 1].map(t => (
            <line key={t}
              x1={pL} y1={pT + iH * (1 - t)}
              x2={cW - pR} y2={pT + iH * (1 - t)}
              stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
          ))}
          {/* 페이지 곡선 (노란색) */}
          {months6.some(m => m.pages > 0) && (
            <path d={smoothPath(pagePts)} fill="none"
              stroke="var(--accent-yellow)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          )}
          {/* 책 수 곡선 아래 영역 */}
          <path
            d={`${smoothPath(countPts)} L ${countPts[n - 1].x.toFixed(1)} ${(pT + iH).toFixed(1)} L ${countPts[0].x.toFixed(1)} ${(pT + iH).toFixed(1)} Z`}
            fill="var(--accent)" opacity="0.08" />
          {/* 책 수 곡선 */}
          <path d={smoothPath(countPts)} fill="none"
            stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
          {/* 점 */}
          {countPts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill="var(--bg-surface)" stroke="var(--accent)" strokeWidth="2" />
              {months6[i].count > 0 && (
                <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill="var(--accent)" fontWeight="700">
                  {months6[i].count}
                </text>
              )}
            </g>
          ))}
          {/* X축 레이블 */}
          {months6.map((m, i) => (
            <text key={i}
              x={pL + (i / (n - 1)) * iW} y={cH - 4}
              textAnchor="middle" fontSize="9" fill="var(--text-muted)">
              {m.label}
            </text>
          ))}
          {/* Y축 최댓값 */}
          <text x={pL - 4} y={pT + 3} textAnchor="end" fontSize="8" fill="var(--text-muted)">{maxCnt}</text>
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
          <button
            className="stats-ai-btn"
            onClick={generateAi}
            disabled={aiLoading}
          >
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
  );
}
