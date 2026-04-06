import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { X, Plus, Search, Check, UserPlus, Users, Trash2, LogOut } from 'lucide-react';

interface GroupMember {
  id: string;
  user_id: string;
  role: string;
  status: string;
  profiles: { display_name: string; handle: string; avatar_url?: string };
}

interface Group {
  id: string;
  name: string;
  created_by: string;
  group_members: GroupMember[];
}

interface SearchResult {
  id: string;
  display_name: string;
  handle: string;
  avatar_url?: string;
}

interface Props {
  onClose: () => void;
  onGroupChange: () => void;
}

export default function GroupManager({ onClose, onGroupChange }: Props) {
  const { user, profile } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [pendingInvites, setPendingInvites] = useState<(GroupMember & { groups: { name: string } })[]>([]);
  const [tab, setTab] = useState<'groups' | 'create' | 'invite'>('groups');
  const [newGroupName, setNewGroupName] = useState('');
  const [searchHandle, setSearchHandle] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const loadGroups = async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc('get_my_groups');
    if (error) { console.error('[loadGroups] error:', error); return; }
    // RPC가 json 타입을 반환할 때 문자열로 올 수 있음
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    setGroups((parsed as Group[]) ?? []);
  };

  const loadPendingInvites = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('group_members')
      .select('*, groups(name)')
      .eq('user_id', user.id)
      .eq('status', 'pending');
    setPendingInvites((data ?? []) as (GroupMember & { groups: { name: string } })[]);
  };

  useEffect(() => {
    loadGroups();
    loadPendingInvites();
  }, [user]);

  const createGroup = async () => {
    if (!user || !newGroupName.trim()) return;
    setLoading(true);

    const { error } = await supabase.rpc('create_group_with_owner', {
      group_name: newGroupName.trim(),
    });

    if (error) {
      if (
        error.code === '23505' ||
        error.code === 'P0001' ||
        error.message?.includes('같은 이름')
      ) {
        alert('같은 이름의 그룹이 이미 있어요.');
      } else {
        alert('그룹 만들기 실패: ' + error.message);
      }
    } else {
      setNewGroupName('');
      await loadGroups();
      onGroupChange();
      setTab('groups');
    }
    setLoading(false);
  };

  const searchProfiles = async () => {
    if (!searchHandle.trim()) return;
    const { data } = await supabase.rpc('search_profiles_by_handle', { search_handle: searchHandle });
    setSearchResults((data ?? []) as SearchResult[]);
  };

  const inviteMember = async (targetUserId: string) => {
    if (!selectedGroupId) { alert('초대할 그룹을 선택해주세요.'); return; }
    const { error } = await supabase.from('group_members').insert({
      group_id: selectedGroupId,
      user_id: targetUserId,
      status: 'pending',
      invited_by: user?.id,
    });
    if (!error) {
      setSearchResults(r => r.filter(u => u.id !== targetUserId));
      alert('초대를 보냈어요!');
    } else {
      alert('이미 초대된 멤버예요.');
    }
  };

  const acceptInvite = async (inviteId: string) => {
    await supabase.from('group_members').update({ status: 'accepted' }).eq('id', inviteId);
    await loadPendingInvites();
    await loadGroups();
    await onGroupChange();
  };

  const declineInvite = async (inviteId: string) => {
    await supabase.from('group_members').delete().eq('id', inviteId);
    await loadPendingInvites();
  };

  const removeMember = async (_groupId: string, memberId: string) => {
    await supabase.from('group_members').delete().eq('id', memberId);
    await loadGroups();
    onGroupChange();
  };

  const leaveGroup = async (groupId: string) => {
    if (!user) return;
    const group = groups.find(g => g.id === groupId);
    const isOwner = group?.created_by === user.id;
    const msg = isOwner
      ? '운영자가 그룹을 나가면 그룹이 삭제돼요. 계속할까요?'
      : '그룹에서 나가시겠어요?';
    if (!confirm(msg)) return;

    if (isOwner) {
      // 멤버 먼저 삭제 후 그룹 삭제
      const { error: e1 } = await supabase.from('group_members').delete().eq('group_id', groupId);
      if (e1) { alert('멤버 삭제 실패: ' + e1.message); return; }
      const { error: e2 } = await supabase.from('groups').delete().eq('id', groupId);
      if (e2) { alert('그룹 삭제 실패: ' + e2.message); return; }
    } else {
      const { error, count } = await supabase
        .from('group_members')
        .delete({ count: 'exact' })
        .eq('group_id', groupId)
        .eq('user_id', user.id);
      if (error) { alert('나가기 실패: ' + error.message); return; }
      if (count === 0) { alert('삭제된 항목이 없어요. group_id나 user_id를 확인해주세요.'); return; }
    }
    await loadGroups();
    await onGroupChange();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>그룹 관리</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="auth-tabs" style={{ padding: '0 24px' }}>
          <button className={`auth-tab ${tab === 'groups' ? 'active' : ''}`} onClick={() => setTab('groups')}>
            <Users size={14} /> 내 그룹
            {pendingInvites.length > 0 && <span className="invite-badge">{pendingInvites.length}</span>}
          </button>
          <button className={`auth-tab ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>
            <Plus size={14} /> 그룹 만들기
          </button>
          <button className={`auth-tab ${tab === 'invite' ? 'active' : ''}`} onClick={() => setTab('invite')}>
            <UserPlus size={14} /> 멤버 초대
          </button>
        </div>

        <div className="modal-form">
          {/* 내 그룹 */}
          {tab === 'groups' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* 받은 초대 */}
              {pendingInvites.length > 0 && (
                <div className="group-invite-section">
                  <h4 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>받은 초대</h4>
                  {pendingInvites.map(invite => (
                    <div key={invite.id} className="invite-item">
                      <span>"{(invite.groups as unknown as { name: string }).name}" 그룹 초대</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="icon-btn success" onClick={() => acceptInvite(invite.id)}><Check size={15} /></button>
                        <button className="icon-btn danger" onClick={() => declineInvite(invite.id)}><X size={15} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 그룹 목록 */}
              {groups.length === 0 ? (
                <div className="empty-text" style={{ textAlign: 'center', padding: 24 }}>
                  <Users size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p>아직 그룹이 없어요.</p>
                  <p style={{ fontSize: 12 }}>그룹을 만들거나 초대를 기다려보세요.</p>
                </div>
              ) : groups.map(group => (
                <div key={group.id} className="group-card">
                  <div className="group-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="group-name">{group.name}</span>
                      {group.created_by === user?.id && (
                        <span style={{ fontSize: 10, background: 'var(--accent)', color: '#fff', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>그룹장</span>
                      )}
                    </div>
                    <button className="icon-btn" style={{ fontSize: 12 }} onClick={() => leaveGroup(group.id)}
                      title={group.created_by === user?.id ? '그룹 삭제' : '그룹 나가기'}>
                      {group.created_by === user?.id ? <Trash2 size={14} /> : <LogOut size={14} />}
                    </button>
                  </div>
                  <div className="group-members-list">
                    {group.group_members?.filter(m => m.status === 'accepted').map(m => (
                      <div key={m.id} className="group-member-item">
                        <div className="member-avatar">{m.profiles?.display_name?.[0] ?? '?'}</div>
                        <div>
                          <span className="member-name">{m.profiles?.display_name}</span>
                          <span className="member-handle">@{m.profiles?.handle}</span>
                          {m.role === 'owner' && <span className="member-role">운영자</span>}
                        </div>
                        {group.created_by === user?.id && m.user_id !== user?.id && (
                          <button className="icon-btn danger" style={{ marginLeft: 'auto' }} onClick={() => removeMember(group.id, m.id)}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                    {group.group_members?.filter(m => m.status === 'pending').map(m => (
                      <div key={m.id} className="group-member-item pending">
                        <div className="member-avatar" style={{ opacity: 0.4 }}>{m.profiles?.display_name?.[0] ?? '?'}</div>
                        <div>
                          <span className="member-name" style={{ opacity: 0.5 }}>{m.profiles?.display_name}</span>
                          <span className="member-handle">@{m.profiles?.handle} · 초대 대기 중</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 그룹 만들기 */}
          {tab === 'create' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label>그룹 이름</label>
                <input
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="예: 우리 가족, 독서 모임"
                  onKeyDown={e => e.key === 'Enter' && createGroup()}
                />
              </div>
              <button className="btn-primary" onClick={createGroup} disabled={loading || !newGroupName.trim()}>
                {loading ? '만드는 중...' : '그룹 만들기'}
              </button>
            </div>
          )}

          {/* 멤버 초대 */}
          {tab === 'invite' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label>초대할 그룹 선택</label>
                <select value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)}>
                  <option value="">그룹 선택</option>
                  {groups.filter(g => g.created_by === user?.id || g.group_members?.some(m => m.user_id === user?.id && m.role === 'owner')).map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>핸들로 검색</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={searchHandle}
                    onChange={e => setSearchHandle(e.target.value)}
                    placeholder="@handle 검색"
                    onKeyDown={e => e.key === 'Enter' && searchProfiles()}
                    style={{ flex: 1 }}
                  />
                  <button className="btn-secondary" onClick={searchProfiles}>
                    <Search size={15} />
                  </button>
                </div>
              </div>
              {searchResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {searchResults.map(u => (
                    <div key={u.id} className="group-member-item">
                      <div className="member-avatar">{u.display_name[0]}</div>
                      <div>
                        <span className="member-name">{u.display_name}</span>
                        <span className="member-handle">@{u.handle}</span>
                      </div>
                      <button className="btn-primary cover-edit-btn" style={{ marginLeft: 'auto' }} onClick={() => inviteMember(u.id)}>
                        <UserPlus size={14} /> 초대
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {searchHandle && searchResults.length === 0 && (
                <p className="cover-hint">검색 결과가 없어요. 핸들을 정확히 입력해보세요.</p>
              )}
              <div className="group-invite-section" style={{ marginTop: 8 }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  내 핸들: <strong>@{profile?.handle}</strong> — 이 핸들을 공유하면 상대방이 나를 찾을 수 있어요.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
