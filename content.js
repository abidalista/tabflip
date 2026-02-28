// TabFlip — content script: overlay UI + keyboard handling

(() => {
  console.log("[TabFlip] Content script loaded on", location.href);

  // ── State ──────────────────────────────────────────────────────────
  let overlayEl = null;
  let tabs = [];
  let selectedIndex = 0;
  let altHeld = false;
  let overlayVisible = false;
  let qCount = 0;
  let switchTimer = null;

  const SWITCH_DELAY = 200;

  // ── Helpers ────────────────────────────────────────────────────────

  function extractDomain(url) {
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, "");
    } catch (_) {
      return "";
    }
  }

  // ── Build overlay DOM ──────────────────────────────────────────────

  function ensureOverlay() {
    if (overlayEl && document.contains(overlayEl)) return;

    overlayEl = document.createElement("div");
    overlayEl.id = "tabflip-overlay";
    overlayEl.innerHTML = '<div id="tabflip-container"><div id="tabflip-cards"></div></div>';

    const target = document.body || document.documentElement;
    target.appendChild(overlayEl);
    console.log("[TabFlip] Overlay injected into DOM");
  }

  function renderCards() {
    ensureOverlay();
    const container = overlayEl.querySelector("#tabflip-cards");
    container.innerHTML = "";

    tabs.forEach((tab, i) => {
      const isSelected = i === selectedIndex;
      const card = document.createElement("div");
      card.className = "tabflip-card" + (isSelected ? " tabflip-card--selected" : "");

      // Screenshot wrapper (holds gradient border for selected)
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
        const placeholder = document.createElement("div");
        placeholder.className = "tabflip-card__placeholder";
        placeholder.textContent = tab.title ? tab.title.charAt(0).toUpperCase() : "?";
        screenshotEl.appendChild(placeholder);
      }

      screenshotWrap.appendChild(screenshotEl);

      // Meta row
      const meta = document.createElement("div");
      meta.className = "tabflip-card__meta";

      const faviconWrap = document.createElement("div");
      faviconWrap.className = "tabflip-card__favicon-wrap";

      if (tab.favIconUrl) {
        const favicon = document.createElement("img");
        favicon.className = "tabflip-card__favicon";
        favicon.src = tab.favIconUrl;
        favicon.width = 14;
        favicon.height = 14;
        favicon.onerror = function () {
          this.replaceWith(createLetterFavicon(tab.title));
        };
        faviconWrap.appendChild(favicon);
      } else {
        faviconWrap.appendChild(createLetterFavicon(tab.title));
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

  function createLetterFavicon(tabTitle) {
    const span = document.createElement("span");
    span.className = "tabflip-card__favicon-letter";
    span.textContent = tabTitle ? tabTitle.charAt(0).toUpperCase() : "?";
    return span;
  }

  function showOverlay() {
    ensureOverlay();
    overlayEl.classList.add("tabflip-overlay--visible");
    overlayVisible = true;
    renderCards();
    console.log("[TabFlip] Overlay shown with", tabs.length, "tabs, selected:", selectedIndex);
  }

  function hideOverlay() {
    if (overlayEl) {
      overlayEl.classList.remove("tabflip-overlay--visible");
    }
    overlayVisible = false;
    qCount = 0;
    if (switchTimer) {
      clearTimeout(switchTimer);
      switchTimer = null;
    }
  }

  function moveSelection(delta) {
    if (tabs.length === 0) return;
    selectedIndex = (selectedIndex + delta + tabs.length) % tabs.length;
    renderCards();
  }

  function commitSwitch() {
    if (tabs.length === 0 || selectedIndex < 0 || selectedIndex >= tabs.length) {
      hideOverlay();
      return;
    }
    const tab = tabs[selectedIndex];
    console.log("[TabFlip] Switching to tab:", tab.id, tab.title);
    chrome.runtime.sendMessage({ type: "switchTab", tabId: tab.id });
    hideOverlay();
  }

  async function fetchMRU() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "getMRU" });
      console.log("[TabFlip] MRU response:", response);
      if (response && response.tabs) {
        tabs = response.tabs;
      }
    } catch (err) {
      console.error("[TabFlip] Failed to fetch MRU:", err);
      tabs = [];
    }
  }

  // ── Keyboard handling ──────────────────────────────────────────────
  // We listen on the document with capture=true so we fire before
  // any page scripts can swallow the event.

  document.addEventListener("keydown", async (e) => {
    // Track alt/option key
    if (e.key === "Alt") {
      altHeld = true;
      return;
    }

    // Esc closes overlay
    if (e.key === "Escape" && overlayVisible) {
      e.preventDefault();
      e.stopPropagation();
      hideOverlay();
      altHeld = false;
      return;
    }

    // Q while alt/option is held
    // e.code === "KeyQ" is the physical key (works regardless of Option producing œ)
    // e.altKey is true if alt/option is currently pressed (backup for altHeld)
    if (e.code === "KeyQ" && (altHeld || e.altKey)) {
      e.preventDefault(); // prevent œ on Mac
      e.stopPropagation();
      console.log("[TabFlip] Alt+Q detected, overlayVisible:", overlayVisible, "altHeld:", altHeld, "e.altKey:", e.altKey);

      if (!overlayVisible) {
        await fetchMRU();
        if (tabs.length < 2) {
          console.log("[TabFlip] Not enough tabs:", tabs.length);
          return;
        }

        qCount = 1;
        selectedIndex = e.shiftKey ? tabs.length - 1 : 1;
        showOverlay();

        switchTimer = setTimeout(() => {
          switchTimer = null;
        }, SWITCH_DELAY);
      } else {
        qCount++;
        if (e.shiftKey) {
          moveSelection(-1);
        } else {
          moveSelection(1);
        }
      }
    }
  }, true);

  document.addEventListener("keyup", (e) => {
    if (e.key === "Alt") {
      altHeld = false;
      if (overlayVisible) {
        console.log("[TabFlip] Alt released — committing switch");
        commitSwitch();
      }
    }
  }, true);

  // Window blur: close overlay and reset state
  window.addEventListener("blur", () => {
    if (overlayVisible) {
      hideOverlay();
    }
    altHeld = false;
  });

  // ── Message listener (for test trigger from popup/background) ──────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "triggerOverlay") {
      console.log("[TabFlip] Trigger received from background");
      (async () => {
        await fetchMRU();
        if (tabs.length < 1) {
          console.log("[TabFlip] No tabs in MRU");
          return;
        }
        selectedIndex = Math.min(1, tabs.length - 1);
        showOverlay();
        // Auto-close after 5s if no keyboard interaction (it's a test)
        setTimeout(() => {
          if (overlayVisible) hideOverlay();
        }, 5000);
      })();
    }
  });
})();
