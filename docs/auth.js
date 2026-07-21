// 共通のログインガード。index.html / item.html で config.js の直後、
// app.js / item.js より前に読み込む。
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ログインアカウント（共有アカウント）と、コメント投稿時の身分表記の対応。
// アカウントを追加/変更したら、ここも合わせて更新すること。
const ACCOUNT_LABELS = {
  "honsha@ikankensa.local": "日本早川",
  "taiwan@ikankensa.local": "台湾早川",
  "meikan@ikankensa.local": "銘環",
};

function accountLabel(session) {
  const email = session && session.user && session.user.email;
  return ACCOUNT_LABELS[email] || email || "";
}

async function requireLogin() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    const here = window.location.pathname.split("/").pop() + window.location.search;
    window.location.replace(`login.html?redirect=${encodeURIComponent(here)}`);
    return null;
  }
  return session;
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.replace("login.html");
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-logout]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  });
});
