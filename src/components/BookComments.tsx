import { useState, useEffect } from 'react';
import { Trash2, Send, Loader } from 'lucide-react';
import type { Profile } from '../contexts/AuthContext';
import { getBookComments, addBookComment, deleteBookComment, type BookComment } from '../services/comments';
import { supabase } from '../lib/supabase';

interface Props {
  bookId: string;
  bookOwnerId: string;
  currentUserId: string;
  members: Profile[];
}

export default function BookComments({ bookId, bookOwnerId, currentUserId, members }: Props) {
  const [comments, setComments]   = useState<BookComment[]>([]);
  const [text, setText]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = async () => {
    const data = await getBookComments(bookId);
    setComments(data);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`book-comments-${bookId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'book_comments',
        filter: `book_id=eq.${bookId}`,
      }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bookId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const err = await addBookComment(bookId, bookOwnerId, text.trim());
      if (err) {
        setSubmitError(err);
      } else {
        setText('');
        await load();
      }
    } catch {
      setSubmitError('댓글을 작성하는 중 오류가 발생했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteBookComment(id);
      await load();
    } catch {
      // 삭제 실패 시 목록 재로드
      await load();
    } finally {
      setDeleting(null);
    }
  };

  const getDisplayName = (userId: string, fallback?: { display_name: string; avatar_url: string | null } | null) => {
    const member = members.find(m => m.id === userId);
    return member?.display_name ?? fallback?.display_name ?? '—';
  };

  const getAvatarUrl = (userId: string, fallback?: { display_name: string; avatar_url: string | null } | null) => {
    const member = members.find(m => m.id === userId);
    return member?.avatar_url ?? fallback?.avatar_url ?? null;
  };

  return (
    <div className="book-comments">
      <h3 className="book-comments-title">💬 가족 한마디</h3>

      <div className="book-comments-list">
        {comments.length === 0 ? (
          <p className="book-comments-empty">첫 번째 한마디를 남겨보세요!</p>
        ) : comments.map(c => {
          const name      = getDisplayName(c.user_id, c.profiles);
          const avatarUrl = getAvatarUrl(c.user_id, c.profiles);
          const isOwn     = c.user_id === currentUserId;
          const dateStr   = new Date(c.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });

          return (
            <div key={c.id} className={`book-comment-row ${isOwn ? 'own' : ''}`}>
              <div className="book-comment-avatar">
                {avatarUrl
                  ? <img src={avatarUrl} alt="" />
                  : <span>{name[0].toUpperCase()}</span>
                }
              </div>
              <div className="book-comment-body">
                <div className="book-comment-header">
                  <span className="book-comment-name">{name}</span>
                  <span className="book-comment-date">{dateStr}</span>
                </div>
                <p className="book-comment-text">{c.content}</p>
              </div>
              {isOwn && (
                <button
                  className="book-comment-delete"
                  onClick={() => handleDelete(c.id)}
                  disabled={deleting === c.id}
                  aria-label="삭제"
                >
                  {deleting === c.id ? <Loader size={12} className="spin" /> : <Trash2 size={12} />}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {submitError && (
        <p className="book-comment-error">⚠️ {submitError}</p>
      )}
      <form onSubmit={handleSubmit} className="book-comment-form">
        <input
          value={text}
          onChange={e => { setText(e.target.value); setSubmitError(null); }}
          placeholder="가족 한마디 남기기..."
          maxLength={500}
          className="book-comment-input"
          disabled={submitting}
        />
        <button
          type="submit"
          className="book-comment-send"
          disabled={submitting || !text.trim()}
        >
          {submitting ? <Loader size={14} className="spin" /> : <Send size={14} />}
        </button>
      </form>
    </div>
  );
}
