// TabFlip — switcher popup window logic

let tabs = [];
let selectedIndex = 1;

function render() {
  const container = document.getElementById("cards");
  container.innerHTML = "";

  tabs.forEach((tab, i) => {
    const card = document.createElement("div");
    card.className = "card" + (i === selectedIndex ? " selected" : "");
    card.onclick = () => { selectedIndex = i; switchTo(); };

    const swrap = document.createElement("div");
    swrap.className = "screenshot-wrap";
    const shot = document.createElement("div");
    shot.className = "screenshot" + (tab.screenshot ? "" : " empty");

    if (tab.screenshot) {
      const img = document.createElement("img");
      img.src = tab.screenshot;
      img.draggable = false;
      shot.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "placeholder";
      ph.textContent = (tab.title || "?").charAt(0).toUpperCase();
      shot.appendChild(ph);
    }
    swrap.appendChild(shot);

    const meta = document.createElement("div");
    meta.className = "meta";

    const fwrap = document.createElement("div");
    fwrap.className = "favicon-wrap";
    if (tab.favIconUrl) {
      const fi = document.createElement("img");
      fi.className = "favicon";
      fi.src = tab.favIconUrl;
      fi.onerror = function () {
        const s = document.createElement("span");
        s.className = "favicon-letter";
        s.textContent = (tab.title || "?").charAt(0).toUpperCase();
        this.replaceWith(s);
      };
      fwrap.appendChild(fi);
    } else {
      const s = document.createElement("span");
      s.className = "favicon-letter";
      s.textContent = (tab.title || "?").charAt(0).toUpperCase();
      fwrap.appendChild(s);
    }

    const text = document.createElement("div");
    text.className = "text";
    const t = document.createElement("span");
    t.className = "title";
    t.textContent = tab.title || "Untitled";
    const u = document.createElement("span");
    u.className = "url";
    try { u.textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (_) { u.textContent = ""; }

    text.appendChild(t);
    text.appendChild(u);
    meta.appendChild(fwrap);
    meta.appendChild(text);
    card.appendChild(swrap);
    card.appendChild(meta);
    container.appendChild(card);
  });
}

function switchTo() {
  if (selectedIndex >= 0 && selectedIndex < tabs.length) {
    chrome.runtime.sendMessage({ type: "switchTab", tabId: tabs[selectedIndex].id });
  }
  window.close();
}

function cycle() {
  selectedIndex = (selectedIndex + 1) % tabs.length;
  render();
}

// ── Keyboard ──────────────────────────────────────────────────────────

document.addEventListener("keyup", (e) => {
  if (e.key === "Control" || e.key === "Meta") {
    switchTo();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    window.close();
  }
  if ((e.ctrlKey || e.metaKey) && (e.code === "KeyQ" || e.key === "q")) {
    e.preventDefault();
    cycle();
  }
});

// ── Init: get tabs from background ───────────────────────────────────

chrome.runtime.sendMessage({ type: "getMRU" }, (res) => {
  if (res && res.tabs && res.tabs.length >= 2) {
    tabs = res.tabs;
    selectedIndex = 1;
    render();
  } else {
    window.close();
  }
});
