const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const params = new URLSearchParams(window.location.search);
const itemId = params.get("id");

let currentItem = null;
let currentFiles = [];
let currentComments = [];

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function fileUrl(storagePath) {
  return `${SUPABASE_URL}/storage/v1/object/public/item-files/${storagePath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(I18N.lang === "ja" ? "ja-JP" : "zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function renderItem() {
  const el = document.getElementById("itemDetail");
  if (!currentItem) {
    el.innerHTML = `<div class="empty-state">${I18N.t("not_found")}</div>`;
    return;
  }
  const item = currentItem;
  el.innerHTML = `
    <div class="detail-card">
      <span class="card-id">${escapeHtml(item.id)}</span>
      <h2>${escapeHtml(item.part_no || "")} ${escapeHtml(item.part_name ? "／ " + item.part_name : "")}</h2>
      <dl class="meta-grid">
        <dt data-i18n="customer">顧客</dt><dd>${escapeHtml(item.customer || "-")}</dd>
        <dt data-i18n="maker">メーカー</dt><dd>${escapeHtml(item.maker || "-")}</dd>
        <dt data-i18n="part_no">品番</dt><dd>${escapeHtml(item.part_no || "-")}</dd>
        <dt data-i18n="part_name">品名</dt><dd>${escapeHtml(item.part_name || "-")}</dd>
      </dl>
      ${item.meikan_note ? `
        <div class="note-box">
          <strong data-i18n="meikan_note">確認事項</strong>: ${escapeHtml(item.meikan_note)}
        </div>` : ""}

      <div class="section-title" data-i18n="files">関連資料</div>
      <div class="file-list">
        ${currentFiles.length
          ? currentFiles.map((f) => `
            <div class="file-row">
              <span class="fname">${escapeHtml(f.filename)}</span>
              <a class="dl-btn" href="${fileUrl(f.storage_path)}" target="_blank" rel="noopener" data-i18n="download">ダウンロード</a>
            </div>`).join("")
          : `<div class="empty-state">${I18N.t("no_files")}</div>`}
      </div>
    </div>
  `;
  I18N.apply();
}

function renderComments() {
  const el = document.getElementById("commentList");
  if (currentComments.length === 0) {
    el.innerHTML = `<div class="empty-state">${I18N.t("no_comments")}</div>`;
    return;
  }
  el.innerHTML = currentComments.map((c) => `
    <div class="comment">
      <div class="c-head">
        <span class="c-author">${escapeHtml(c.author)}</span>
        <span class="c-time">${formatTime(c.created_at)}</span>
      </div>
      <div class="c-body">${escapeHtml(c.body)}</div>
    </div>
  `).join("");
}

async function loadItem() {
  if (!itemId) {
    currentItem = null;
    renderItem();
    return;
  }

  const [{ data: item, error: itemErr }, { data: files, error: filesErr }, { data: comments, error: commentsErr }] =
    await Promise.all([
      supabaseClient.from("items").select("*").eq("id", itemId).maybeSingle(),
      supabaseClient.from("item_files").select("filename,storage_path").eq("item_id", itemId).order("filename"),
      supabaseClient.from("comments").select("*").eq("item_id", itemId).order("created_at", { ascending: true }),
    ]);

  if (itemErr) console.error(itemErr);
  if (filesErr) console.error(filesErr);
  if (commentsErr) console.error(commentsErr);

  currentItem = item || null;
  currentFiles = files || [];
  currentComments = comments || [];

  document.title = currentItem
    ? `${currentItem.part_no || currentItem.id} - ${document.title}`
    : document.title;

  renderItem();
  renderComments();
  subscribeToComments();
}

function subscribeToComments() {
  if (!itemId) return;
  supabaseClient
    .channel(`comments-${itemId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "comments", filter: `item_id=eq.${itemId}` },
      (payload) => {
        if (currentComments.some((c) => c.id === payload.new.id)) return;
        currentComments.push(payload.new);
        renderComments();
      }
    )
    .subscribe();
}

async function postComment() {
  const authorInput = document.getElementById("authorInput");
  const bodyInput = document.getElementById("bodyInput");
  const msg = document.getElementById("formMsg");
  const btn = document.getElementById("postBtn");

  const author = authorInput.value.trim();
  const body = bodyInput.value.trim();

  if (!author || !body) {
    msg.textContent = I18N.t("empty_error");
    msg.className = "form-msg error";
    return;
  }

  btn.disabled = true;
  msg.textContent = I18N.t("posting");
  msg.className = "form-msg";

  const { data, error } = await supabaseClient
    .from("comments")
    .insert({ item_id: itemId, author, body })
    .select()
    .single();

  btn.disabled = false;

  if (error) {
    console.error(error);
    msg.textContent = I18N.t("post_error");
    msg.className = "form-msg error";
    return;
  }

  if (data && !currentComments.some((c) => c.id === data.id)) {
    currentComments.push(data);
    renderComments();
  }

  msg.textContent = "";
  bodyInput.value = "";
}

window.onI18nApply = () => {
  renderItem();
  renderComments();
};

loadItem();
