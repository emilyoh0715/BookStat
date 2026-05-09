-- ============================================================
-- 포인트 버그 수정 + 전체 재계산 마이그레이션
--
-- 변경 내용:
--   1. point_logs 중복 행 제거
--   2. (user_id, book_id, reason) UNIQUE 제약 추가
--   3. 새 포인트 규칙으로 전체 재계산 (기존 대비 약 절반)
--
-- 새 적립 규칙:
--   book_added      : +1pt   (책 추가일 기준)
--   book_finished   : 3/5/8/10pt × 언어배율  (완독일 기준)
--   review_approved : 8/13/20/30pt × 언어배율 (완독일 기준)
--   외국어 배율     : ×1.5 (소수점 올림)
--
-- 주의: 기존 point_logs 를 전부 삭제 후 재삽입합니다.
--       point_redemptions 는 건드리지 않습니다.
-- ============================================================

-- ─────────────────────────────────────────────
-- ① reason CHECK 제약 정리 (book_finished 포함)
-- ─────────────────────────────────────────────
ALTER TABLE point_logs DROP CONSTRAINT IF EXISTS point_logs_reason_check;
ALTER TABLE point_logs ADD CONSTRAINT point_logs_reason_check
  CHECK (reason IN ('book_added', 'book_finished', 'review_approved'));

-- ─────────────────────────────────────────────
-- ② 기존 point_logs 전부 삭제 후 재삽입
--    (중복 제거 + 새 포인트값 적용이 목적이므로 clean slate)
-- ─────────────────────────────────────────────
DELETE FROM point_logs;

-- ─────────────────────────────────────────────
-- ③ UNIQUE 제약 추가 — 이제부터 중복 INSERT 자체가 DB 레벨에서 차단됨
-- ─────────────────────────────────────────────
ALTER TABLE point_logs DROP CONSTRAINT IF EXISTS point_logs_unique_user_book_reason;
ALTER TABLE point_logs ADD CONSTRAINT point_logs_unique_user_book_reason
  UNIQUE (user_id, book_id, reason);

-- ─────────────────────────────────────────────
-- ④ book_added : 추가일 기준, want-to-read 제외
-- ─────────────────────────────────────────────
INSERT INTO point_logs (user_id, book_id, reason, points, created_at)
SELECT
  user_id::uuid,
  id            AS book_id,
  'book_added'  AS reason,
  1             AS points,
  created_at::timestamptz
FROM books
WHERE status != 'want-to-read';

-- ─────────────────────────────────────────────
-- ⑤ book_finished : 완독일 기준, status = 'finished'
--    한국어: 3/5/8/10pt   외국어: ×1.5 올림
-- ─────────────────────────────────────────────
INSERT INTO point_logs (user_id, book_id, reason, points, created_at)
SELECT
  user_id::uuid,
  id AS book_id,
  'book_finished' AS reason,
  CASE
    WHEN (total_pages IS NULL OR total_pages <= 100) THEN
      CASE WHEN language IS NULL OR language = 'korean' THEN 3  ELSE 5  END
    WHEN total_pages <= 300 THEN
      CASE WHEN language IS NULL OR language = 'korean' THEN 5  ELSE 8  END
    WHEN total_pages <= 500 THEN
      CASE WHEN language IS NULL OR language = 'korean' THEN 8  ELSE 12 END
    ELSE
      CASE WHEN language IS NULL OR language = 'korean' THEN 10 ELSE 15 END
  END AS points,
  COALESCE(
    (finish_date || 'T12:00:00.000Z')::timestamptz,
    created_at::timestamptz
  ) AS created_at
FROM books
WHERE status = 'finished';

-- ─────────────────────────────────────────────
-- ⑥ review_approved : 완독일 기준, 완독 + 후기 + 별점 모두 있는 책
--    한국어: 8/13/20/30pt   외국어: ×1.5 올림
-- ─────────────────────────────────────────────
INSERT INTO point_logs (user_id, book_id, reason, points, created_at)
SELECT
  user_id::uuid,
  id AS book_id,
  'review_approved' AS reason,
  CASE
    WHEN (total_pages IS NULL OR total_pages <= 100) THEN
      CASE WHEN language IS NULL OR language = 'korean' THEN 8  ELSE 12 END
    WHEN total_pages <= 300 THEN
      CASE WHEN language IS NULL OR language = 'korean' THEN 13 ELSE 20 END
    WHEN total_pages <= 500 THEN
      CASE WHEN language IS NULL OR language = 'korean' THEN 20 ELSE 30 END
    ELSE
      CASE WHEN language IS NULL OR language = 'korean' THEN 30 ELSE 45 END
  END AS points,
  COALESCE(
    (finish_date || 'T12:00:00.000Z')::timestamptz,
    created_at::timestamptz
  ) AS created_at
FROM books
WHERE status = 'finished'
  AND review IS NOT NULL AND TRIM(review) != ''
  AND rating IS NOT NULL AND rating > 0;

-- ─────────────────────────────────────────────
-- ⑦ 확인 쿼리 — 실행 후 결과 검토용
-- ─────────────────────────────────────────────
SELECT
  p.display_name,
  pl.reason,
  COUNT(*)                              AS 건수,
  SUM(pl.points)                        AS 합계점수,
  EXTRACT(YEAR FROM pl.created_at)::int AS 연도
FROM point_logs pl
JOIN profiles p ON p.id = pl.user_id
GROUP BY p.display_name, pl.reason, EXTRACT(YEAR FROM pl.created_at)
ORDER BY p.display_name, 연도 DESC, pl.reason;
