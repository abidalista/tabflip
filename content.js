// TabFlip — content script

(() => {
  // Clean up overlay from previous injection (extension reload)
  const old = document.getElementById("tabflip-overlay");
  if (old) old.remove();
  const oldDebug = document.getElementById("tabflip-debug");
  if (oldDebug) oldDebug.remove();

  let overlayEl = null;
  let tabs = [];
  let selectedIndex = 0;
  let overlayVisible = false;

  // ── DEBUG: visible toast on page ───────────────────────────────────

  function debugToast(msg) {
    let box = document.getElementById("tabflip-debug");
    if (!box) {
      box = document.createElement("div");
      box.id = "tabflip-debug";
      box.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:2147483647;background:#1a1a1a;color:#0f0;font:13px/1.5 monospace;padding:12px 16px;border-radius:8px;border:1px solid #333;max-width:400px;pointer-events:none;";
      document.documentElement.appendChild(box);
    }
    const line = document.createElement("div");
    line.textContent = "[TabFlip] " + msg;
    box.appendChild(line);
    // Auto-hide after 10s
    clearTimeout(box._timer);
    box._timer = setTimeout(() => box.remove(), 10000);
  }

  debugToast("content script loaded OK");

  // ── DOM ──────────────────────────────────────────────────────────────

  function createOverlay() {
    overlayEl = document.createElement("div");
    overlayEl.id = "tabflip-overlay";
    overlayEl.innerHTML = '<div id="tabflip-container"><div id="tabflip-cards"></div></div>';
    document.documentElement.appendChild(overlayEl);
    debugToast("overlay DOM created");
  }

  function showSwitcher(tabData) {
    tabs = tabData;
    selectedIndex = 1;
    if (!overlayEl) createOverlay();
    renderCards();
    overlayEl.offsetHeight; // force reflow
    overlayEl.classList.add("tabflip-overlay--visible");
    overlayVisible = true;
    debugToast("overlay shown with " + tabs.length + " tabs");
  }

  function hideSwitcher() {
    if (overlayEl) overlayEl.classList.remove("tabflip-overlay--visible");
    overlayVisible = false;
  }

  function cycleForward() {
    selectedIndex = (selectedIndex + 1) % tabs.length;
    renderCards();
    debugToast("cycled to index " + selectedIndex);
  }

  function switchToSelected() {
    if (selectedIndex >= 0 && selectedIndex < tabs.length) {
      debugToast("switching to: " + tabs[selectedIndex].title);
      chrome.runtime.sendMessage({ type: "switchTab", tabId: tabs[selectedIndex].id });
    }
    hideSwitcher();
  }

  function renderCards() {
    if (!overlayEl) createOverlay();
    const container = overlayEl.querySelector("#tabflip-cards");
    container.innerHTML = "";

    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      const selected = i === selectedIndex;

      const card = document.createElement("div");
      card.className = "tabflip-card" + (selected ? " tabflip-card--selected" : "");

      const wrap = document.createElement("div");
      wrap.className = "tabflip-card__screenshot-wrap";
      const shot = document.createElement("div");
      shot.className = "tabflip-card__screenshot";

      if (tab.screenshot) {
        const img = document.createElement("img");
        img.src = tab.screenshot;
        img.alt = tab.title || "";
        img.draggable = false;
        shot.appendChild(img);
      } else {
        shot.classList.add("tabflip-card__screenshot--empty");
        const ph = document.createElement("div");
        ph.className = "tabflip-card__placeholder";
        ph.textContent = (tab.title || "?").charAt(0).toUpperCase();
        shot.appendChild(ph);
      }
      wrap.appendChild(shot);

      const meta = document.createElement("div");
      meta.className = "tabflip-card__meta";

      const fwrap = document.createElement("div");
      fwrap.className = "tabflip-card__favicon-wrap";
      if (tab.favIconUrl) {
        const fi = document.createElement("img");
        fi.className = "tabflip-card__favicon";
        fi.src = tab.favIconUrl;
        fi.width = 14;
        fi.height = 14;
        fi.onerror = function () {
          const s = document.createElement("span");
          s.className = "tabflip-card__favicon-letter";
          s.textContent = (tab.title || "?").charAt(0).toUpperCase();
          this.replaceWith(s);
        };
        fwrap.appendChild(fi);
      } else {
        const s = document.createElement("span");
        s.className = "tabflip-card__favicon-letter";
        s.textContent = (tab.title || "?").charAt(0).toUpperCase();
        fwrap.appendChild(s);
      }

      const text = document.createElement("div");
      text.className = "tabflip-card__text";
      const t = document.createElement("span");
      t.className = "tabflip-card__title";
      t.textContent = tab.title || "Untitled";
      const u = document.createElement("span");
      u.className = "tabflip-card__url";
      try { u.textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (_) { u.textContent = ""; }

      text.appendChild(t);
      text.appendChild(u);
      meta.appendChild(fwrap);
      meta.appendChild(text);
      card.appendChild(wrap);
      card.appendChild(meta);
      container.appendChild(card);
    }
  }

  // ── Messages from background.js ────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    debugToast("message received: " + msg.type);
    if (msg.type === "toggleSwitcher" && msg.tabs) {
      debugToast("got " + msg.tabs.length + " tabs");
      if (!overlayVisible) {
        showSwitcher(msg.tabs);
      } else {
        cycleForward();
      }
      sendResponse({ ok: true });
    }
    if (msg.type === "ping") {
      sendResponse({ ok: true });
    }
  });

  // ── Keyboard: Ctrl/Cmd release = switch, Escape = cancel ──────────

  document.addEventListener("keyup", (e) => {
    if (!overlayVisible) return;
    if (e.key === "Control" || e.key === "Meta") {
      e.preventDefault();
      switchToSelected();
    }
  }, true);

  document.addEventListener("keydown", (e) => {
    if (!overlayVisible) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      hideSwitcher();
    }
    if ((e.ctrlKey || e.metaKey) && (e.code === "KeyQ" || e.key === "q")) {
      e.preventDefault();
    }
  }, true);

  window.addEventListener("blur", () => {
    if (overlayVisible) hideSwitcher();
  });
})();
