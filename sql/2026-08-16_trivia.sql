-- Daily trivia quiz + leaderboard. One question rotates in per UTC day
-- (picked deterministically server-side, no cron needed); each signed-in
-- user can answer once per day, and correct answers count toward a
-- leaderboard and a daily-play streak.

create table if not exists trivia_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null unique, -- unique so re-running the seed below is a no-op
  options jsonb not null,       -- array of 2-4 option strings
  correct_index int not null,
  category text not null default 'General',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists trivia_answers (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references profiles(id) on delete cascade,
  question_id uuid not null references trivia_questions(id) on delete cascade,
  quiz_date date not null,
  selected_index int not null,
  correct boolean not null,
  created_at timestamptz not null default now(),
  unique (user_id, quiz_date)
);

create index if not exists trivia_answers_user_idx on trivia_answers (user_id);
create index if not exists trivia_answers_date_idx on trivia_answers (quiz_date);
create index if not exists trivia_answers_correct_idx on trivia_answers (correct);

-- Seed: general Pakistan / Islamic general-knowledge questions — safe,
-- well-established facts. Deliberately does NOT include Kallar Syedan-
-- specific trivia beyond the one district fact below, since that content
-- should come from someone who actually knows the town (add more via the
-- admin panel's new Trivia tab).
insert into trivia_questions (question, options, correct_index, category) values
  ('Kallar Syedan is located in which district of Punjab?', '["Rawalpindi", "Jhelum", "Attock", "Chakwal"]', 0, 'Local'),
  ('What is the capital of Pakistan?', '["Islamabad", "Karachi", "Lahore", "Rawalpindi"]', 0, 'Pakistan'),
  ('What is the national language of Pakistan?', '["Punjabi", "Urdu", "Pashto", "Sindhi"]', 1, 'Pakistan'),
  ('What is the national sport of Pakistan?', '["Cricket", "Field Hockey", "Squash", "Kabaddi"]', 1, 'Pakistan'),
  ('In which year did Pakistan gain independence?', '["1945", "1946", "1947", "1948"]', 2, 'Pakistan'),
  ('What is the tallest mountain located in Pakistan?', '["K2", "Nanga Parbat", "Mount Everest", "Rakaposhi"]', 0, 'Pakistan'),
  ('Which mountain pass connects Pakistan and China?', '["Khyber Pass", "Khunjerab Pass", "Bolan Pass", "Lowari Pass"]', 1, 'Pakistan'),
  ('What is Pakistan''s currency called?', '["Rupee", "Dinar", "Riyal", "Taka"]', 0, 'Pakistan'),
  ('Which Pakistani city is known as the "City of Gardens"?', '["Karachi", "Lahore", "Multan", "Peshawar"]', 1, 'Pakistan'),
  ('How many daily prayers (Salah) are obligatory in Islam?', '["3", "4", "5", "6"]', 2, 'Islamic'),
  ('How many pillars are there in Islam?', '["4", "5", "6", "7"]', 1, 'Islamic'),
  ('In which Islamic (Hijri) month is Ramadan?', '["8th", "9th", "10th", "12th"]', 1, 'Islamic'),
  ('How many Surahs are there in the Quran?', '["100", "114", "120", "99"]', 1, 'Islamic'),
  ('What is the first Surah of the Quran called?', '["Al-Baqarah", "Al-Fatiha", "An-Nas", "Al-Ikhlas"]', 1, 'Islamic'),
  ('Which direction do Muslims face during Salah?', '["Jerusalem", "Mecca", "Medina", "Karbala"]', 1, 'Islamic'),
  ('What is the Islamic pilgrimage to Mecca called?', '["Umrah", "Hajj", "Ziyarat", "Sadaqah"]', 1, 'Islamic')
on conflict (question) do nothing;
