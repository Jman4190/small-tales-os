SET ROLE service_role;
WITH creation AS (
  SELECT public.create_book_from_upload(repeat('f', 64), jsonb_build_object(
    'name', 'Concurrent Synthetic Child', 'gender', 'girl', 'age', 6,
    'original_image_url', 'uploads/concurrent.jpg', 'status', 'pending_verification',
    'appearance', jsonb_build_object('skinTone', 'synthetic', 'hair', 'brown', 'eyeColor', 'blue')
  )) AS result
)
SELECT result->'book'->>'id', result->>'created' FROM creation;
