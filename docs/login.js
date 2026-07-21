const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function redirectTarget() {
  const params = new URLSearchParams(window.location.search);
  return params.get("redirect") || "index.html";
}

async function doLogin() {
  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value;
  const msg = document.getElementById("loginMsg");
  const btn = document.getElementById("loginBtn");

  if (!email || !password) {
    msg.textContent = I18N.t("login_empty_error");
    msg.className = "form-msg error";
    return;
  }

  btn.disabled = true;
  msg.textContent = "";
  msg.className = "form-msg";

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  btn.disabled = false;

  if (error) {
    msg.textContent = I18N.t("login_error");
    msg.className = "form-msg error";
    return;
  }

  window.location.replace(redirectTarget());
}

document.getElementById("passwordInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doLogin();
});

(async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) window.location.replace(redirectTarget());
})();
