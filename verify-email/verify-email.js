// /verify-email/verify-email.js
(function () {
  const params = new URLSearchParams(window.location.search);
  const status = (params.get("status") || "").toLowerCase();
  const email = params.get("email") || "";

  const classMap = { ok: "state-ok", invalid: "state-invalid", error: "state-error" };
  const cls = classMap[status] || "state-invalid"; 
  document.body.classList.add(cls);

  function setEmail(id) {
    if (!email) return; 
    const el = document.getElementById(id);
    if (el) {
      el.textContent = email;
      el.classList.remove("email-hide");
    }
  }

  if (cls === "state-ok") setEmail("okEmail");
  if (cls === "state-invalid") setEmail("invalidEmail");
})();
