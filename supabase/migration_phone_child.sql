-- =============================================
-- 북스탯: 휴대폰 인증 + 자녀 계정 마이그레이션
-- Supabase Dashboard > SQL Editor 에서 실행
-- =============================================

-- 1. profiles 테이블에 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS full_name    text,
  ADD COLUMN IF NOT EXISTS birth_date   date,
  ADD COLUMN IF NOT EXISTS phone        text,
  ADD COLUMN IF NOT EXISTS is_child     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS avatar_emoji text DEFAULT '🧒';

-- 2. 자녀 계정 로그인 정보 보관 테이블 (클라이언트에서 사용)
--    child_email 은 암호화된 이메일 (부모 앱에만 저장)
CREATE TABLE IF NOT EXISTS child_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  child_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          text NOT NULL,
  avatar_emoji  text DEFAULT '🧒',
  birth_date    date,
  child_email   text NOT NULL,  -- child.{uuid}@bookstat.internal
  created_at    timestamptz DEFAULT now()
);

-- 3. RLS
ALTER TABLE child_accounts ENABLE ROW LEVEL SECURITY;

-- 부모만 자녀 목록 조회/삭제 가능
DO $$ BEGIN
  CREATE POLICY "부모가 자녀 목록 조회"
    ON child_accounts FOR SELECT
    USING (parent_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "부모가 자녀 계정 삭제"
    ON child_accounts FOR DELETE
    USING (parent_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Edge Function (service role) 이 insert 할 수 있도록
-- service role 은 RLS 를 우회하므로 별도 정책 불필요

-- 4. 기존 profiles RLS 확인 (이미 있으면 무시)
-- CREATE POLICY "본인 프로필 수정" ON profiles FOR UPDATE USING (id = auth.uid());
