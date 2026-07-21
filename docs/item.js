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

// Excel の品名は「品番_品名」の形式で入っているため、品番の重複を避けて
// 最初の "_" より後ろだけを表示用の品名として使う
function displayPartName(item) {
  const name = item.part_name || "";
  const idx = name.indexOf("_");
  return idx >= 0 ? name.slice(idx + 1) : name;
}

function fileUrl(storagePath, filename) {
  const path = storagePath.split("/").map(encodeURIComponent).join("/");
  // storage_path はハッシュ化された ASCII セーフなキーなので、
  // ?download= でサーバー側に元のファイル名を Content-Disposition として返してもらう
  const dl = filename ? `?download=${encodeURIComponent(filename)}` : "?download";
  return `${SUPABASE_URL}/storage/v1/object/public/item-files/${path}${dl}`;
}

function attachmentUrl(storagePath, filename) {
  const path = storagePath.split("/").map(encodeURIComponent).join("/");
  const dl = filename ? `?download=${encodeURIComponent(filename)}` : "?download";
  return `${SUPABASE_URL}/storage/v1/object/public/comment-uploads/${path}${dl}`;
}

function attachmentViewUrl(storagePath) {
  // ダウンロード名を付けない、そのまま表示用の URL（画像プレビュー用）
  return `${SUPABASE_URL}/storage/v1/object/public/comment-uploads/${storagePath
    .split("/").map(encodeURIComponent).join("/")}`;
}

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp)$/i;
function isImageName(name) {
  return IMAGE_EXT_RE.test(name || "");
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(I18N.lang === "ja" ? "ja-JP" : "zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

// 自分がこのブラウザで投稿したコメントだけ削除できるように、
// コメント id -> edit_token をこの端末の localStorage に保存する
const MY_TOKENS_KEY = "meikanMyCommentTokens";

function getMyTokens() {
  try {
    return JSON.parse(localStorage.getItem(MY_TOKENS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveMyToken(commentId, token) {
  const tokens = getMyTokens();
  tokens[commentId] = token;
  localStorage.setItem(MY_TOKENS_KEY, JSON.stringify(tokens));
}

function forgetMyToken(commentId) {
  const tokens = getMyTokens();
  delete tokens[commentId];
  localStorage.setItem(MY_TOKENS_KEY, JSON.stringify(tokens));
}

// --- 留言附加圖片／檔案 ---
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = [
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

let selectedFile = null;

function renderAttachPreview() {
  const el = document.getElementById("attachPreview");
  if (!selectedFile) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `
    <span class="attach-chip">
      ${escapeHtml(selectedFile.name)}
      <button type="button" onclick="clearAttachment()">${I18N.t("attach_remove")}</button>
    </span>
  `;
}

function clearAttachment() {
  selectedFile = null;
  document.getElementById("fileInput").value = "";
  renderAttachPreview();
}

function handleFileSelected(file) {
  const msg = document.getElementById("formMsg");
  if (!file) return;
  if (file.size > MAX_ATTACHMENT_BYTES) {
    msg.textContent = I18N.t("file_too_large");
    msg.className = "form-msg error";
    return;
  }
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
    msg.textContent = I18N.t("file_type_error");
    msg.className = "form-msg error";
    return;
  }
  msg.textContent = "";
  selectedFile = file;
  renderAttachPreview();
}

async function uploadAttachment(file) {
  const ext = (file.name.match(/\.[a-zA-Z0-9]+$/) || [""])[0].toLowerCase();
  const path = `${itemId}/${crypto.randomUUID()}${ext}`;
  const { error } = await supabaseClient.storage
    .from("comment-uploads")
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  return { attachment_path: path, attachment_name: file.name };
}

function renderAttachment(c) {
  if (!c.attachment_path) return "";
  if (isImageName(c.attachment_name)) {
    return `
      <a href="${attachmentUrl(c.attachment_path, c.attachment_name)}" target="_blank" rel="noopener">
        <img class="c-attach-img" src="${attachmentViewUrl(c.attachment_path)}" alt="${escapeHtml(c.attachment_name)}" />
      </a>`;
  }
  return `
    <a class="c-attach-file" href="${attachmentUrl(c.attachment_path, c.attachment_name)}" target="_blank" rel="noopener">
      📎 ${escapeHtml(c.attachment_name)}
    </a>`;
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
      <h2>${escapeHtml(item.part_no || "")}</h2>
      <dl class="meta-grid">
        <dt>${I18N.t("customer")}</dt><dd>${escapeHtml(item.customer || "-")}</dd>
        <dt>${I18N.t("maker")}</dt><dd>${escapeHtml(item.maker || "-")}</dd>
        <dt>${I18N.t("part_no")}</dt><dd>${escapeHtml(item.part_no || "-")}</dd>
        <dt>${I18N.t("part_name")}</dt><dd>${escapeHtml(displayPartName(item) || "-")}</dd>
      </dl>

      <div class="section-title">${I18N.t("files")}</div>
      <div class="file-list">
        ${currentFiles.length
          ? currentFiles.map((f) => `
            <div class="file-row">
              <span class="fname">${escapeHtml(f.filename)}</span>
              <a class="dl-btn" href="${fileUrl(f.storage_path, f.filename)}" download="${escapeHtml(f.filename)}" target="_blank" rel="noopener">${I18N.t("download")}</a>
            </div>`).join("")
          : `<div class="empty-state">${I18N.t("no_files")}</div>`}
      </div>
    </div>
  `;
}

function renderComments() {
  const el = document.getElementById("commentList");
  if (currentComments.length === 0) {
    el.innerHTML = `<div class="empty-state">${I18N.t("no_comments")}</div>`;
    return;
  }
  const myTokens = getMyTokens();
  el.innerHTML = currentComments.map((c) => `
    <div class="comment">
      <div class="c-head">
        <div class="c-who">
          <span class="c-author">${escapeHtml(c.author)}</span>
          <span class="c-time">${formatTime(c.created_at)}</span>
        </div>
        ${myTokens[c.id] ? `<button class="c-delete" onclick="deleteComment(${c.id})">${I18N.t("delete")}</button>` : ""}
      </div>
      <div class="c-body">${escapeHtml(c.body)}</div>
      ${renderAttachment(c)}
    </div>
  `).join("");
}

async function deleteComment(commentId) {
  const token = getMyTokens()[commentId];
  if (!token) return;
  if (!window.confirm(I18N.t("delete_confirm"))) return;

  const { data, error } = await supabaseClient.rpc("delete_own_comment", {
    p_comment_id: commentId,
    p_token: token,
  });

  if (error || !data) {
    console.error(error);
    window.alert(I18N.t("delete_error"));
    return;
  }

  currentComments = currentComments.filter((c) => c.id !== commentId);
  forgetMyToken(commentId);
  renderComments();
}

async function loadItem() {
  const session = await requireLogin();
  if (!session) return;

  if (!itemId) {
    currentItem = null;
    renderItem();
    return;
  }

  const [{ data: item, error: itemErr }, { data: files, error: filesErr }, { data: comments, error: commentsErr }] =
    await Promise.all([
      supabaseClient.from("items").select("*").eq("id", itemId).maybeSingle(),
      supabaseClient.from("item_files").select("filename,storage_path").eq("item_id", itemId).order("filename"),
      supabaseClient
        .from("comments")
        .select("id,item_id,author,body,created_at,attachment_path,attachment_name")
        .eq("item_id", itemId)
        .order("created_at", { ascending: true }),
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
        const { edit_token, ...comment } = payload.new;
        currentComments.push(comment);
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

  let attachment = {};
  if (selectedFile) {
    msg.textContent = I18N.t("uploading");
    try {
      attachment = await uploadAttachment(selectedFile);
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      msg.textContent = I18N.t("upload_error");
      msg.className = "form-msg error";
      return;
    }
  }

  const token = crypto.randomUUID();

  const { data, error } = await supabaseClient
    .from("comments")
    .insert({ item_id: itemId, author, body, edit_token: token, ...attachment })
    .select("id,item_id,author,body,created_at,attachment_path,attachment_name")
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
    saveMyToken(data.id, token);
    renderComments();
  }

  msg.textContent = "";
  bodyInput.value = "";
  clearAttachment();
}

document.getElementById("fileInput").addEventListener("change", (e) => {
  handleFileSelected(e.target.files[0]);
});

document.getElementById("bodyInput").addEventListener("paste", (e) => {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        handleFileSelected(file);
      }
      break;
    }
  }
});

window.onI18nApply = () => {
  renderItem();
  renderComments();
};

loadItem();
