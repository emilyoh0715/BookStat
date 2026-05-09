-- ============================================================
-- 포인트 전체 재계산 마이그레이션
--
-- 새 적립 규칙:
--   book_added      : +2pt  (책 추가일 기준)
--   book_finished   : 5/10/15/20pt × 언어배율  (완독일 기준)
--   review_approved : 15/25/40/60pt × 언어배율 (완독일 기준)
--   외국어 배율     : ×1.5 (소수점 올림)
--
-- 주의: 기존 point_logs 를 전부 삭제 후 재삽입합니다.
--       point_redemptions 는 건드리지 않습니다.
-- ============================================================

-- ① reason CHECK 제약에 book_finished 추가
ALTER TABLE point_logs DROP CONSTRAINT IF EXISTS point_logs_reason_check;
ALTER TABLE point_logs ADD CONSTRAINT point_logs_reason_check
  CHECK (reason IN ('book_added', 'book_finished', 'review_approved'));

-- ② 기존 포인트 로그 전부 삭제
DELETE FROM point_logs;

-- ② book_added : 추가일 기준, status != 'want-to-read' 인 모든 책
INSERT INTO point_logs (user_id, book_id, reason, points, created_at)
SELECT
  user_id::uuid,
  id            AS book_id,
  'book_added'  AS reason,
  2             AS points,
  created_at::timestamptz
FROM books
WHERE status != 'want-to-read';

-- ③ book_finished : 완독일 기준, status = 'finished' 인 모든 책
INSERT INTO point_logs (user_id, book_id, reason, points, created_at)
SELECT
  user_id::uuid,
  id AS book_id,
  'book_finished' AS reason,
  CASE
    WHEN (total_pages IS NULL OR total_pages <= 100) THEN
      CASE WHEN language IS NULL OR language = 'korean' THEN 5  ELSE 8  END
    WHEN total_pages <= 300 THEN
      CASE WHEN language IS NULL OR language = 'korean' THEN 10 ELSE 15 END
    WHEN total_pages <= 500 THEN
      CASE WHEN language IS NULL OR language = 'korean' THEN 15 ELSE 23 END
    ELSE
      CASE WHEN language IS NULL OR language = 'korean' THEN 20 ELSE 30 END
  END AS points,
  -- 완독일을 created_at 으로 사용 (없으면 책 생성일 fallback)
  COALESCE(
    (finish_date || 'T12:00:00.000Z')::timestamptz,
    created_at::timestamptz
  ) AS created_at
FROM books
WHERE status = 'finished';

-- ④ review_approved : 완독일 기준, 완독 + 후기 + 별점 모두 있는 책
INSERT INTO point_logs (user_id, book_id, reason, points, created_at)
SELECT
  user_id::uuid,
  id AS book_id,
  'review_approved' AS reason,
  CASE
    WHEN (total_pages IS NULL OR total_pages <= 100) THEN
      CASE WHEN language IS NULL OR language = 'korean' THEN 15 ELSE 23 END
    WHEN total_pages <= 300 THEN
      CASE WHEN language IS NULL OR language = 'korean' THEN 25 ELSE 38 END
    WHEN total_pages <= 500 THEN
      CASE WHEN language IS NULL OR language = 'korean' THEN 40 ELSE 60 END
    ELSE
      CASE WHEN language IS NULL OR language = 'korean' THEN 60 ELSE 90 END
  END AS points,
  COALESCE(
    (finish_date || 'T12:00:00.000Z')::timestamptz,
    created_at::timestamptz
  ) AS created_at
FROM books
WHERE status = 'finished'
  AND review  IS NOT NULL AND TRIM(review) != ''
  AND rating  IS NOT NULL AND rating > 0;

-- ============================================================
-- 확인 쿼리 (실행 후 결과 검토용)
-- ============================================================
SELECT
  p.display_name,
  pl.reason,
  SUM(pl.points)                                AS total_pts,
  COUNT(*)                                      AS log_count,
  EXTRACT(YEAR FROM pl.created_at)::int         AS year
FROM point_logs pl
JOIN profiles p ON p.id = pl.user_id
GROUP BY p.display_name, pl.reason, EXTRACT(YEAR FROM pl.created_at)
ORDER BY p.display_name, year DESC, pl.reason;
