-- ============================================================
-- goal-images 스토리지 버킷 정책
--
-- 실행 전 필수 작업:
--   Supabase Dashboard → Storage → New Bucket
--   이름: goal-images
--   Public bucket: ON (체크)
--
-- 그 다음 이 SQL을 SQL Editor에서 실행하세요.
-- ============================================================

-- 인증된 사용자가 자신의 폴더에 업로드 가능
INSERT INTO storage.buckets (id, name, public)
VALUES ('goal-images', 'goal-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 공개 읽기 (누구나 이미지 URL로 접근 가능)
CREATE POLICY "Public read goal-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'goal-images');

-- 인증된 사용자만 자신의 폴더에 업로드
CREATE POLICY "Auth upload goal-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'goal-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 자신이 올린 파일만 삭제 가능
CREATE POLICY "Auth delete own goal-images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'goal-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
