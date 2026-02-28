// TabFlip — content script: overlay UI + keyboard handling

// Guard against double injection (manifest content_scripts + scripting.executeScript)
if (!window.__tabflip_loaded) {
  window.__tabflip_loaded = true;

  (() => {
    let overlayEl = null;
    let tabs = [];
    let selectedIndex = 0;
    let overlayVisible = false;
    let qCount = 0;
    let switchTimer = null;

    const SWITCH_DELAY = 200;

    function extractDomain(url) {
      try { return new URL(url).hostname.replace(/^www\./, ""); }
      catch (_) { return ""; }
    }

    // ── Overlay DOM ────────────────────────────────────────────────────

    function ensureOverlay() {
      if (overlayEl && document.contains(overlayEl)) return;
      overlayEl = document.createElement("div");
      overlayEl.id = "tabflip-overlay";
      overlayEl.innerHTML = '<div id="tabflip-container"><div id="tabflip-cards"></div></div>';
      (document.body || document.documentElement).appendChild(overlayEl);
    }

    function renderCards() {
      ensureOverlay();
      const container = overlayEl.querySelector("#tabflip-cards");
      container.innerHTML = "";

      tabs.forEach((tab, i) => {
        const card = document.createElement("div");
        card.className = "tabflip-card" + (i === selectedIndex ? " tabflip-card--selected" : "");

        const screenshotWrap = document.createElement("div");
        screenshotWrap.className = "tabflip-card__screenshot-wrap";

        const screenshotEl = document.createElement("div");
        screenshotEl.className = "tabflip-card__screenshot";

        if (tab.screenshot) {
          const img = document.createElement("img");
          img.src = tab.screenshot;
          img.draggable = false;
          screenshotEl.appendChild(img);
        } else {
          screenshotEl.classList.add("tabflip-card__screenshot--empty");
          const ph = document.createElement("div");
          ph.className = "tabflip-card__placeholder";
          ph.textContent = tab.title ? tab.title.charAt(0).toUpperCase() : "?";
          screenshotEl.appendChild(ph);
        }
        screenshotWrap.appendChild(screenshotEl);

        const meta = document.createElement("div");
        meta.className = "tabflip-card__meta";

        const faviconWrap = document.createElement("div");
        faviconWrap.className = "tabflip-card__favicon-wrap";

        if (tab.favIconUrl) {
          const fav = document.createElement("img");
          fav.className = "tabflip-card__favicon";
          fav.src = tab.favIconUrl;
          fav.width = 14;
          fav.height = 14;
          fav.onerror = function () { this.replaceWith(letterIcon(tab.title)); };
          faviconWrap.appendChild(fav);
        } else {
          faviconWrap.appendChild(letterIcon(tab.title));
        }

        const textCol = document.createElement("div");
        textCol.className = "tabflip-card__text";

        const title = document.createElement("span");
        title.className = "tabflip-card__title";
        title.textContent = tab.title || "Untitled";

        const url = document.createElement("span");
        url.className = "tabflip-card__url";
        url.textContent = extractDomain(tab.url);

        textCol.appendChild(title);
        textCol.appendChild(url);
        meta.appendChild(faviconWrap);
        meta.appendChild(textCol);
        card.appendChild(screenshotWrap);
        card.appendChild(meta);
        container.appendChild(card);
      });
    }

    function letterIcon(t) {
      const s = document.createElement("span");
      s.className = "tabflip-card__favicon-letter";
      s.textContent = t ? t.charAt(0).toUpperCase() : "?";
      return s;
    }

    function showOverlay() {
      ensureOverlay();
      overlayEl.classList.add("tabflip-overlay--visible");
      overlayVisible = true;
      renderCards();
    }

    function hideOverlay() {
      if (overlayEl) overlayEl.classList.remove("tabflip-overlay--visible");
      overlayVisible = false;
      qCount = 0;
      if (switchTimer) { clearTimeout(switchTimer); switchTimer = null; }
    }

    function moveSelection(delta) {
      if (!tabs.length) return;
      selectedIndex = (selectedIndex + delta + tabs.length) % tabs.length;
      renderCards();
    }

    function commitSwitch() {
      if (!tabs.length || selectedIndex < 0 || selectedIndex >= tabs.length) {
        hideOverlay();
        return;
      }
      chrome.runtime.sendMessage({ type: "switchTab", tabId: tabs[selectedIndex].id });
      hideOverlay();
    }

    async function fetchMRU() {
      try {
        const r = await chrome.runtime.sendMessage({ type: "getMRU" });
        if (r && r.tabs) tabs = r.tabs;
      } catch (_) { tabs = []; }
    }

    // ── Keyboard ───────────────────────────────────────────────────────
    // Do NOT track altHeld manually — just read e.altKey on every event.
    // This avoids desyncs from missed keydown/keyup when the page isn't focused.

    document.addEventListener("keydown", async (e) => {
      if (e.key === "Escape" && overlayVisible) {
        e.preventDefault();
        e.stopPropagation();
        hideOverlay();
        return;
      }

      // Option/Alt + Q (e.code is physical key — immune to œ on Mac)
      if (e.code === "KeyQ" && e.altKey) {
        e.preventDefault();
        e.stopPropagation();

        if (!overlayVisible) {
          await fetchMRU();
          if (tabs.length < 2) return;
          qCount = 1;
          selectedIndex = e.shiftKey ? tabs.length - 1 : 1;
          showOverlay();
          switchTimer = setTimeout(() => { switchTimer = null; }, SWITCH_DELAY);
        } else {
          qCount++;
          moveSelection(e.shiftKey ? -1 : 1);
        }
      }
    }, true);

    document.addEventListener("keyup", (e) => {
      // Alt/Option released
      if (e.key === "Alt" && overlayVisible) {
        commitSwitch();
      }
    }, true);

    window.addEventListener("blur", () => {
      if (overlayVisible) hideOverlay();
    });

    // ── Message listener (test trigger from popup) ────────────────────
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === "triggerOverlay") {
        (async () => {
          await fetchMRU();
          if (tabs.length < 1) return;
          selectedIndex = Math.min(1, tabs.length - 1);
          showOverlay();
          setTimeout(() => { if (overlayVisible) hideOverlay(); }, 5000);
        })();
      }
    });
  })();
}
