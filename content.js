// TabFlip — content script (overlay on page)

(() => {
  // Clean up from previous injection
  const old = document.getElementById("tabflip-overlay");
  if (old) old.remove();

  let overlayEl = null;
  let tabs = [];
  let selectedIndex = 0;
  let overlayVisible = false;

  // ── DOM ──────────────────────────────────────────────────────────────

  function createOverlay() {
    overlayEl = document.createElement("div");
    overlayEl.id = "tabflip-overlay";
    overlayEl.innerHTML = '<div id="tabflip-container"><div id="tabflip-cards"></div></div>';
    (document.body || document.documentElement).appendChild(overlayEl);
  }

  function showSwitcher(tabData) {
    tabs = tabData;
    selectedIndex = 1;
    if (!overlayEl) createOverlay();
    renderCards();
    overlayEl.offsetHeight;
    overlayEl.classList.add("tabflip-overlay--visible");
    overlayVisible = true;
  }

  function hideSwitcher(notify) {
    if (overlayEl) overlayEl.classList.remove("tabflip-overlay--visible");
    overlayVisible = false;
    if (notify) {
      try { chrome.runtime.sendMessage({ type: "switcherClosed" }); } catch (_) {}
    }
  }

  function cycleForward() {
    if (!overlayVisible || tabs.length < 2) return;
    selectedIndex = (selectedIndex + 1) % tabs.length;
    renderCards();
  }

  function switchToSelected() {
    if (selectedIndex >= 0 && selectedIndex < tabs.length) {
      try { chrome.runtime.sendMessage({ type: "switchTab", tabId: tabs[selectedIndex].id }); } catch (_) {}
    }
    hideSwitcher(false);
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

  // ── Messages from background ───────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "showSwitcher" && msg.tabs) {
      showSwitcher(msg.tabs);
      sendResponse({ ok: true });
    }
    if (msg.type === "cycle") {
      cycleForward();
      sendResponse({ ok: true });
    }
    if (msg.type === "ping") {
      sendResponse({ ok: true });
    }
  });

  // ── Keyboard: Ctrl release = switch, Escape = cancel ──────────────

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
      hideSwitcher(true);
    }
    if ((e.ctrlKey || e.metaKey) && (e.code === "KeyQ" || e.key === "q")) {
      e.preventDefault();
    }
  }, true);

  // NO blur handler — it was killing the overlay
})();
