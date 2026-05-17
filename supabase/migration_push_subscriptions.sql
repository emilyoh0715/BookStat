-- ============================================================
-- push_subscriptions 테이블 — 웹 푸시 알림 구독 정보
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id     uuid        NOT NULL REFERENCES groups(id)     ON DELETE CASCADE,
  endpoint     text        NOT NULL,
  subscription jsonb       NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_group_id_idx ON push_subscriptions (group_id);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx  ON push_subscriptions (user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can manage own push subscriptions" ON push_subscriptions;
CREATE POLICY "users can manage own push subscriptions" ON push_subscriptions
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
