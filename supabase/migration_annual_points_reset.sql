-- ============================================================
-- 포인트 연도별 리셋: get_group_member_points 함수 업데이트
-- 현재 캘린더 연도의 point_logs 만 집계하도록 변경
-- ============================================================

CREATE OR REPLACE FUNCTION get_group_member_points()
RETURNS TABLE (
  user_id              uuid,
  display_name         text,
  handle               text,
  avatar_url           text,
  total_points         bigint,
  book_added_points    bigint,
  review_approved_points bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    p.id                                                                         AS user_id,
    p.display_name,
    p.handle,
    p.avatar_url,
    COALESCE(SUM(pl.points), 0)::bigint                                          AS total_points,
    COALESCE(SUM(CASE WHEN pl.reason = 'book_added'      THEN pl.points ELSE 0 END), 0)::bigint AS book_added_points,
    COALESCE(SUM(CASE WHEN pl.reason = 'review_approved' THEN pl.points ELSE 0 END), 0)::bigint AS review_approved_points
  FROM profiles p
  LEFT JOIN point_logs pl
         ON pl.user_id = p.id
        AND EXTRACT(YEAR FROM pl.created_at AT TIME ZONE 'UTC')
            = EXTRACT(YEAR FROM NOW()        AT TIME ZONE 'UTC')
  WHERE p.id IN (
    SELECT DISTINCT gm.user_id
    FROM   group_members gm
    WHERE  gm.group_id IN (
             SELECT group_id FROM group_members
             WHERE  user_id = auth.uid()
               AND  status  = 'accepted'
           )
      AND  gm.status = 'accepted'
  )
  GROUP BY p.id, p.display_name, p.handle, p.avatar_url
$$;
