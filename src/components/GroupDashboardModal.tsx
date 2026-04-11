import { useState, useEffect } from 'react';
import { X, Award, BookOpen, CheckCircle, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Book } from '../types';

interface MemberStat {
  user_id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  total_points: number;
}

interface Props {
  books: Book[];
  onClose: () => void;
}

export default function GroupDashboardModal({ books, onClose }: Props) {
  const [members, setMembers] = useState<MemberStat[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error: rpcError } = await supabase.rpc('get_group_member_points');
      if (rpcError) {
        console.error('get_group_member_points error:', rpcError);
        setError(rpcError.message);
      } else if (data) {
        // total_points can come back as string (bigint) from Supabase — coerce to number
        const parsed = (data as MemberStat[]).map(m => ({
          ...m,
          total_points: Number(m.total_points),
        }));
        setMembers(parsed.slice().sort((a, b) => b.total_points - a.total_points));
      }
      setLoading(false);
    };
    load();
  }, []);

  const maxPoints = Math.max(...members.map(m => m.total_points), 1);

  // 멤버별 책 통계
  const getBookStats = (userId: string) => {
    const userBooks = books.filter(b => b.userId === userId);
    return {
      total: userBooks.length,
      finished: userBooks.filter(b => b.status === 'finished').length,
      reading: userBooks.filter(b => b.status === 'reading').length,
    };
  };

  // 순위 메달 색
  const rankColor = (i: number) =>
    i === 0 ? '#f5c518' : i === 1 ? '#adb5bd' : i === 2 ? '#cd7f32' : 'var(--text-muted)';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 560 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>그룹 통계</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-form">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <Loader size={24} className="spin" style={{ color: 'var(--accent)' }} />
            </div>
          ) : error ? (
            <div style={{ padding: '24px 0', textAlign: 'center' }}>
              <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>데이터를 불러오지 못했어요.</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{error}</p>
            </div>
          ) : members.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>
              그룹에 참여한 멤버가 없어요.
            </p>
          ) : (
            <>
              {/* 포인트 바 차트 */}
              <h3 className="gd-section-title">
                <Award size={15} style={{ display: 'inline', marginRight: 5 }} />
                포인트 랭킹
              </h3>
              <div className="gd-bar-chart">
                {members.map((m, i) => {
                  const pct = maxPoints > 0 ? (m.total_points / maxPoints) * 100 : 0;
                  return (
                    <div key={m.user_id} className="gd-bar-row">
                      {/* 순위 */}
                      <span className="gd-rank" style={{ color: rankColor(i) }}>
                        {i + 1}
                      </span>

                      {/* 아바타 + 이름 */}
                      <div className="gd-bar-label">
                        <div className="gd-avatar" style={{ background: `hsl(${m.display_name.charCodeAt(0) * 37 % 360}, 55%, 45%)` }}>
                          {m.avatar_url
                            ? <img src={m.avatar_url} alt={m.display_name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            : m.display_name[0].toUpperCase()}
                        </div>
                        <span className="gd-name">{m.display_name}</span>
                      </div>

                      {/* 바 */}
                      <div className="gd-bar-track">
                        <div
                          className="gd-bar-fill"
                          style={{
                            width: `${pct}%`,
                            background: i === 0 ? 'linear-gradient(90deg, #f5c518, #f5a623)'
                              : i === 1 ? 'linear-gradient(90deg, #adb5bd, #868e96)'
                              : 'linear-gradient(90deg, var(--accent), #5ba8e5)',
                          }}
                        />
                      </div>

                      {/* 포인트 수 */}
                      <span className="gd-bar-pts">{m.total_points}pt</span>
                    </div>
                  );
                })}
              </div>

              {/* 독서 현황 */}
              <h3 className="gd-section-title" style={{ marginTop: 24 }}>
                <BookOpen size={15} style={{ display: 'inline', marginRight: 5 }} />
                독서 현황
              </h3>
              <div className="gd-book-stats">
                {members.map(m => {
                  const s = getBookStats(m.user_id);
                  return (
                    <div key={m.user_id} className="gd-book-row">
                      <div className="gd-avatar-sm" style={{ background: `hsl(${m.display_name.charCodeAt(0) * 37 % 360}, 55%, 45%)` }}>
                        {m.avatar_url
                          ? <img src={m.avatar_url} alt={m.display_name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                          : m.display_name[0].toUpperCase()}
                      </div>
                      <span className="gd-name" style={{ flex: 1 }}>{m.display_name}</span>
                      <div className="gd-book-badges">
                        <span className="gd-badge" style={{ color: '#2ecc71' }}>
                          <CheckCircle size={12} /> 완독 {s.finished}
                        </span>
                        <span className="gd-badge" style={{ color: '#3b7fd4' }}>
                          <BookOpen size={12} /> 읽는 중 {s.reading}
                        </span>
                        <span className="gd-badge">
                          전체 {s.total}권
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="modal-footer" style={{ marginTop: 16 }}>
            <button type="button" className="btn-secondary" onClick={onClose}>닫기</button>
          </div>
        </div>
      </div>
    </div>
  );
}
