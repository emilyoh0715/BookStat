-- Track when a review is first/last written so family activity can show review events.
ALTER TABLE books
  ADD COLUMN IF NOT EXISTS review_created_at timestamptz;

UPDATE books
SET review_created_at = COALESCE(
  review_created_at,
  CASE
    WHEN review IS NOT NULL AND TRIM(review) <> '' THEN COALESCE(finish_date::timestamptz, created_at::timestamptz, now())
    ELSE NULL
  END
)
WHERE review_created_at IS NULL;
