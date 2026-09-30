// 簡易日文/中文 UI 標籤切換（不翻譯資料本身，只切換介面文字）
const I18N_LABELS = {
  ja: {
    site_title: "検査仕様 打合せサイト",
    subtitle: "本社・台湾・仕入先で仕様を確認・相談するページです",
    search_placeholder: "顧客・品番・品名で検索",
    lang_toggle: "中文",
    customer: "顧客",
    part_no: "品番",
    part_name: "品名",
    maker: "メーカー",
    files: "関連資料",
    download: "ダウンロード",
    no_files: "資料がありません",
    comments: "コメント",
    comment_placeholder: "コメントを入力してください",
    commenting_as: "コメントする立場",
    post: "投稿する",
    back: "一覧に戻る",
    no_comments: "まだコメントはありません。最初のコメントを投稿してみましょう。",
    loading: "読み込み中…",
    posting: "送信中…",
    post_error: "送信に失敗しました。もう一度お試しください。",
    empty_error: "コメントを入力してください。",
    item_count: "件",
    item_count_comments: "件",
    no_comments_short: "コメントなし",
    not_found: "品項が見つかりませんでした。",
    footer_note: "※ このリンクを知っている方であれば、どなたでも閲覧・コメント投稿ができます。",
    delete: "削除",
    delete_confirm: "このコメントを削除しますか？",
    delete_error: "削除に失敗しました。もう一度お試しください。",
    attach: "添付ファイル",
    attach_remove: "取り消す",
    uploading: "アップロード中…",
    file_too_large: "ファイルは5MB以内にしてください。",
    file_type_error: "対応していないファイル形式です（画像／PDF／Word／Excel のみ）。",
    upload_error: "ファイルのアップロードに失敗しました。もう一度お試しください。",
    logout: "ログアウト",
    login_title: "ログイン",
    login_email: "メールアドレス",
    login_password: "パスワード",
    login_button: "ログイン",
    login_empty_error: "メールアドレスとパスワードを入力してください。",
    login_error: "メールアドレスまたはパスワードが違います。",
    nav_shipping: "出船管理",
    shipping_title: "出船管理",
    shipping_subtitle: "HTW検査スケジュールと出荷船便の一覧",
    shipping_search_placeholder: "得意先・品番・発注No で検索",
    schedule_summary: "船期表を見る（参考）",
    sch_col_label: "日程",
    sch_col_pickup: "銘環集荷日",
    sch_col_closing: "台湾側CLOSING",
    sch_col_eta: "日本側ETA",
    sch_col_komaki: "小牧センター着",
    ship_col_customer: "得意先",
    ship_col_partno: "品番",
    ship_col_order: "発注No / 行No",
    ship_col_due: "発注納期",
    ship_col_inspection: "HTW検査完了日",
    ship_col_vessel: "出荷船",
    ship_col_arrival: "日本入荷日",
    ship_col_comments: "コメント",
    ship_not_done: "未完了",
    ship_col_delivery_type: "納品種別(分納)",
    ship_col_htw_delivery: "HTWへの検査品納入日",
    ship_col_htw_planned: "HTW検査(計画日)",
    ship_col_htw_minutes: "HTW検査工数(分)",
    ship_col_mh_pickup: "MH集荷日",
    ship_col_excel_comment: "メモ",
    ship_col_twh_ship: "TWH出荷(月・船)",
    ship_col_komaki_ship: "小牧出荷(月・船)",
    ship_collapse: "▲ 閉じる",
    ship_edit: "編集",
    ship_save: "保存",
    ship_cancel: "キャンセル",
    ship_saving: "保存中…",
    ship_save_error: "保存に失敗しました。もう一度お試しください。",
    ship_last_updated: "最終更新：",
    ship_col_order_no: "発注No",
    ship_col_line_no: "行No",
    ship_col_order_qty: "発注数量",
    new_order_summary: "＋ 新しい注文を追加",
    new_order_submit: "追加する",
    new_order_success: "注文を追加しました。",
    new_order_duplicate_error: "この発注No／行No はすでに存在します。",
    new_order_error: "追加に失敗しました。もう一度お試しください。",
    new_order_required_error: "発注No と 行No は必須です。",
  },
  zh: {
    site_title: "檢驗規格討論網站",
    subtitle: "本社、台灣分社、廠商一起確認與討論檢驗規格的頁面",
    search_placeholder: "搜尋顧客、品番、品名",
    lang_toggle: "日本語",
    customer: "顧客",
    part_no: "品番",
    part_name: "品名",
    maker: "メーカー",
    files: "相關資料",
    download: "下載",
    no_files: "目前沒有檔案",
    comments: "留言",
    comment_placeholder: "請輸入留言內容",
    commenting_as: "留言身份",
    post: "送出留言",
    back: "回列表",
    no_comments: "目前還沒有留言,歡迎留下第一則留言。",
    loading: "載入中…",
    posting: "送出中…",
    post_error: "送出失敗,請再試一次。",
    empty_error: "請輸入留言內容。",
    item_count: "筆",
    item_count_comments: "則",
    no_comments_short: "尚無留言",
    not_found: "找不到這個品項。",
    footer_note: "※ 知道這個連結網址的人,都可以瀏覽與留言。",
    delete: "刪除",
    delete_confirm: "確定要刪除這則留言嗎?",
    delete_error: "刪除失敗,請再試一次。",
    attach: "附加檔案",
    attach_remove: "取消附加",
    uploading: "上傳中…",
    file_too_large: "檔案請控制在 5MB 以內。",
    file_type_error: "不支援這種檔案格式(僅限圖片／PDF／Word／Excel)。",
    upload_error: "檔案上傳失敗,請再試一次。",
    logout: "登出",
    login_title: "登入",
    login_email: "電子郵件",
    login_password: "密碼",
    login_button: "登入",
    login_empty_error: "請輸入電子郵件與密碼。",
    login_error: "電子郵件或密碼錯誤。",
    nav_shipping: "出船管理",
    shipping_title: "出船管理",
    shipping_subtitle: "HTW檢查排程與出貨船期一覽",
    shipping_search_placeholder: "得意先・品番・発注No 搜尋",
    schedule_summary: "查看船期表(參考)",
    sch_col_label: "日程",
    sch_col_pickup: "銘環集荷日",
    sch_col_closing: "台湾側CLOSING",
    sch_col_eta: "日本側ETA",
    sch_col_komaki: "小牧センター着",
    ship_col_customer: "得意先",
    ship_col_partno: "品番",
    ship_col_order: "発注No / 行No",
    ship_col_due: "発注納期",
    ship_col_inspection: "HTW検査完了日",
    ship_col_vessel: "出荷船",
    ship_col_arrival: "日本入荷日",
    ship_col_comments: "留言",
    ship_not_done: "未完了",
    ship_col_delivery_type: "納品種別(分納)",
    ship_col_htw_delivery: "HTWへの検査品納入日",
    ship_col_htw_planned: "HTW検査(計画日)",
    ship_col_htw_minutes: "HTW検査工数(分)",
    ship_col_mh_pickup: "MH集荷日",
    ship_col_excel_comment: "備註",
    ship_col_twh_ship: "TWH出貨(月・船)",
    ship_col_komaki_ship: "小牧出貨(月・船)",
    ship_collapse: "▲ 收合",
    ship_edit: "編輯",
    ship_save: "儲存",
    ship_cancel: "取消",
    ship_saving: "儲存中…",
    ship_save_error: "儲存失敗,請再試一次。",
    ship_last_updated: "最後更新：",
    ship_col_order_no: "発注No",
    ship_col_line_no: "行No",
    ship_col_order_qty: "発注数量",
    new_order_summary: "＋ 新增訂單",
    new_order_submit: "新增",
    new_order_success: "已新增訂單。",
    new_order_duplicate_error: "這個発注No／行No 已經有訂單存在。",
    new_order_error: "新增失敗,請再試一次。",
    new_order_required_error: "発注No 與 行No 為必填。",
  },
};

const I18N = {
  lang: localStorage.getItem("lang") || "zh",
  t(key) {
    return (I18N_LABELS[this.lang] && I18N_LABELS[this.lang][key]) || key;
  },
  setLang(lang) {
    this.lang = lang;
    localStorage.setItem("lang", lang);
    this.apply();
  },
  toggle() {
    this.setLang(this.lang === "ja" ? "zh" : "ja");
  },
  apply() {
    // renderItem() 等 render 関数がその内部で apply() を呼ぶことがあるため、
    // onI18nApply() 経由で再び apply() が呼ばれても無限再帰しないようにガードする
    if (this._applying) return;
    this._applying = true;
    try {
      document.documentElement.lang = this.lang === "ja" ? "ja" : "zh-Hant";
      document.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = this.t(el.getAttribute("data-i18n"));
      });
      document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        el.setAttribute("placeholder", this.t(el.getAttribute("data-i18n-placeholder")));
      });
      document.querySelectorAll("[data-lang-toggle]").forEach((el) => {
        el.textContent = this.t("lang_toggle");
      });
      if (typeof window.onI18nApply === "function") window.onI18nApply();
    } finally {
      this._applying = false;
    }
  },
  // apply() の全域版（onI18nApply() 経由で全体を再描画する）とは別に、
  // 特定のコンテナだけ翻訳したいとき用（例：shipping.js が自分で新規生成した
  // 要素を翻訳する場合）。onI18nApply() を呼ばないので再入・多重描画を起こさない。
  applyTo(root) {
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = this.t(el.getAttribute("data-i18n"));
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.setAttribute("placeholder", this.t(el.getAttribute("data-i18n-placeholder")));
    });
  },
};

document.addEventListener("DOMContentLoaded", () => I18N.apply());
