const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allItems = [];

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
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
      <div class="card-meta">${escapeHtml(item.part_name || "")}</div>
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
