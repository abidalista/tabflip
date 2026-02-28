// TabFlip — content script: overlay UI + keyboard handling

(() => {
  // ── State ──────────────────────────────────────────────────────────
  let overlayEl = null;
  let tabs = [];
  let selectedIndex = 0;
  let altHeld = false;
  let overlayVisible = false;
  let qCount = 0; // how many times Q pressed while alt held
  let switchTimer = null; // for quick tap detection

  const SWITCH_DELAY = 200; // ms — if alt released within this after first Q, it's a quick-tap

  // ── Build overlay DOM ──────────────────────────────────────────────

  function createOverlay() {
    if (overlayEl) return;

    overlayEl = document.createElement("div");
    overlayEl.id = "tabflip-overlay";
    overlayEl.innerHTML = `<div id="tabflip-container"><div id="tabflip-cards"></div></div>`;

    // Attach to documentElement to work even before body exists
    (document.body || document.documentElement).appendChild(overlayEl);
  }

  function renderCards() {
    if (!overlayEl) createOverlay();
    const container = overlayEl.querySelector("#tabflip-cards");
    container.innerHTML = "";

    tabs.forEach((tab, i) => {
      const card = document.createElement("div");
      card.className = "tabflip-card" + (i === selectedIndex ? " tabflip-card--selected" : "");

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

      const meta = document.createElement("div");
      meta.className = "tabflip-card__meta";

      const favicon = document.createElement("img");
      favicon.className = "tabflip-card__favicon";
      favicon.src = tab.favIconUrl || "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22><rect fill=%22%23555%22 width=%221%22 height=%221%22/></svg>";
      favicon.width = 14;
      favicon.height = 14;
      favicon.onerror = function() {
        this.style.display = "none";
      };

      const title = document.createElement("span");
      title.className = "tabflip-card__title";
      title.textContent = tab.title || "Untitled";

      meta.appendChild(favicon);
      meta.appendChild(title);
      card.appendChild(screenshotEl);
      card.appendChild(meta);
      container.appendChild(card);
    });
  }

  function showOverlay() {
    if (!overlayEl) createOverlay();
    overlayEl.classList.add("tabflip-overlay--visible");
    overlayVisible = true;
    renderCards();
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
    chrome.runtime.sendMessage({ type: "switchTab", tabId: tab.id });
    hideOverlay();
  }

  async function fetchMRU() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "getMRU" });
      if (response && response.tabs) {
        tabs = response.tabs;
      }
    } catch (_) {
      tabs = [];
    }
  }

  // ── Keyboard handling ──────────────────────────────────────────────

  document.addEventListener("keydown", async (e) => {
    // Track alt/option state
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

    // Q while alt/option held — prevent œ character on Mac
    if (e.code === "KeyQ" && (altHeld || e.altKey)) {
      e.preventDefault();
      e.stopPropagation();

      if (!overlayVisible) {
        // First press — fetch MRU and show overlay
        await fetchMRU();
        if (tabs.length < 2) return; // nothing to switch to

        qCount = 1;

        if (e.shiftKey) {
          selectedIndex = tabs.length - 1; // wrap to end
        } else {
          selectedIndex = 1; // start at second tab (first is current)
        }

        showOverlay();

        // Start quick-tap timer. If alt releases quickly, treat as instant switch
        switchTimer = setTimeout(() => {
          switchTimer = null;
        }, SWITCH_DELAY);
      } else {
        // Subsequent presses — move selection
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
        commitSwitch();
      }
    }
  }, true);

  // Handle edge case: window/tab blur while alt held
  window.addEventListener("blur", () => {
    if (overlayVisible) {
      hideOverlay();
    }
    altHeld = false;
  });
})();
