// TabFlip — content script
// No guard. Each injection gets fresh listeners with a valid chrome.runtime.
// Old dead listeners from previous extension contexts will throw and do nothing.

(() => {
  // Remove any leftover overlay from a previous injection
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
    document.body.appendChild(overlayEl);
    console.log("[TabFlip] overlay element created");
  }

  function showOverlay() {
    if (!overlayEl) createOverlay();
    renderCards();
    overlayEl.classList.add("tabflip-overlay--visible");
    overlayVisible = true;
    console.log("[TabFlip] overlay shown, tabs:", tabs.length, "selected:", selectedIndex);
  }

  function hideOverlay() {
    if (overlayEl) overlayEl.classList.remove("tabflip-overlay--visible");
    overlayVisible = false;
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

      // Screenshot
      const wrap = document.createElement("div");
      wrap.className = "tabflip-card__screenshot-wrap";
      const shot = document.createElement("div");
      shot.className = "tabflip-card__screenshot";

      if (tab.screenshot) {
        const img = document.createElement("img");
        img.src = tab.screenshot;
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

      // Meta
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

  // ── Messaging ────────────────────────────────────────────────────────

  async function getMRU() {
    try {
      const res = await chrome.runtime.sendMessage({ type: "getMRU" });
      console.log("[TabFlip] getMRU response:", res);
      tabs = (res && res.tabs) ? res.tabs : [];
    } catch (err) {
      console.error("[TabFlip] getMRU failed:", err.message);
      tabs = [];
    }
  }

  function switchToSelected() {
    if (selectedIndex >= 0 && selectedIndex < tabs.length) {
      console.log("[TabFlip] switching to tab", tabs[selectedIndex].id);
      chrome.runtime.sendMessage({ type: "switchTab", tabId: tabs[selectedIndex].id });
    }
    hideOverlay();
  }

  // ── Keyboard ─────────────────────────────────────────────────────────

  document.addEventListener("keydown", async (e) => {
    // Escape: close overlay, do nothing
    if (e.key === "Escape" && overlayVisible) {
      e.preventDefault();
      e.stopPropagation();
      hideOverlay();
      return;
    }

    // Alt/Option + Q
    if (e.altKey && (e.code === "KeyQ" || e.key === "q" || e.key === "Q")) {
      e.preventDefault();  // stops œ on Mac
      e.stopPropagation();
      console.log("[TabFlip] Alt+Q keydown, overlayVisible:", overlayVisible);

      if (!overlayVisible) {
        // First press: fetch MRU, show overlay
        await getMRU();
        if (tabs.length < 2) {
          console.log("[TabFlip] <2 tabs, nothing to show");
          return;
        }
        selectedIndex = e.shiftKey ? tabs.length - 1 : 1;
        showOverlay();
      } else {
        // Subsequent presses: advance selection
        const delta = e.shiftKey ? -1 : 1;
        selectedIndex = (selectedIndex + delta + tabs.length) % tabs.length;
        renderCards();
      }
    }
  }, true);

  // Alt/Option release: commit the switch
  document.addEventListener("keyup", (e) => {
    if (e.key === "Alt" && overlayVisible) {
      console.log("[TabFlip] Alt released, committing switch");
      switchToSelected();
    }
  }, true);

  window.addEventListener("blur", () => {
    if (overlayVisible) hideOverlay();
  });

  // Listen for trigger from background (test button / command)
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "showOverlay") {
      (async () => {
        await getMRU();
        if (tabs.length < 1) return;
        selectedIndex = Math.min(1, tabs.length - 1);
        showOverlay();
      })();
    }
  });

  console.log("[TabFlip] content script ready on", location.hostname);
})();
