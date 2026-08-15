-- Run this in the Supabase SQL editor. Adds multi-image support (up to 3
-- photos per listing, enforced at the application layer) to
-- marketplace_listings. The old single image_url column is left in place
-- (existing data is copied forward, not deleted) but the app stops reading
-- or writing it after this ships — harmless to leave, safe to drop later
-- once you're confident nothing needs it.

alter table marketplace_listings
  add column if not exists image_urls text[] not null default '{}';

-- Carry forward any existing single-image listings into the new column.
update marketplace_listings
  set image_urls = array[image_url]
  where image_url is not null and image_urls = '{}';
