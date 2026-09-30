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
  id               bigint generated always as identity primary key,
  item_id          text not null references public.items(id) on delete cascade,
  author           text not null check (char_length(author) between 1 and 50),
  body             text not null check (char_length(body) between 1 and 2000),
  created_at       timestamptz not null default now(),
  edit_token       uuid not null default gen_random_uuid(),  -- 留言者本機保存，用來刪除自己的留言（不對外公開這個欄位）
  attachment_path  text,  -- comment-uploads bucket 內的路徑（圖片／檔案，選填）
  attachment_name  text   -- 附加檔案的原始檔名
);

create index if not exists comments_item_id_idx on public.comments (item_id, created_at);
create index if not exists item_files_item_id_idx on public.item_files (item_id);

-- ---------------------------------------------------------------------
-- 4. Row Level Security：僅限登入（authenticated）帳號可讀，登入帳號可新增留言，
--    其餘資料只能靠 service_role（publish.py）寫入。
--    登入帳號是共用的 3 組帳密（本社／台湾／銘環），見 README 說明。
-- ---------------------------------------------------------------------
alter table public.items      enable row level security;
alter table public.item_files enable row level security;
alter table public.comments   enable row level security;

drop policy if exists "public read items" on public.items;
create policy "public read items" on public.items
  for select to authenticated using (true);

drop policy if exists "public read item_files" on public.item_files;
create policy "public read item_files" on public.item_files
  for select to authenticated using (true);

drop policy if exists "public read comments" on public.comments;
create policy "public read comments" on public.comments
  for select to authenticated using (true);

drop policy if exists "public insert comments" on public.comments;
create policy "public insert comments" on public.comments
  for insert to authenticated with check (
    char_length(author) between 1 and 50 and char_length(body) between 1 and 2000
  );

-- 注意：items / item_files 沒有 insert/update/delete policy，
-- 也沒有給 comments update/delete policy，所以登入帳號只能新增留言、
-- 其餘資料只能透過 service_role key（publish.py）寫入或在 Supabase 後台手動處理。
-- anon（未登入）角色完全沒有任何 policy，等同完全擋掉未登入的讀取／寫入請求。

-- ---------------------------------------------------------------------
-- 4b. 刪除自己的留言：用 edit_token 驗證，不需要額外的權限判斷。
--     comments 表本身沒有開放 delete policy，只能透過這個函式、且 token 要對才能刪。
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

grant execute on function public.delete_own_comment(bigint, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4c. items_with_comment_stats：品項 + 留言數／最新留言時間，給列表頁用來
--     排序、顯示「哪個品項最近有新活動」，不用另外做通知機制。
--     security_invoker 讓這個 view 沿用查詢者本人的 RLS 權限（仍然要求登入），
--     不會因為 view 而繞過上面 items/comments 的權限限制。
-- ---------------------------------------------------------------------
create or replace view public.items_with_comment_stats
with (security_invoker = true) as
select
  i.*,
  coalesce(c.comment_count, 0) as comment_count,
  c.last_comment_at
from public.items i
left join (
  select item_id, count(*) as comment_count, max(created_at) as last_comment_at
  from public.comments
  group by item_id
) c on c.item_id = i.id;

grant select on public.items_with_comment_stats to authenticated;

-- ---------------------------------------------------------------------
-- 5. Realtime：讓留言能即時推播到前端
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.comments;

-- ---------------------------------------------------------------------
-- 6. Storage bucket：item-files（只有 service_role 能上傳）
--    注意：bucket 本身是 public bucket，代表如果有人「已經知道」某個檔案的
--    完整網址（雜湊過的路徑，不會被公開列出、也需要先登入才看得到清單），
--    直接打那個網址還是能下載，不受下面這條 authenticated policy 限制。
--    這是為了保持簡單（不用簽名網址）而接受的取捨，詳見 README 的安全性說明。
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('item-files', 'item-files', true)
on conflict (id) do nothing;

drop policy if exists "public read item-files" on storage.objects;
create policy "public read item-files" on storage.objects
  for select to authenticated
  using (bucket_id = 'item-files');

-- 沒有給 anon/authenticated 在 storage.objects 上的 insert/update/delete policy，
-- 所以檔案上傳只能透過 publish.py 使用的 service_role key（該 key 會略過 RLS）。

-- ---------------------------------------------------------------------
-- 7. Storage bucket：comment-uploads（留言附加圖片／檔案，任何人可上傳，5MB／限定檔案類型）
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comment-uploads', 'comment-uploads', true,
  5242880,
  array[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = excluded.public;

drop policy if exists "public read comment-uploads" on storage.objects;
create policy "public read comment-uploads" on storage.objects
  for select to authenticated
  using (bucket_id = 'comment-uploads');

drop policy if exists "public upload comment-uploads" on storage.objects;
create policy "public upload comment-uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'comment-uploads');

-- 同樣沒有開放 anon update/delete，留言附件不會因為刪除留言而自動從雲端空間清除
-- （只會刪掉 comments 資料列本身），這是刻意的取捨，避免需要額外的伺服器端邏輯。

-- =======================================================================
-- 出船管理（3社共用的訂單檢査／出貨排程，來源另一份 Excel「銘環船_出船管理」）
-- =======================================================================

-- ---------------------------------------------------------------------
-- 8. shipments：逐筆訂單品項的 HTW 檢査排程與出貨資訊（id = 発注No_行No）
-- ---------------------------------------------------------------------
create table if not exists public.shipments (
  id                            text primary key,
  row_order                     integer,        -- Excel 原始列號，用來還原排序
  customer                      text,           -- 得意先
  part_no                       text,           -- 品番
  order_no                      text,           -- 発注No
  line_no                       text,           -- 行No
  order_qty                     numeric,        -- 発注数量
  delivery_type                 text,           -- 納品種別(分納)
  order_due_date                date,           -- 発注納期
  htw_delivery_date             date,           -- HTWへの検査品納入日
  htw_inspection_planned_date   date,           -- HTW検査(計画日)
  htw_inspection_minutes        numeric,        -- HTW検査工数(分)
  htw_inspection_done_date      date,           -- HTW検査完了日
  mh_pickup_date                date,           -- MH集荷日
  twh_ship_month                text,           -- TWH出荷月
  twh_ship_vessel                text,           -- TWH出荷船
  komaki_ship_month             text,           -- 小牧出荷月
  komaki_ship_vessel            text,           -- 小牧出荷船
  japan_arrival_date            date,           -- 日本入荷日
  excel_comment                 text,           -- Excel 內原本的コメント欄
  updated_at                    timestamptz not null default now()
);

create index if not exists shipments_row_order_idx on public.shipments (row_order);

-- ---------------------------------------------------------------------
-- 9. shipment_comments：出船排程逐筆訂單的留言討論（結構比照 comments）
-- ---------------------------------------------------------------------
create table if not exists public.shipment_comments (
  id               bigint generated always as identity primary key,
  shipment_id      text not null references public.shipments(id) on delete cascade,
  author           text not null check (char_length(author) between 1 and 50),
  body             text not null check (char_length(body) between 1 and 2000),
  created_at       timestamptz not null default now(),
  edit_token       uuid not null default gen_random_uuid(),
  attachment_path  text,
  attachment_name  text
);

create index if not exists shipment_comments_shipment_id_idx
  on public.shipment_comments (shipment_id, created_at);

-- ---------------------------------------------------------------------
-- 10. sailing_schedule：船期參考表（對照 shipments 的「◯月◯船目」文字），
--     純參考資料，不需要留言，每次同步用全刪重建。
-- ---------------------------------------------------------------------
create table if not exists public.sailing_schedule (
  id                     bigint generated always as identity primary key,
  seq_no                 integer,        -- No.
  meikan_pickup_range    text,           -- 銘環集荷日（日期區間字串）
  htw_taichung_arrival   text,           -- HTW台中倉庫搬入日
  schedule_label         text,           -- 日程（例："8月1船目"）
  tw_closing_date        text,           -- 台湾側CLOSING予定
  jp_eta_date            date,           -- 日本側ETA予定
  komaki_arrival_date    date,           -- 小牧センター着予定
  note                   text
);

-- ---------------------------------------------------------------------
-- 11. Row Level Security：跟品項資料同一套規則（僅 authenticated 可讀，
--     authenticated 可新增留言，其餘只能靠 service_role 寫入）
-- ---------------------------------------------------------------------
alter table public.shipments         enable row level security;
alter table public.shipment_comments enable row level security;
alter table public.sailing_schedule  enable row level security;

drop policy if exists "public read shipments" on public.shipments;
create policy "public read shipments" on public.shipments
  for select to authenticated using (true);

drop policy if exists "public read shipment_comments" on public.shipment_comments;
create policy "public read shipment_comments" on public.shipment_comments
  for select to authenticated using (true);

drop policy if exists "public insert shipment_comments" on public.shipment_comments;
create policy "public insert shipment_comments" on public.shipment_comments
  for insert to authenticated with check (
    char_length(author) between 1 and 50 and char_length(body) between 1 and 2000
  );

drop policy if exists "public read sailing_schedule" on public.sailing_schedule;
create policy "public read sailing_schedule" on public.sailing_schedule
  for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- 12. 刪除自己在出船排程留的言：邏輯比照 delete_own_comment
-- ---------------------------------------------------------------------
create or replace function public.delete_own_shipment_comment(p_comment_id bigint, p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count int;
begin
  delete from public.shipment_comments
  where id = p_comment_id and edit_token = p_token;
  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

grant execute on function public.delete_own_shipment_comment(bigint, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 13. shipments_with_comment_stats：比照 items_with_comment_stats，
--     給列表頁顯示每筆訂單的留言數／最新留言時間、排序用。
-- ---------------------------------------------------------------------
create or replace view public.shipments_with_comment_stats
with (security_invoker = true) as
select
  s.*,
  coalesce(c.comment_count, 0) as comment_count,
  c.last_comment_at
from public.shipments s
left join (
  select shipment_id, count(*) as comment_count, max(created_at) as last_comment_at
  from public.shipment_comments
  group by shipment_id
) c on c.shipment_id = s.id;

grant select on public.shipments_with_comment_stats to authenticated;

-- ---------------------------------------------------------------------
-- 14. Realtime：留言即時推播（比照 comments）
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.shipment_comments;

-- ---------------------------------------------------------------------
-- 15. 留言附件沿用現有的 comment-uploads bucket，路徑會加 shipments/ 前綴
--     （例：shipments/{shipment_id}/{uuid}.ext），跟品項留言附件的路徑
--     （{item_id}/{uuid}.ext）不會混淆，不需要另外建 bucket 或加 policy。
