let allItems = [];

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

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(I18N.lang === "ja" ? "ja-JP" : "zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function renderActivity(item) {
  const count = item.comment_count || 0;
  if (count === 0) {
    return `<div class="card-activity muted">${I18N.t("no_comments_short")}</div>`;
  }
  const unseen = isItemUnseen(item.id, item.last_comment_at);
  return `
    <div class="card-activity${unseen ? " unseen" : ""}">
      ${unseen ? `<span class="new-dot"></span>` : ""}
      💬 ${count} ${I18N.t("item_count_comments")} ・ ${formatTime(item.last_comment_at)}
    </div>`;
}

function renderList(items) {
  const list = document.getElementById("list");
  const count = document.getElementById("itemCount");
  count.textContent = `${items.length} ${I18N.t("item_count")}`;

  if (items.length === 0) {
    list.innerHTML = `<div class="empty-state">${I18N.t("not_found")}</div>`;
    return;
  }

  list.innerHTML = items.map((item) => `
    <a class="card" href="item.html?id=${encodeURIComponent(item.id)}">
      <div class="card-top">
        <span class="badge">${escapeHtml(item.customer || "")}</span>
      </div>
      <div class="card-title">${escapeHtml(item.part_no || "")}</div>
      <div class="card-meta">${escapeHtml(displayPartName(item))}</div>
      ${renderActivity(item)}
    </a>
  `).join("");
}

function applyFilter() {
  const q = document.getElementById("search").value.trim().toLowerCase();
  if (!q) {
    renderList(allItems);
    return;
  }
  const filtered = allItems.filter((item) => {
    const haystack = [item.customer, item.part_no, item.part_name, item.meikan_note, item.id]
      .map((v) => (v || "").toString().toLowerCase())
      .join(" ");
    return haystack.includes(q);
  });
  renderList(filtered);
}

async function loadItems() {
  const session = await requireLogin();
  if (!session) return;

  const list = document.getElementById("list");
  list.innerHTML = `<div class="empty-state">${I18N.t("loading")}</div>`;

  const { data, error } = await supabaseClient
    .from("items_with_comment_stats")
    .select("id,customer,maker,part_no,part_name,meikan_note,updated_at,comment_count,last_comment_at")
    .order("last_comment_at", { ascending: false, nullsFirst: false })
    .order("customer", { ascending: true })
    .order("part_no", { ascending: true });

  if (error) {
    list.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    return;
  }

  allItems = data || [];
  applyFilter();
}

document.getElementById("search").addEventListener("input", applyFilter);
window.onI18nApply = () => applyFilter();

loadItems();
