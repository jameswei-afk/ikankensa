-- 銘環廠商討論網站 - Supabase schema
-- 在 Supabase 專案的 SQL Editor 貼上並執行一次即可。

-- ---------------------------------------------------------------------
-- 1. items：品項主檔（一列 = 一個 PS 管理番号）
-- ---------------------------------------------------------------------
create table if not exists public.items (
  id           text primary key,        -- 管理番号，例如 PS-00064
  customer     text,                     -- 顧客（Excel F欄，僅供顯示參考）
  maker        text,                     -- メーカー（目前固定為「銘環」）
  part_no      text,                     -- 品番（Excel H欄）
  part_name    text,                     -- 品名（Excel I欄）
  meikan_note  text,                     -- 銘環確認 備註（Excel Q欄，討論主題）
  folder_path  text,                     -- 對應資料夾相對路徑（除錯用）
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. item_files：每個品項底下可下載的檔案
-- ---------------------------------------------------------------------
create table if not exists public.item_files (
  id            bigint generated always as identity primary key,
  item_id       text not null references public.items(id) on delete cascade,
  filename      text not null,
  storage_path  text not null,           -- item-files bucket 內的路徑
  size_bytes    bigint,
  updated_at    timestamptz not null default now(),
  unique (item_id, filename)
);

-- ---------------------------------------------------------------------
-- 3. comments：留言（本社／台灣／廠商都可留言，免登入）
-- ---------------------------------------------------------------------
create table if not exists public.comments (
  id          bigint generated always as identity primary key,
  item_id     text not null references public.items(id) on delete cascade,
  author      text not null check (char_length(author) between 1 and 50),
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now(),
  edit_token  uuid not null default gen_random_uuid()  -- 留言者本機保存，用來刪除自己的留言（不對外公開這個欄位）
);

create index if not exists comments_item_id_idx on public.comments (item_id, created_at);
create index if not exists item_files_item_id_idx on public.item_files (item_id);

-- ---------------------------------------------------------------------
-- 4. Row Level Security：公開可讀，留言公開可新增，其餘只能靠 service_role（publish.py）寫入
-- ---------------------------------------------------------------------
alter table public.items      enable row level security;
alter table public.item_files enable row level security;
alter table public.comments   enable row level security;

drop policy if exists "public read items" on public.items;
create policy "public read items" on public.items
  for select to anon, authenticated using (true);

drop policy if exists "public read item_files" on public.item_files;
create policy "public read item_files" on public.item_files
  for select to anon, authenticated using (true);

drop policy if exists "public read comments" on public.comments;
create policy "public read comments" on public.comments
  for select to anon, authenticated using (true);

drop policy if exists "public insert comments" on public.comments;
create policy "public insert comments" on public.comments
  for insert to anon, authenticated with check (
    char_length(author) between 1 and 50 and char_length(body) between 1 and 2000
  );

-- 注意：items / item_files 沒有 anon insert/update/delete policy，
-- 也沒有給 comments update/delete policy，所以公開使用者只能新增留言、
-- 其餘資料只能透過 service_role key（publish.py）寫入或在 Supabase 後台手動處理。

-- ---------------------------------------------------------------------
-- 4b. 刪除自己的留言：用 edit_token 驗證，不需要登入。
--     comments 表本身沒有開放 anon delete，只能透過這個函式、且 token 要對才能刪。
-- ---------------------------------------------------------------------
create or replace function public.delete_own_comment(p_comment_id bigint, p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count int;
begin
  delete from public.comments
  where id = p_comment_id and edit_token = p_token;
  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

grant execute on function public.delete_own_comment(bigint, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Realtime：讓留言能即時推播到前端
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.comments;

-- ---------------------------------------------------------------------
-- 6. Storage bucket：item-files（公開唯讀，只有 service_role 能上傳）
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('item-files', 'item-files', true)
on conflict (id) do nothing;

drop policy if exists "public read item-files" on storage.objects;
create policy "public read item-files" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'item-files');

-- 沒有給 anon/authenticated 在 storage.objects 上的 insert/update/delete policy，
-- 所以檔案上傳只能透過 publish.py 使用的 service_role key（該 key 會略過 RLS）。
