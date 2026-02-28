// TabFlip — content script

(() => {
  // Clean up overlay from previous injection (extension reload)
  const old = document.getElementById("tabflip-overlay");
  if (old) old.remove();

  let overlayEl = null;
  let tabs = [];
  let selectedIndex = 0;
  let overlayVisible = false;
  let mruReady = false;

  // ── DOM ──────────────────────────────────────────────────────────────

  function createOverlay() {
    overlayEl = document.createElement("div");
    overlayEl.id = "tabflip-overlay";
    overlayEl.innerHTML = '<div id="tabflip-container"><div id="tabflip-cards"></div></div>';
    document.body.appendChild(overlayEl);
  }

  function showOverlay() {
    if (!overlayEl) createOverlay();
    renderCards();
    overlayEl.classList.add("tabflip-overlay--visible");
    overlayVisible = true;
  }

  function hideOverlay() {
    if (overlayEl) overlayEl.classList.remove("tabflip-overlay--visible");
    overlayVisible = false;
    mruReady = false;
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

  // ── Messaging ────────────────────────────────────────────────────────

  function prefetchMRU() {
    // Fire-and-forget: pre-load MRU data so it's ready when Q is pressed
    chrome.runtime.sendMessage({ type: "getMRU" }, (res) => {
      if (chrome.runtime.lastError) return; // extension context dead
      tabs = (res && res.tabs) ? res.tabs : [];
      mruReady = true;
    });
  }

  function switchToSelected() {
    if (selectedIndex >= 0 && selectedIndex < tabs.length) {
      chrome.runtime.sendMessage({ type: "switchTab", tabId: tabs[selectedIndex].id });
    }
    hideOverlay();
  }

  // ── Keyboard ─────────────────────────────────────────────────────────

  document.addEventListener("keydown", (e) => {
    // When Alt/Option is pressed alone, pre-fetch MRU immediately
    if (e.key === "Alt") {
      prefetchMRU();
      return;
    }

    // Escape: close overlay
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

      // If MRU wasn't pre-fetched yet (e.g. rapid press), fetch now
      if (!mruReady) {
        chrome.runtime.sendMessage({ type: "getMRU" }, (res) => {
          if (chrome.runtime.lastError) return;
          tabs = (res && res.tabs) ? res.tabs : [];
          mruReady = true;
          if (tabs.length >= 2) {
            selectedIndex = e.shiftKey ? tabs.length - 1 : 1;
            showOverlay();
          }
        });
        return;
      }

      if (!overlayVisible) {
        // First Q press: show overlay (data already loaded from prefetch)
        if (tabs.length < 2) return;
        selectedIndex = e.shiftKey ? tabs.length - 1 : 1;
        showOverlay();
      } else {
        // Subsequent Q presses: advance selection
        const delta = e.shiftKey ? -1 : 1;
        selectedIndex = (selectedIndex + delta + tabs.length) % tabs.length;
        renderCards();
      }
    }
  }, true);

  // Alt/Option released: commit switch
  document.addEventListener("keyup", (e) => {
    if (e.key === "Alt" && overlayVisible) {
      switchToSelected();
    }
  }, true);

  window.addEventListener("blur", () => {
    if (overlayVisible) hideOverlay();
  });

  // Message listener for programmatic trigger
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "showOverlay") {
      chrome.runtime.sendMessage({ type: "getMRU" }, (res) => {
        if (chrome.runtime.lastError) return;
        tabs = (res && res.tabs) ? res.tabs : [];
        if (tabs.length < 1) return;
        selectedIndex = Math.min(1, tabs.length - 1);
        showOverlay();
      });
    }
  });
})();
