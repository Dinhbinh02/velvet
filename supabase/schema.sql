-- ==========================================================
-- VELVET EBOOK READER - SUPABASE POSTGRESQL SCHEMA (DDL)
-- Copy and run this entire SQL script in the Supabase SQL Editor
-- ==========================================================

-- 1. PROFILES & SETTINGS
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  name text,
  avatar_url text,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. BOOKS
create table if not exists public.books (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  author text,
  file_size bigint default 0,
  format text default 'epub',
  total_chapters int default 0,
  r2_key text, -- Cloudflare R2 object key: users/{userId}/books/{bookId}.epub
  cover_url text,
  added_at bigint not null,
  last_read_at bigint,
  is_finished boolean default false
);

create index if not exists idx_books_user_id on public.books(user_id);

-- 3. PROGRESS (One row per user per book)
create table if not exists public.progress (
  user_id uuid references auth.users on delete cascade not null,
  book_id text not null,
  cfi text not null,
  percentage double precision not null default 0,
  section_index int not null default 0,
  chapter_title text,
  section_cfi_map jsonb default '{}'::jsonb,
  updated_at bigint not null,
  primary key (user_id, book_id)
);

create index if not exists idx_progress_user_book on public.progress(user_id, book_id);

-- 4. HIGHLIGHTS
create table if not exists public.highlights (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  book_id text not null,
  text text not null,
  color text default '#fef08a',
  created_at bigint not null
);

create index if not exists idx_highlights_user_book on public.highlights(user_id, book_id);

-- 5. NOTES
create table if not exists public.notes (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  book_id text not null,
  selected_text text not null,
  note text not null,
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists idx_notes_user_book on public.notes(user_id, book_id);

-- 6. COMMENTS
create table if not exists public.comments (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  book_id text not null,
  selected_text text not null,
  comment text not null,
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists idx_comments_user_book on public.comments(user_id, book_id);

-- 7. CHAPTER SUMMARIES (Key Insights)
create table if not exists public.chapter_summaries (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  book_id text not null,
  href text not null,
  chapter_title text,
  summaries jsonb not null,
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists idx_summaries_user_book on public.chapter_summaries(user_id, book_id);

-- 8. CUSTOM FONTS
create table if not exists public.custom_fonts (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  file_name text not null,
  format text not null,
  r2_key text, -- Cloudflare R2 object key: users/{userId}/fonts/{fontId}.{format}
  created_at bigint not null
);

create index if not exists idx_fonts_user_id on public.custom_fonts(user_id);

-- ==========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures each user can only read, insert, update & delete their own data
-- ==========================================================

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.progress enable row level security;
alter table public.highlights enable row level security;
alter table public.notes enable row level security;
alter table public.comments enable row level security;
alter table public.chapter_summaries enable row level security;
alter table public.custom_fonts enable row level security;

-- Profiles Policies
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can delete own profile" on public.profiles for delete using (auth.uid() = id);

-- Books Policies
create policy "Users can view own books" on public.books for select using (auth.uid() = user_id);
create policy "Users can insert own books" on public.books for insert with check (auth.uid() = user_id);
create policy "Users can update own books" on public.books for update using (auth.uid() = user_id);
create policy "Users can delete own books" on public.books for delete using (auth.uid() = user_id);

-- Progress Policies
create policy "Users can view own progress" on public.progress for select using (auth.uid() = user_id);
create policy "Users can insert own progress" on public.progress for insert with check (auth.uid() = user_id);
create policy "Users can update own progress" on public.progress for update using (auth.uid() = user_id);
create policy "Users can delete own progress" on public.progress for delete using (auth.uid() = user_id);

-- Highlights Policies
create policy "Users can view own highlights" on public.highlights for select using (auth.uid() = user_id);
create policy "Users can insert own highlights" on public.highlights for insert with check (auth.uid() = user_id);
create policy "Users can update own highlights" on public.highlights for update using (auth.uid() = user_id);
create policy "Users can delete own highlights" on public.highlights for delete using (auth.uid() = user_id);

-- Notes Policies
create policy "Users can view own notes" on public.notes for select using (auth.uid() = user_id);
create policy "Users can insert own notes" on public.notes for insert with check (auth.uid() = user_id);
create policy "Users can update own notes" on public.notes for update using (auth.uid() = user_id);
create policy "Users can delete own notes" on public.notes for delete using (auth.uid() = user_id);

-- Comments Policies
create policy "Users can view own comments" on public.comments for select using (auth.uid() = user_id);
create policy "Users can insert own comments" on public.comments for insert with check (auth.uid() = user_id);
create policy "Users can update own comments" on public.comments for update using (auth.uid() = user_id);
create policy "Users can delete own comments" on public.comments for delete using (auth.uid() = user_id);

-- Chapter Summaries Policies
create policy "Users can view own chapter_summaries" on public.chapter_summaries for select using (auth.uid() = user_id);
create policy "Users can insert own chapter_summaries" on public.chapter_summaries for insert with check (auth.uid() = user_id);
create policy "Users can update own chapter_summaries" on public.chapter_summaries for update using (auth.uid() = user_id);
create policy "Users can delete own chapter_summaries" on public.chapter_summaries for delete using (auth.uid() = user_id);

-- Custom Fonts Policies
create policy "Users can view own custom_fonts" on public.custom_fonts for select using (auth.uid() = user_id);
create policy "Users can insert own custom_fonts" on public.custom_fonts for insert with check (auth.uid() = user_id);
create policy "Users can update own custom_fonts" on public.custom_fonts for update using (auth.uid() = user_id);
create policy "Users can delete own custom_fonts" on public.custom_fonts for delete using (auth.uid() = user_id);

-- ==========================================================
-- REALTIME SUBSCRIPTIONS
-- Enable realtime publication for instant multi-device sync
-- ==========================================================
alter publication supabase_realtime add table public.progress;
alter publication supabase_realtime add table public.highlights;
alter publication supabase_realtime add table public.notes;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.chapter_summaries;
