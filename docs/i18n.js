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
    meikan_note: "確認事項",
    files: "関連資料",
    download: "ダウンロード",
    no_files: "資料がありません",
    comments: "コメント",
    comment_placeholder: "コメントを入力してください",
    name_placeholder: "お名前・会社名",
    post: "投稿する",
    back: "一覧に戻る",
    no_comments: "まだコメントはありません。最初のコメントを投稿してみましょう。",
    loading: "読み込み中…",
    posting: "送信中…",
    post_error: "送信に失敗しました。もう一度お試しください。",
    empty_error: "お名前とコメントの両方を入力してください。",
    item_count: "件",
    not_found: "品項が見つかりませんでした。",
    footer_note: "※ このリンクを知っている方であれば、どなたでも閲覧・コメント投稿ができます。",
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
    meikan_note: "討論主題",
    files: "相關資料",
    download: "下載",
    no_files: "目前沒有檔案",
    comments: "留言",
    comment_placeholder: "請輸入留言內容",
    name_placeholder: "姓名／公司名稱",
    post: "送出留言",
    back: "回列表",
    no_comments: "目前還沒有留言,歡迎留下第一則留言。",
    loading: "載入中…",
    posting: "送出中…",
    post_error: "送出失敗,請再試一次。",
    empty_error: "請輸入姓名與留言內容。",
    item_count: "筆",
    not_found: "找不到這個品項。",
    footer_note: "※ 知道這個連結網址的人,都可以瀏覽與留言。",
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
  },
};

document.addEventListener("DOMContentLoaded", () => I18N.apply());
