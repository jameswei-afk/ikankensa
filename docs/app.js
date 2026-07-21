const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  const list = document.getElementById("list");
  list.innerHTML = `<div class="empty-state">${I18N.t("loading")}</div>`;

  const { data, error } = await supabaseClient
    .from("items")
    .select("id,customer,maker,part_no,part_name,meikan_note,updated_at")
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
