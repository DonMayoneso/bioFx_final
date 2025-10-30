// utils/snackbar.js
(function(){
  function ensureHost(){
    let host = document.getElementById("snackbar-host");
    if(!host){
      host = document.createElement("div");
      host.id = "snackbar-host";
      document.body.appendChild(host);
    }
    return host;
  }

  let timer = null;

  function show(text, {type="success", ms=2400} = {}){
    const host = ensureHost();
    let el = host.querySelector(".snackbar");
    if(!el){
      el = document.createElement("div");
      el.className = "snackbar";
      host.appendChild(el);
    }
    el.classList.remove("success","error","show");
    el.textContent = text || "";
    el.classList.add(type === "error" ? "error" : "success");
    el.offsetHeight;
    el.classList.add("show");
    clearTimeout(timer);
    timer = setTimeout(()=> el.classList.remove("show"), ms);
  }

  function success(text, ms){ show(text, {type:"success", ms}); }
  function error(text, ms){ show(text, {type:"error", ms}); }

  window.Snackbar = { show, success, error };
})();
