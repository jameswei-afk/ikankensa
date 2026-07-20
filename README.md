# 検査仕様 打合せサイト／檢驗規格討論網站

讓本社、台灣分社、廠商（目前鎖定メーカー＝「銘環」）能免登入透過連結瀏覽品項的檢驗規格資料、
下載對應檔案，並用類似社群留言的方式即時討論外觀檢查基準、檢驗項目等議題。

## 專案結構

```
meikan-vendor-portal/
├── publish.py            # 本機同步腳本：讀 Excel → 比對資料夾 → 寫入 Supabase
├── .env.example           # publish.py 需要的環境變數範例
├── supabase/
│   └── schema.sql          # Supabase 資料表 + 權限設定，建專案後貼到 SQL Editor 執行一次
└── docs/                    # 靜態前端網站（用 GitHub Pages 發布，資料夾必須叫 docs）
    ├── index.html / app.js       # 品項列表（feed）
    ├── item.html / item.js       # 品項詳情：檔案下載＋留言
    ├── config.js                 # 填入 Supabase URL / anon key
    ├── i18n.js                   # 日文／中文介面切換
    └── style.css
```

## 第一次建置步驟

### 1. 建立 Supabase 專案（免費方案）

1. 到 https://supabase.com 註冊、建立新專案（免費 Free 方案，一般不需要信用卡）。
2. 進專案後，左側選單 **SQL Editor** → 開新查詢，貼上 `supabase/schema.sql` 的全部內容並執行。
   - 這會建立 `items`、`item_files`、`comments` 三張表、對應的權限規則（RLS）、
     開啟 `comments` 的即時推播（Realtime），以及一個公開唯讀的 Storage bucket `item-files`。
3. 左側選單 **Project Settings → API**，記下三個值：
   - `Project URL`
   - `anon public` key
   - `service_role` key（**機密，不要外流**）

### 2. 設定 publish.py（本機同步腳本）

1. 複製 `.env.example` 為 `.env`，把 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` 換成上一步記下的值。
2. 安裝需要的 Python 套件（`openpyxl`、`requests`）：
   ```
   pip install openpyxl requests
   ```
3. 先跑一次 dry-run 確認抓取的品項、檔案是否符合預期（不會連線 Supabase）：
   ```
   python publish.py --dry-run
   ```
4. 確認沒問題後正式執行，會把資料與檔案寫入 Supabase：
   ```
   python publish.py
   ```
   結束後畫面會顯示新增/更新的品項數、上傳的檔案數。

### 3. 設定前端網站，用 GitHub Pages 發布

1. 打開 `docs/config.js`，把 `SUPABASE_URL`、`SUPABASE_ANON_KEY` 換成前面記下的
   `Project URL` 與 `anon public` key（**這個 key 本來就設計成可以放在前端**，不是機密）。
2. 到 GitHub 建立一個新的 **空** repository（不要勾選自動加 README/.gitignore/License，避免跟本地衝突）。
3. 在本機專案根目錄（`meikan-vendor-portal/`）執行：
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<你的帳號>/<repo名稱>.git
   git push -u origin main
   ```
   （`.env` 已加入 `.gitignore`，機密金鑰不會被推上去）
4. 到 GitHub repo 的 **Settings → Pages**：
   - Source 選 **Deploy from a branch**
   - Branch 選 **main**，資料夾選 **/docs**，按 Save
   - 稍等一下，GitHub 會給一個網址，格式是 `https://<你的帳號>.github.io/<repo名稱>/`
5. 打開這個網址測試：應該能看到品項列表、點進去能看到檔案下載按鈕與留言區。

### 4. 分享給本社／台灣／廠商

- 列表頁（看全部品項）：`https://<你的帳號>.github.io/<repo名稱>/`
- 單一品項頁（例如只想給某個廠商看特定品項）：`https://<你的帳號>.github.io/<repo名稱>/item.html?id=PS-00064`
- 任何知道連結的人都可以瀏覽、下載檔案、留言（無需帳號密碼），請視需要自行決定連結的分享範圍。

## 每週例行更新流程

本社與台灣分社每週討論完 Excel 後：

1. 確認 Excel（`20250821_購入仕様書_完了状況一覧.xlsx`）已存檔更新。
2. 在本機執行：
   ```
   python publish.py
   ```
3. 完成後，新確認完成的品項會自動出現在網站上，廠商即可看到並留言討論。

腳本可重複執行，沒有變化的品項/檔案不會重複寫入或重傳，執行順序不影響結果。

## 目前的篩選規則（如需調整可修改 `publish.py` 開頭常數）

- `メーカー` 欄位 == `銘環`
- `銘環確認` 欄位非空白，且不等於 `-`
  （代表本社與台灣已討論出具體結論或狀態，可以拿去跟廠商討論）
- 檔案僅抓取檔名包含「購入仕様書」「購入仕様図」「製品外観目視検査基準」「検査基準書」的檔案，
  且只抓子資料夾第一層（不含「旧版」等子資料夾內的檔案）

## 已知限制／未來可擴充方向

- 留言目前無登入機制，任何知道連結的人都可以留言；如需防灌水，可考慮加入簡易通關密碼。
- 留言目前沒有內建刪除功能，垃圾留言可到 Supabase 後台的 Table Editor 手動刪除該筆 `comments` 資料。
- 留言沒有分類標籤／附件上傳，如需要可以再擴充 `comments` 表與前端表單。
- 若之後要開放給更多メーカー，只需調整 `publish.py` 裡的 `TARGET_MAKER` 常數，或改成支援多個メーカー的清單。
