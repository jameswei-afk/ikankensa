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
};

document.addEventListener("DOMContentLoaded", () => I18N.apply());
