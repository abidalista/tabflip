// TabFlip — content script

(() => {
  // Clean up overlay from previous injection (extension reload)
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
    document.documentElement.appendChild(overlayEl);
  }

  function showOverlay() {
    if (!overlayEl) createOverlay();
    renderCards();
    // Force reflow so the transition plays
    overlayEl.offsetHeight;
    overlayEl.classList.add("tabflip-overlay--visible");
    overlayVisible = true;
    console.log("[TabFlip] overlay shown with", tabs.length, "tabs, selected:", selectedIndex);
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

  function switchToSelected() {
    if (selectedIndex >= 0 && selectedIndex < tabs.length) {
      console.log("[TabFlip] switching to tab:", tabs[selectedIndex].title);
      chrome.runtime.sendMessage({ type: "switchTab", tabId: tabs[selectedIndex].id });
    }
    hideOverlay();
  }

  // ── Message from background (command triggered) ─────────────────────

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "cycleTab" && msg.tabs) {
      console.log("[TabFlip] received cycleTab message with", msg.tabs.length, "tabs");

      if (!overlayVisible) {
        // First press: show overlay, select the 2nd tab (previous one)
        tabs = msg.tabs;
        selectedIndex = 1;
        showOverlay();
      } else {
        // Subsequent presses: cycle forward
        selectedIndex = (selectedIndex + 1) % tabs.length;
        console.log("[TabFlip] cycling to index:", selectedIndex);
        renderCards();
      }
    }
  });

  // ── Keyboard (only for Alt release + Escape) ───────────────────────

  document.addEventListener("keyup", (e) => {
    if ((e.key === "Alt" || e.key === "Meta") && overlayVisible) {
      console.log("[TabFlip] Alt released, switching");
      switchToSelected();
    }
  }, true);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlayVisible) {
      e.preventDefault();
      e.stopPropagation();
      console.log("[TabFlip] Escape pressed, hiding overlay");
      hideOverlay();
    }
  }, true);

  window.addEventListener("blur", () => {
    if (overlayVisible) hideOverlay();
  });

  console.log("[TabFlip] content script loaded");
})();
