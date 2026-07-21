# 検査仕様 打合せサイト／檢驗規格討論網站

讓本社、台灣分社、廠商（目前鎖定メーカー＝「銘環」）能透過連結瀏覽品項的檢驗規格資料、
下載對應檔案，並用類似社群留言的方式即時討論外觀檢查基準、檢驗項目等議題。網站設有登入保護，
三方各自共用一組帳號密碼（見「登入帳號」章節）。

## 專案結構

```
meikan-vendor-portal/
├── publish.py            # 本機同步腳本：讀 Excel → 比對資料夾 → 寫入 Supabase
├── remove_item.py         # 移除已討論完成的品項（含檔案、留言、附件）
├── .env.example           # publish.py / remove_item.py 需要的環境變數範例
├── supabase/
│   └── schema.sql          # Supabase 資料表 + 權限設定，建專案後貼到 SQL Editor 執行一次
└── docs/                    # 靜態前端網站（用 GitHub Pages 發布，資料夾必須叫 docs）
    ├── index.html / app.js       # 品項列表（feed）
    ├── item.html / item.js       # 品項詳情：檔案下載＋留言
    ├── login.html / login.js     # 登入頁
    ├── auth.js                   # 共用的登入檢查／登出邏輯
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

### 4. 設定登入帳號（Supabase Auth）

網站需要登入才能瀏覽，帳號是 Supabase Auth 裡的使用者，用 email/密碼登入（email 不需要是真實信箱，
只是帳號的識別方式）。目前設定的是三組共用帳號：本社、台灣、銘環各一組。

在 Supabase 後台 **Authentication → Users** 可以新增/刪除/重設密碼：
https://supabase.com/dashboard/project/dgxjofupgfnyvgttuask/auth/users

新增帳號時記得把 **Auto Confirm User** 打勾（或建立時就帶入已驗證狀態），不然帳號會卡在「尚未驗證」
無法登入。實際的帳號密碼另外透過安全管道（非 GitHub）保存與分享，不會寫進這個檔案或提交進版本控制。

### 5. 分享給本社／台灣／廠商

- 列表頁（看全部品項）：`https://<你的帳號>.github.io/<repo名稱>/`
- 單一品項頁（例如只想給某個廠商看特定品項）：`https://<你的帳號>.github.io/<repo名稱>/item.html?id=PS-00064`
- 對方第一次打開任何頁面都會被導去登入頁，輸入所屬單位的帳號密碼後才能瀏覽、下載檔案、留言。
- 登入狀態會保留在瀏覽器裡，之後不用每次都重新登入；要登出可按網站右上角「登出」。

## 每週例行更新流程

本社與台灣分社每週討論完 Excel 後：

1. 確認 Excel（`20250821_購入仕様書_完了状況一覧.xlsx`）已存檔更新。
2. 在本機執行：
   ```
   python publish.py
   ```
3. 完成後，新確認完成的品項會自動出現在網站上，廠商即可看到並留言討論。

腳本可重複執行，沒有變化的品項/檔案不會重複寫入或重傳，執行順序不影響結果。

## 移除已討論完成的品項

品項確定討論完、不需要再放網站上時，用 `remove_item.py` 一次清乾淨（items 資料列、關聯的
留言、item-files 裡的參考資料檔案、comment-uploads 裡的留言附件，全部一起刪除）：

```
python remove_item.py PS-00046           # 先預覽會刪什麼，不會真的刪
python remove_item.py PS-00046 --yes     # 確認沒問題後才加 --yes 真的執行
```

注意：這個刪除是**永久性的、無法復原**，執行前請先用不加 `--yes` 的預覽模式確認品項編號正確。
之後如果 Excel 裡這個品項的「銘環確認」欄位還維持有內容，下次跑 `publish.py` 又會把它加回網站，
所以真的要移除的話記得同時在 Excel 把該筆的銘環確認欄位清空或改成 `-`。

## 目前的篩選規則（如需調整可修改 `publish.py` 開頭常數）

- `メーカー` 欄位 == `銘環`
- `銘環確認` 欄位非空白，且不等於 `-`
  （代表本社與台灣已討論出具體結論或狀態，可以拿去跟廠商討論）
- 檔案僅抓取檔名包含「購入仕様書」「購入仕様図」「製品外観目視検査基準」「検査基準書」「検査成績書」的檔案，
  且只抓子資料夾第一層（不含「旧版」等子資料夾內的檔案）
- 同一個關鍵字底下如果同時有 PDF 跟其他格式（Word／Excel）的重複檔案，只保留 PDF 版本

## 已知限制／未來可擴充方向

- 網站需要登入（見上方「設定登入帳號」），但目前是 3 組共用帳號（本社／台灣／銘環各一組），
  不是每人一組，無法細分是哪個人留的言，只能看留言身份下拉選單自己填的內容。
- 檔案下載連結雖然需要先登入才「查得到」，但下載連結本身（Supabase Storage 的 public bucket 網址）
  一旦被複製出去，沒登入也打得開。也就是說「進網站瀏覽」有擋，但「單一檔案連結」本身沒有加密／簽名保護。
  如需更嚴謹的保護，可改用 Supabase Storage 的 signed URL（有時效性的簽名連結），但這會讓程式更複雜。
- 每則留言都能被「自己（同一台瀏覽器/裝置）」刪除：送出留言時瀏覽器會產生一組隨機金鑰存在該瀏覽器的
  localStorage，只有同一瀏覽器留的言旁邊才會出現「刪除」按鈕。清瀏覽器資料或換裝置就無法再刪除舊留言。
  別人的留言／垃圾留言仍需到 Supabase 後台的 Table Editor 手動刪除該筆 `comments` 資料。
- 留言身份固定為「日本早川／台湾早川／銘環」三選一（下拉選單），如需增加選項可調整 `docs/item.html` 裡的 `<select id="authorInput">`。
- 留言可以附加一張圖片或檔案（限 5MB，圖片／PDF／Word／Excel），支援直接貼上截圖。附件存在 `comment-uploads`
  這個 bucket，跟留言刪除一樣，刪除留言不會自動清掉附件檔案本身，只會清掉留言紀錄。
- 若之後要開放給更多メーカー，只需調整 `publish.py` 裡的 `TARGET_MAKER` 常數，或改成支援多個メーカー的清單。
