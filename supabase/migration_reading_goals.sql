-- ============================================================
-- 독서 목표 (reading_goals) 테이블
-- ============================================================
-- 주의: Supabase 대시보드 Storage 탭에서
--       "goal-images" 버킷을 Public으로 먼저 생성해주세요.
-- ============================================================

CREATE TABLE IF NOT EXISTS reading_goals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid        NOT NULL REFERENCES groups(id)     ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name       text        NOT NULL,
  item_image_url  text,
  item_emoji      text,                      -- 추천 보상 이모지 (직접 설정 시 null)
  points_required int         NOT NULL CHECK (points_required > 0),
  status          text        NOT NULL DEFAULT 'pending_approval'
                              CHECK (status IN ('pending_approval','active','completed','rejected')),
  approved_by     uuid        REFERENCES auth.users(id),
  approved_at     timestamptz,
  reject_note     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reading_goals_user_id_idx  ON reading_goals (user_id);
CREATE INDEX IF NOT EXISTS reading_goals_group_id_idx ON reading_goals (group_id);

ALTER TABLE reading_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group members can view goals" ON reading_goals
  FOR SELECT USING (
    group_id IN (
      SELECT group_id FROM group_members
      WHERE user_id = auth.uid() AND status = 'accepted'
    )
  );

CREATE POLICY "users can create own goals" ON reading_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "group members can update goals" ON reading_goals
  FOR UPDATE USING (
    group_id IN (
      SELECT group_id FROM group_members
      WHERE user_id = auth.uid() AND status = 'accepted'
    )
  );
