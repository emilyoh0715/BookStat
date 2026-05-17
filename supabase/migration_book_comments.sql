-- ============================================================
-- 가족 댓글 (book_comments) 테이블 생성
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- 테이블 생성
CREATE TABLE IF NOT EXISTS book_comments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid        NOT NULL REFERENCES groups(id)     ON DELETE CASCADE,
  book_id         text        NOT NULL,
  book_owner_id   text        NOT NULL,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content         text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS book_comments_book_id_idx  ON book_comments (book_id);
CREATE INDEX IF NOT EXISTS book_comments_group_id_idx ON book_comments (group_id);
CREATE INDEX IF NOT EXISTS book_comments_user_id_idx  ON book_comments (user_id);

-- RLS 활성화
ALTER TABLE book_comments ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 후 재생성 (중복 오류 방지)
DROP POLICY IF EXISTS "group members can view comments"  ON book_comments;
DROP POLICY IF EXISTS "users can insert own comments"    ON book_comments;
DROP POLICY IF EXISTS "users can delete own comments"    ON book_comments;

-- 같은 그룹 멤버는 읽기 가능
CREATE POLICY "group members can view comments" ON book_comments
  FOR SELECT USING (
    group_id IN (
      SELECT group_id FROM group_members
      WHERE user_id = auth.uid()
    )
  );

-- 인증된 사용자가 자신의 이름으로 작성 (그룹 멤버 여부는 group_id FK가 보장)
CREATE POLICY "users can insert own comments" ON book_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND group_id IN (
      SELECT group_id FROM group_members
      WHERE user_id = auth.uid()
    )
  );

-- 본인 댓글만 삭제 가능
CREATE POLICY "users can delete own comments" ON book_comments
  FOR DELETE USING (auth.uid() = user_id);
