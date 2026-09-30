let allShipments = [];
let scheduleRows = [];
let currentAuthor = "";
const expandedIds = new Set();
const editingIds = new Set();  // shipmentId -> 目前是否處於「編輯追蹤欄位」模式
const commentsCache = {};      // shipmentId -> comments[]
const selectedFiles = {};      // shipmentId -> File
const activeChannels = {};     // shipmentId -> realtime channel

const SHIP_TOKENS_KEY = "meikanMyShipmentCommentTokens";

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function getMyShipTokens() {
  try {
    return JSON.parse(localStorage.getItem(SHIP_TOKENS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveMyShipToken(commentId, token) {
  const tokens = getMyShipTokens();
  tokens[commentId] = token;
  localStorage.setItem(SHIP_TOKENS_KEY, JSON.stringify(tokens));
}

function forgetMyShipToken(commentId) {
  const tokens = getMyShipTokens();
  delete tokens[commentId];
  localStorage.setItem(SHIP_TOKENS_KEY, JSON.stringify(tokens));
}

function formatDate(d) {
  if (!d) return "-";
  return d; // 已經是 YYYY-MM-DD，不需要再轉換
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(I18N.lang === "ja" ? "ja-JP" : "zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp)$/i;
function isImageName(name) {
  return IMAGE_EXT_RE.test(name || "");
}

function attachmentUrl(storagePath, filename) {
  const path = storagePath.split("/").map(encodeURIComponent).join("/");
  const dl = filename ? `?download=${encodeURIComponent(filename)}` : "?download";
  return `${SUPABASE_URL}/storage/v1/object/public/comment-uploads/${path}${dl}`;
}

function attachmentViewUrl(storagePath) {
  return `${SUPABASE_URL}/storage/v1/object/public/comment-uploads/${storagePath
    .split("/").map(encodeURIComponent).join("/")}`;
}

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = [
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

async function uploadShipmentAttachment(shipmentId, file) {
  const ext = (file.name.match(/\.[a-zA-Z0-9]+$/) || [""])[0].toLowerCase();
  const path = `shipments/${shipmentId}/${crypto.randomUUID()}${ext}`;
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

function shipDisplayText(s) {
  const parts = [];
  if (s.twh_ship_month || s.twh_ship_vessel) {
    parts.push(`TWH ${s.twh_ship_month || ""}${s.twh_ship_vessel || ""}`);
  }
  if (s.komaki_ship_month || s.komaki_ship_vessel) {
    parts.push(`小牧 ${s.komaki_ship_month || ""}${s.komaki_ship_vessel || ""}`);
  }
  return parts.length ? parts.join("<br>") : "-";
}

function renderScheduleTable() {
  const el = document.getElementById("scheduleTable");
  if (!scheduleRows.length) {
    el.innerHTML = `<div class="empty-state">-</div>`;
    return;
  }
  el.innerHTML = `
    <table class="ship-table schedule-mini">
      <thead>
        <tr>
          <th>No.</th>
          <th data-i18n="sch_col_label">日程</th>
          <th data-i18n="sch_col_pickup">銘環集荷日</th>
          <th data-i18n="sch_col_closing">台湾側CLOSING</th>
          <th data-i18n="sch_col_eta">日本側ETA</th>
          <th data-i18n="sch_col_komaki">小牧センター着</th>
        </tr>
      </thead>
      <tbody>
        ${scheduleRows.map((r) => `
          <tr>
            <td>${r.seq_no ?? "-"}</td>
            <td>${escapeHtml((r.schedule_label || "-").replace(/\n/g, " "))}</td>
            <td>${escapeHtml(r.meikan_pickup_range || "-")}</td>
            <td>${escapeHtml(r.tw_closing_date || "-")}</td>
            <td>${formatDate(r.jp_eta_date)}</td>
            <td>${formatDate(r.komaki_arrival_date)}</td>
          </tr>`).join("")}
      </tbody>
    </table>
  `;
  I18N.applyTo(el);
}

function renderShipmentTable(rows) {
  const wrap = document.getElementById("shipmentTableWrap");
  const count = document.getElementById("shipmentCount");
  count.textContent = `${rows.length} ${I18N.t("item_count")}`;

  if (rows.length === 0) {
    wrap.innerHTML = `<div class="empty-state">${I18N.t("not_found")}</div>`;
    return;
  }

  wrap.innerHTML = `
    <table class="ship-table">
      <thead>
        <tr>
          <th data-i18n="ship_col_customer">得意先</th>
          <th data-i18n="ship_col_partno">品番</th>
          <th data-i18n="ship_col_order">発注No / 行No</th>
          <th data-i18n="ship_col_due">発注納期</th>
          <th data-i18n="ship_col_inspection">HTW検査完了日</th>
          <th data-i18n="ship_col_vessel">出荷船</th>
          <th data-i18n="ship_col_arrival">日本入荷日</th>
          <th data-i18n="ship_col_comments">コメント</th>
        </tr>
      </thead>
      <tbody id="shipmentTbody">
        ${rows.map((s) => renderShipmentRow(s)).join("")}
      </tbody>
    </table>
  `;
  I18N.applyTo(wrap);

  // 展開狀態在重新 render 列表（例如搜尋）時要還原
  expandedIds.forEach((id) => {
    if (rows.some((s) => s.id === id)) insertDetailRow(id);
  });
}

function renderCommentBadge(s) {
  const unseen = isShipmentUnseen(s.id, s.last_comment_at);
  const count = s.comment_count || 0;
  return `
    <span class="ship-comment-badge${unseen ? " unseen" : ""}">
      ${unseen ? `<span class="new-dot"></span>` : ""}
      💬 ${count}
    </span>
  `;
}

function renderShipmentRow(s) {
  return `
    <tr class="ship-row" data-id="${escapeHtml(s.id)}">
      <td>${escapeHtml(s.customer || "-")}</td>
      <td>${escapeHtml(s.part_no || "-")}</td>
      <td>${escapeHtml(s.order_no || "")} / ${escapeHtml(s.line_no || "")}</td>
      <td>${formatDate(s.order_due_date)}</td>
      <td>${s.htw_inspection_done_date ? formatDate(s.htw_inspection_done_date) : `<span class="muted">${I18N.t("ship_not_done")}</span>`}</td>
      <td>${shipDisplayText(s)}</td>
      <td>${formatDate(s.japan_arrival_date)}</td>
      <td class="ship-comment-cell">${renderCommentBadge(s)}</td>
    </tr>
  `;
}

function toggleExpand(shipmentId) {
  if (expandedIds.has(shipmentId)) {
    expandedIds.delete(shipmentId);
    removeDetailRow(shipmentId);
    unsubscribeShipment(shipmentId);
  } else {
    expandedIds.add(shipmentId);
    // ユーザーが実際に「いま展開した」ときだけ既読にする。テーブル再描画後に
    // 展開状態を復元するだけの呼び出し（insertDetailRow）では既読時刻を
    // 更新しない（クライアント時計で上書きして未読判定が崩れるのを防ぐ）。
    markShipmentSeen(shipmentId);
    const summaryRow = document.querySelector(`.ship-row[data-id="${cssId(shipmentId)}"]`);
    const s = allShipments.find((r) => r.id === shipmentId);
    const badgeCell = summaryRow && summaryRow.querySelector(".ship-comment-cell");
    if (badgeCell && s) badgeCell.innerHTML = renderCommentBadge(s);
    insertDetailRow(shipmentId);
  }
}

function removeDetailRow(shipmentId) {
  const el = document.getElementById(`detail-${cssEscape(shipmentId)}`);
  if (el) el.remove();
}

function cssEscape(id) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function insertDetailRow(shipmentId) {
  const summaryRow = document.querySelector(`.ship-row[data-id="${cssId(shipmentId)}"]`);
  if (!summaryRow) return;
  if (document.getElementById(`detail-${cssEscape(shipmentId)}`)) return;

  const s = allShipments.find((r) => r.id === shipmentId);
  const tr = document.createElement("tr");
  tr.id = `detail-${cssEscape(shipmentId)}`;
  tr.className = "ship-detail-row";
  const td = document.createElement("td");
  td.colSpan = 8;
  td.innerHTML = `<div class="ship-detail-loading">${I18N.t("loading")}</div>`;
  tr.appendChild(td);
  summaryRow.insertAdjacentElement("afterend", tr);

  if (!commentsCache[shipmentId]) {
    const { data, error } = await supabaseClient
      .from("shipment_comments")
      .select("id,shipment_id,author,body,created_at,attachment_path,attachment_name")
      .eq("shipment_id", shipmentId)
      .order("created_at", { ascending: true });
    if (error) console.error(error);
    commentsCache[shipmentId] = data || [];
  }

  td.innerHTML = renderDetailContent(s);
  I18N.applyTo(td);
  subscribeShipment(shipmentId);
}

function renderTrackingView(s) {
  const updatedLine = s.updated_by
    ? `<div class="ship-updated-line">${I18N.t("ship_last_updated")}${escapeHtml(s.updated_by)}・${formatDateTime(s.updated_at)}</div>`
    : "";
  return `
    <div class="ship-tracking-view">
      <button type="button" class="ship-edit-btn" data-ship-id="${escapeHtml(s.id)}">✎ <span data-i18n="ship_edit">編集</span></button>
      <dl class="meta-grid">
        <dt data-i18n="ship_col_delivery_type">納品種別(分納)</dt><dd>${escapeHtml(s.delivery_type || "-")}</dd>
        <dt data-i18n="ship_col_htw_delivery">HTWへの検査品納入日</dt><dd>${formatDate(s.htw_delivery_date)}</dd>
        <dt data-i18n="ship_col_htw_planned">HTW検査(計画日)</dt><dd>${formatDate(s.htw_inspection_planned_date)}</dd>
        <dt data-i18n="ship_col_htw_minutes">HTW検査工数(分)</dt><dd>${s.htw_inspection_minutes ?? "-"}</dd>
        <dt data-i18n="ship_col_inspection">HTW検査完了日</dt><dd>${formatDate(s.htw_inspection_done_date)}</dd>
        <dt data-i18n="ship_col_mh_pickup">MH集荷日</dt><dd>${formatDate(s.mh_pickup_date)}</dd>
        <dt data-i18n="ship_col_twh_ship">TWH出荷(月・船)</dt><dd>${escapeHtml(s.twh_ship_month || "-")} ${escapeHtml(s.twh_ship_vessel || "")}</dd>
        <dt data-i18n="ship_col_komaki_ship">小牧出荷(月・船)</dt><dd>${escapeHtml(s.komaki_ship_month || "-")} ${escapeHtml(s.komaki_ship_vessel || "")}</dd>
        <dt data-i18n="ship_col_arrival">日本入荷日</dt><dd>${formatDate(s.japan_arrival_date)}</dd>
        <dt data-i18n="ship_col_excel_comment">メモ</dt><dd>${escapeHtml(s.excel_comment || "-")}</dd>
      </dl>
      ${updatedLine}
    </div>
  `;
}

function renderTrackingEdit(s) {
  return `
    <form class="ship-edit-form" data-ship-id="${escapeHtml(s.id)}">
      <label><span data-i18n="ship_col_htw_delivery">HTWへの検査品納入日</span>
        <input type="date" data-field="htw_delivery_date" value="${s.htw_delivery_date || ""}" /></label>
      <label><span data-i18n="ship_col_htw_planned">HTW検査(計画日)</span>
        <input type="date" data-field="htw_inspection_planned_date" value="${s.htw_inspection_planned_date || ""}" /></label>
      <label><span data-i18n="ship_col_htw_minutes">HTW検査工数(分)</span>
        <input type="number" data-field="htw_inspection_minutes" value="${s.htw_inspection_minutes ?? ""}" /></label>
      <label><span data-i18n="ship_col_inspection">HTW検査完了日</span>
        <input type="date" data-field="htw_inspection_done_date" value="${s.htw_inspection_done_date || ""}" /></label>
      <label><span data-i18n="ship_col_mh_pickup">MH集荷日</span>
        <input type="date" data-field="mh_pickup_date" value="${s.mh_pickup_date || ""}" /></label>
      <label><span data-i18n="ship_col_twh_ship">TWH出荷(月・船)</span>
        <span class="ship-edit-pair">
          <input type="text" data-field="twh_ship_month" value="${escapeHtml(s.twh_ship_month || "")}" placeholder="8月" />
          <input type="text" data-field="twh_ship_vessel" value="${escapeHtml(s.twh_ship_vessel || "")}" placeholder="1船目" />
        </span>
      </label>
      <label><span data-i18n="ship_col_komaki_ship">小牧出荷(月・船)</span>
        <span class="ship-edit-pair">
          <input type="text" data-field="komaki_ship_month" value="${escapeHtml(s.komaki_ship_month || "")}" placeholder="8月" />
          <input type="text" data-field="komaki_ship_vessel" value="${escapeHtml(s.komaki_ship_vessel || "")}" placeholder="1船目" />
        </span>
      </label>
      <label><span data-i18n="ship_col_arrival">日本入荷日</span>
        <input type="date" data-field="japan_arrival_date" value="${s.japan_arrival_date || ""}" /></label>
      <label class="ship-edit-full"><span data-i18n="ship_col_excel_comment">メモ</span>
        <textarea data-field="excel_comment">${escapeHtml(s.excel_comment || "")}</textarea></label>
      <div class="ship-edit-actions">
        <button type="submit" class="ship-save-btn" data-i18n="ship_save">保存</button>
        <button type="button" class="ship-cancel-btn" data-ship-id="${escapeHtml(s.id)}" data-i18n="ship_cancel">キャンセル</button>
      </div>
      <div id="editMsg-${cssEscape(s.id)}" class="form-msg"></div>
    </form>
  `;
}

function renderCommentsListHtml(s) {
  const comments = commentsCache[s.id] || [];
  const myTokens = getMyShipTokens();
  return comments.length === 0
    ? `<div class="empty-state">${I18N.t("no_comments")}</div>`
    : comments.map((c) => `
      <div class="comment">
        <div class="c-head">
          <div class="c-who">
            <span class="c-author">${escapeHtml(c.author)}</span>
            <span class="c-time">${formatDateTime(c.created_at)}</span>
          </div>
          ${myTokens[c.id] ? `<button class="c-delete" data-comment-id="${c.id}" data-ship-id="${escapeHtml(s.id)}">${I18N.t("delete")}</button>` : ""}
        </div>
        <div class="c-body">${escapeHtml(c.body)}</div>
        ${renderAttachment(c)}
      </div>`).join("");
}

function renderDetailContent(s) {
  const trackingBlock = editingIds.has(s.id) ? renderTrackingEdit(s) : renderTrackingView(s);
  return `
    <div class="ship-detail">
      <button type="button" class="ship-collapse-btn" data-ship-id="${escapeHtml(s.id)}" data-i18n="ship_collapse">▲ 閉じる</button>
      ${trackingBlock}

      <div class="section-title">${I18N.t("comments")}</div>
      <div class="comment-list" id="commentList-${cssEscape(s.id)}">
        ${renderCommentsListHtml(s)}
      </div>

      <div class="comment-form">
        <div class="author-display">
          <span data-i18n="commenting_as">コメントする立場</span>：<strong>${escapeHtml(currentAuthor)}</strong>
        </div>
        <textarea id="body-${cssEscape(s.id)}" maxlength="2000" data-i18n-placeholder="comment_placeholder" placeholder="コメントを入力してください"></textarea>
        <div class="attach-row">
          <label class="attach-btn" for="file-${cssEscape(s.id)}">📎 <span data-i18n="attach">添付ファイル</span></label>
          <input type="file" id="file-${cssEscape(s.id)}" data-ship-id="${escapeHtml(s.id)}"
                 accept="image/png,image/jpeg,image/gif,image/webp,.pdf,.doc,.docx,.xls,.xlsx" hidden />
          <span id="attachPreview-${cssEscape(s.id)}" class="attach-preview"></span>
        </div>
        <button data-i18n="post" data-ship-id="${escapeHtml(s.id)}" class="ship-post-btn">投稿する</button>
        <div id="msg-${cssEscape(s.id)}" class="form-msg"></div>
      </div>
    </div>
  `;
}

function cssId(id) {
  // querySelector 用の値として安全にエスケープ（属性値なので " を防げば十分）
  return id.replace(/"/g, '\\"');
}

// #shipmentTableWrap 本体は renderShipmentTable() で再生成されない固定コンテナなので、
// ここで一度だけ委譲リスナーを登録する（renderShipmentTable の都度 tbody に登録すると、
// I18N.apply() 経由の再入で同じ tbody に二重登録され、1クリックで2回トグルして
// 見た目上「反応しない」状態になるバグがあったため）。
document.getElementById("shipmentTableWrap").addEventListener("click", (e) => {
  const row = e.target.closest(".ship-row");
  if (row) toggleExpand(row.dataset.id);
});

document.addEventListener("click", async (e) => {
  const collapseBtn = e.target.closest(".ship-collapse-btn");
  if (collapseBtn) {
    toggleExpand(collapseBtn.dataset.shipId);
    return;
  }
  const editBtn = e.target.closest(".ship-edit-btn");
  if (editBtn) {
    enterShipmentEditMode(editBtn.dataset.shipId);
    return;
  }
  const cancelBtn = e.target.closest(".ship-cancel-btn");
  if (cancelBtn) {
    exitShipmentEditMode(cancelBtn.dataset.shipId);
    return;
  }
  const delBtn = e.target.closest(".c-delete");
  if (delBtn) {
    await deleteShipmentComment(delBtn.dataset.shipId, Number(delBtn.dataset.commentId));
    return;
  }
  const removeAttach = e.target.closest(".attach-chip button");
  if (removeAttach && removeAttach.dataset.shipId) {
    clearShipmentAttachment(removeAttach.dataset.shipId);
    return;
  }
  const postBtn = e.target.closest(".ship-post-btn");
  if (postBtn) {
    await postShipmentComment(postBtn.dataset.shipId);
    return;
  }
});

document.addEventListener("submit", async (e) => {
  const editForm = e.target.closest(".ship-edit-form");
  if (editForm) {
    e.preventDefault();
    await saveShipmentEdits(editForm.dataset.shipId);
    return;
  }
  if (e.target.id === "newOrderForm") {
    e.preventDefault();
    await createShipment();
  }
});

document.addEventListener("change", (e) => {
  if (e.target.matches('input[type="file"][id^="file-"]')) {
    handleShipmentFileSelected(e.target.dataset.shipId, e.target.files[0]);
  }
});

document.addEventListener("paste", (e) => {
  const target = e.target;
  if (!target.matches('textarea[id^="body-"]')) return;
  const shipmentId = target.id.replace(/^body-/, "");
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        // id は cssEscape されているので、実際の shipment id をマッピングから探す
        const realId = allShipments.find((s) => cssEscape(s.id) === shipmentId)?.id;
        if (realId) handleShipmentFileSelected(realId, file);
      }
      break;
    }
  }
});

function handleShipmentFileSelected(shipmentId, file) {
  const msg = document.getElementById(`msg-${cssEscape(shipmentId)}`);
  if (!file || !msg) return;
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
  selectedFiles[shipmentId] = file;
  renderShipmentAttachPreview(shipmentId);
}

function renderShipmentAttachPreview(shipmentId) {
  const el = document.getElementById(`attachPreview-${cssEscape(shipmentId)}`);
  if (!el) return;
  const file = selectedFiles[shipmentId];
  if (!file) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `
    <span class="attach-chip">
      ${escapeHtml(file.name)}
      <button type="button" data-ship-id="${escapeHtml(shipmentId)}">${I18N.t("attach_remove")}</button>
    </span>
  `;
}

function clearShipmentAttachment(shipmentId) {
  delete selectedFiles[shipmentId];
  const input = document.getElementById(`file-${cssEscape(shipmentId)}`);
  if (input) input.value = "";
  renderShipmentAttachPreview(shipmentId);
}

async function postShipmentComment(shipmentId) {
  const bodyInput = document.getElementById(`body-${cssEscape(shipmentId)}`);
  const msg = document.getElementById(`msg-${cssEscape(shipmentId)}`);
  const btn = document.querySelector(`.ship-post-btn[data-ship-id="${cssId(shipmentId)}"]`);

  const body = bodyInput.value.trim();
  if (!body) {
    msg.textContent = I18N.t("empty_error");
    msg.className = "form-msg error";
    return;
  }

  btn.disabled = true;
  msg.textContent = I18N.t("posting");
  msg.className = "form-msg";

  let attachment = {};
  const file = selectedFiles[shipmentId];
  if (file) {
    msg.textContent = I18N.t("uploading");
    try {
      attachment = await uploadShipmentAttachment(shipmentId, file);
    } catch (err) {
      console.error(err);
      btn.disabled = false;
      msg.textContent = I18N.t("upload_error");
      msg.className = "form-msg error";
      return;
    }
  }

  const token = crypto.randomUUID();
  const { data, error } = await supabaseClient
    .from("shipment_comments")
    .insert({ shipment_id: shipmentId, author: currentAuthor, body, edit_token: token, ...attachment })
    .select("id,shipment_id,author,body,created_at,attachment_path,attachment_name")
    .single();

  btn.disabled = false;

  if (error) {
    console.error(error);
    msg.textContent = I18N.t("post_error");
    msg.className = "form-msg error";
    return;
  }

  if (data) {
    if (!commentsCache[shipmentId]) commentsCache[shipmentId] = [];
    if (!commentsCache[shipmentId].some((c) => c.id === data.id)) {
      commentsCache[shipmentId].push(data);
      saveMyShipToken(data.id, token);
      markShipmentSeen(shipmentId, data.created_at);
      bumpCommentBadge(shipmentId, data.created_at);
    }
    refreshDetailContent(shipmentId);
  }

  msg.textContent = "";
  bodyInput.value = "";
  clearShipmentAttachment(shipmentId);
}

async function deleteShipmentComment(shipmentId, commentId) {
  const token = getMyShipTokens()[commentId];
  if (!token) return;
  if (!window.confirm(I18N.t("delete_confirm"))) return;

  const { data, error } = await supabaseClient.rpc("delete_own_shipment_comment", {
    p_comment_id: commentId,
    p_token: token,
  });

  if (error || !data) {
    console.error(error);
    window.alert(I18N.t("delete_error"));
    return;
  }

  commentsCache[shipmentId] = (commentsCache[shipmentId] || []).filter((c) => c.id !== commentId);
  forgetMyShipToken(commentId);
  bumpCommentBadge(shipmentId, null, -1);
  refreshDetailContent(shipmentId);
}

function refreshDetailContent(shipmentId) {
  const row = document.getElementById(`detail-${cssEscape(shipmentId)}`);
  if (!row) return;
  const s = allShipments.find((r) => r.id === shipmentId);
  if (editingIds.has(shipmentId)) {
    // 編輯追蹤欄位中時，留言相關的更新（貼文字／即時推播收到新留言）只重繪
    // 留言清單，不要整塊重繪，否則會把使用者還沒送出的編輯表單內容蓋掉。
    const list = document.getElementById(`commentList-${cssEscape(shipmentId)}`);
    if (list) list.innerHTML = renderCommentsListHtml(s);
    return;
  }
  row.querySelector("td").innerHTML = renderDetailContent(s);
  I18N.applyTo(row);
}

function enterShipmentEditMode(shipmentId) {
  editingIds.add(shipmentId);
  const row = document.getElementById(`detail-${cssEscape(shipmentId)}`);
  const s = allShipments.find((r) => r.id === shipmentId);
  if (row && s) {
    row.querySelector("td").innerHTML = renderDetailContent(s);
    I18N.applyTo(row);
  }
}

function exitShipmentEditMode(shipmentId) {
  editingIds.delete(shipmentId);
  const row = document.getElementById(`detail-${cssEscape(shipmentId)}`);
  const s = allShipments.find((r) => r.id === shipmentId);
  if (row && s) {
    row.querySelector("td").innerHTML = renderDetailContent(s);
    I18N.applyTo(row);
  }
}

function refreshShipmentRow(shipmentId) {
  const s = allShipments.find((r) => r.id === shipmentId);
  const row = document.querySelector(`.ship-row[data-id="${cssId(shipmentId)}"]`);
  if (!row || !s) return;
  row.outerHTML = renderShipmentRow(s);
}

async function saveShipmentEdits(shipmentId) {
  const form = document.querySelector(`.ship-edit-form[data-ship-id="${cssId(shipmentId)}"]`);
  if (!form) return;
  const msg = document.getElementById(`editMsg-${cssEscape(shipmentId)}`);
  const saveBtn = form.querySelector(".ship-save-btn");

  const payload = { updated_by: currentAuthor };
  form.querySelectorAll("[data-field]").forEach((el) => {
    const raw = el.value.trim();
    payload[el.dataset.field] = raw === "" ? null : (el.type === "number" ? Number(raw) : raw);
  });

  saveBtn.disabled = true;
  msg.textContent = I18N.t("ship_saving");
  msg.className = "form-msg";

  const { data, error } = await supabaseClient
    .from("shipments")
    .update(payload)
    .eq("id", shipmentId)
    .select()
    .single();

  saveBtn.disabled = false;

  if (error) {
    console.error(error);
    msg.textContent = I18N.t("ship_save_error");
    msg.className = "form-msg error";
    return;
  }

  const idx = allShipments.findIndex((r) => r.id === shipmentId);
  if (idx >= 0) allShipments[idx] = { ...allShipments[idx], ...data };
  editingIds.delete(shipmentId);
  refreshShipmentRow(shipmentId);
  const row = document.getElementById(`detail-${cssEscape(shipmentId)}`);
  const s = allShipments.find((r) => r.id === shipmentId);
  if (row && s) {
    row.querySelector("td").innerHTML = renderDetailContent(s);
    I18N.applyTo(row);
  }
}

async function createShipment() {
  const form = document.getElementById("newOrderForm");
  const msg = document.getElementById("newOrderMsg");
  const submitBtn = form.querySelector('button[type="submit"]');

  const orderNo = document.getElementById("newOrderNo").value.trim();
  const lineNo = document.getElementById("newLineNo").value.trim();
  if (!orderNo || !lineNo) {
    msg.textContent = I18N.t("new_order_required_error");
    msg.className = "form-msg error";
    return;
  }

  const qtyRaw = document.getElementById("newOrderQty").value.trim();
  const payload = {
    id: `${orderNo}_${lineNo}`,
    customer: document.getElementById("newCustomer").value.trim() || null,
    part_no: document.getElementById("newPartNo").value.trim() || null,
    order_no: orderNo,
    line_no: lineNo,
    order_qty: qtyRaw === "" ? null : Number(qtyRaw),
    delivery_type: document.getElementById("newDeliveryType").value.trim() || null,
    order_due_date: document.getElementById("newOrderDueDate").value || null,
  };

  submitBtn.disabled = true;
  msg.textContent = I18N.t("posting");
  msg.className = "form-msg";

  const { data, error } = await supabaseClient
    .from("shipments")
    .insert(payload)
    .select()
    .single();

  submitBtn.disabled = false;

  if (error) {
    console.error(error);
    msg.textContent = error.code === "23505" ? I18N.t("new_order_duplicate_error") : I18N.t("new_order_error");
    msg.className = "form-msg error";
    return;
  }

  allShipments.push(data);
  form.reset();
  msg.textContent = I18N.t("new_order_success");
  msg.className = "form-msg";
  document.getElementById("newOrderDetails").open = false;
  applyFilter();
}

function bumpCommentBadge(shipmentId, lastCommentAt, delta = 1) {
  const s = allShipments.find((r) => r.id === shipmentId);
  if (!s) return;
  s.comment_count = Math.max(0, (s.comment_count || 0) + delta);
  if (lastCommentAt) s.last_comment_at = lastCommentAt;
  const summaryRow = document.querySelector(`.ship-row[data-id="${cssId(shipmentId)}"]`);
  const badgeCell = summaryRow && summaryRow.querySelector(".ship-comment-cell");
  if (badgeCell) badgeCell.innerHTML = renderCommentBadge(s);
}

function subscribeShipment(shipmentId) {
  if (activeChannels[shipmentId]) return;
  const channel = supabaseClient
    .channel(`shipment-comments-${shipmentId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "shipment_comments", filter: `shipment_id=eq.${shipmentId}` },
      (payload) => {
        if (!commentsCache[shipmentId]) commentsCache[shipmentId] = [];
        if (commentsCache[shipmentId].some((c) => c.id === payload.new.id)) return;
        const { edit_token, ...comment } = payload.new;
        commentsCache[shipmentId].push(comment);
        markShipmentSeen(shipmentId, comment.created_at);
        bumpCommentBadge(shipmentId, comment.created_at);
        refreshDetailContent(shipmentId);
      }
    )
    .subscribe();
  activeChannels[shipmentId] = channel;
}

function unsubscribeShipment(shipmentId) {
  const channel = activeChannels[shipmentId];
  if (channel) {
    supabaseClient.removeChannel(channel);
    delete activeChannels[shipmentId];
  }
}

function applyFilter() {
  const q = document.getElementById("search").value.trim().toLowerCase();
  if (!q) {
    renderShipmentTable(allShipments);
    return;
  }
  const filtered = allShipments.filter((s) => {
    const haystack = [s.customer, s.part_no, s.order_no, s.line_no]
      .map((v) => (v || "").toString().toLowerCase())
      .join(" ");
    return haystack.includes(q);
  });
  renderShipmentTable(filtered);
}

async function loadShipments() {
  const session = await requireLogin();
  if (!session) return;
  currentAuthor = accountLabel(session);

  const wrap = document.getElementById("shipmentTableWrap");
  wrap.innerHTML = `<div class="empty-state">${I18N.t("loading")}</div>`;

  const [{ data: shipments, error: shipErr }, { data: schedule, error: schedErr }] = await Promise.all([
    supabaseClient
      .from("shipments_with_comment_stats")
      .select("*")
      .order("row_order", { ascending: true }),
    supabaseClient
      .from("sailing_schedule")
      .select("*")
      .order("seq_no", { ascending: true }),
  ]);

  if (shipErr) {
    wrap.innerHTML = `<div class="empty-state">${escapeHtml(shipErr.message)}</div>`;
    return;
  }
  if (schedErr) console.error(schedErr);

  allShipments = shipments || [];
  scheduleRows = schedule || [];
  renderScheduleTable();
  applyFilter();
}

document.getElementById("search").addEventListener("input", applyFilter);
window.onI18nApply = () => {
  renderScheduleTable();
  applyFilter();
};

loadShipments();
