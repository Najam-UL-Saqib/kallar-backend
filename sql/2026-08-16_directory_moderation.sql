-- Directory moderation: user-submitted entries need admin approval before
-- they show up publicly, so people can't quietly list a phone number that
-- isn't theirs to share (a friend's, a relative's, etc.).

alter table directory add column if not exists status text not null default 'approved';
alter table directory add column if not exists submitted_by text references profiles(id) on delete set null;

alter table directory drop constraint if exists directory_status_check;
alter table directory add constraint directory_status_check check (status in ('pending', 'approved', 'rejected'));

create index if not exists directory_status_idx on directory (status);
