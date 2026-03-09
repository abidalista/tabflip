// TabFlip — content script (overlay on page, all styles inline)

(() => {
  // Clean up from previous injection
  const old = document.getElementById("tabflip-overlay");
  if (old) old.remove();

  let overlayEl = null;
  let tabs = [];
  let selectedIndex = 0;
  let overlayVisible = false;

  // ── Inline styles (no external CSS dependency) ────────────────────

  const S = {
    overlay: `
      position:fixed; top:0; left:0; width:100vw; height:100vh;
      z-index:2147483647; display:flex; align-items:center; justify-content:center;
      background:rgba(0,0,0,0.45); pointer-events:none; opacity:0;
      transition:opacity 0.15s ease; margin:0; padding:0;
      font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    `,
    overlayVisible: `opacity:1; pointer-events:auto;`,
    container: `
      position:relative; padding:24px 28px; border-radius:18px;
      background:rgba(15,15,35,0.88); backdrop-filter:blur(40px) saturate(1.5);
      -webkit-backdrop-filter:blur(40px) saturate(1.5);
      border:1px solid rgba(255,255,255,0.08);
      box-shadow:0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05);
    `,
    cards: `display:flex; align-items:center; gap:16px;`,
    card: `
      display:flex; flex-direction:column; gap:8px; width:160px;
      cursor:pointer; flex-shrink:0; opacity:0.45; transform:scale(0.92);
      transition:transform 0.15s ease, opacity 0.15s ease;
    `,
    cardSelected: `
      display:flex; flex-direction:column; gap:8px; width:200px;
      cursor:pointer; flex-shrink:0; opacity:1; transform:scale(1.08);
      z-index:10; transition:transform 0.15s ease, opacity 0.15s ease;
    `,
    screenshotWrap: `
      border-radius:10px; overflow:hidden;
      border:1px solid rgba(255,255,255,0.08);
      box-shadow:0 4px 16px rgba(0,0,0,0.3);
    `,
    screenshotWrapSelected: `
      padding:3px; border-radius:13px; overflow:hidden; border:none;
      background:linear-gradient(135deg,#7B61FF,#d946ef,#E040FB);
      box-shadow:0 0 30px rgba(123,97,255,0.4), 0 0 60px rgba(224,64,251,0.15);
    `,
    screenshot: `
      position:relative; width:100%; aspect-ratio:4/3;
      background:#1a1a2e; overflow:hidden;
    `,
    screenshotSelected: `
      position:relative; width:100%; aspect-ratio:4/3;
      background:#1a1a2e; overflow:hidden; border-radius:10px;
    `,
    screenshotImg: `width:100%; height:100%; object-fit:cover; display:block;`,
    screenshotEmpty: `
      position:relative; width:100%; aspect-ratio:4/3; overflow:hidden;
      display:flex; align-items:center; justify-content:center;
      background:linear-gradient(135deg,#1a1a2e,#252545);
    `,
    placeholder: `font-size:28px; font-weight:800; color:rgba(255,255,255,0.15); user-select:none;`,
    meta: `display:flex; align-items:center; gap:6px; padding:0 2px; min-width:0;`,
    faviconWrap: `
      width:20px; height:20px; background:#1e1e2e;
      border:1px solid rgba(255,255,255,0.08); border-radius:5px;
      display:flex; align-items:center; justify-content:center; flex-shrink:0;
    `,
    favicon: `width:12px; height:12px; border-radius:2px;`,
    faviconLetter: `font-size:10px; font-weight:700; color:#888;`,
    faviconLetterSelected: `font-size:10px; font-weight:700; color:#7B61FF;`,
    text: `display:flex; flex-direction:column; min-width:0;`,
    title: `
      font-size:11px; font-weight:600; color:#c8c8d8; line-height:1.3;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    `,
    titleSelected: `
      font-size:12px; font-weight:600; color:#fff; line-height:1.3;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    `,
    url: `
      font-size:9px; font-weight:400; color:#666680; line-height:1.3;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    `,
    urlSelected: `
      font-size:9px; font-weight:400; color:#8888a8; line-height:1.3;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    `,
  };

  // ── DOM ──────────────────────────────────────────────────────────────

  function createOverlay() {
    overlayEl = document.createElement("div");
    overlayEl.id = "tabflip-overlay";
    overlayEl.style.cssText = S.overlay;

    const container = document.createElement("div");
    container.id = "tabflip-container";
    container.style.cssText = S.container;

    const cards = document.createElement("div");
    cards.id = "tabflip-cards";
    cards.style.cssText = S.cards;

    container.appendChild(cards);
    overlayEl.appendChild(container);
    (document.body || document.documentElement).appendChild(overlayEl);
  }

  function showSwitcher(tabData) {
    tabs = tabData;
    selectedIndex = 1; // pre-select previous tab
    if (!overlayEl) createOverlay();
    renderCards();
    overlayEl.offsetHeight; // force reflow
    overlayEl.style.cssText = S.overlay + S.overlayVisible;
    overlayVisible = true;
  }

  function hideSwitcher(notify) {
    if (overlayEl) overlayEl.style.cssText = S.overlay;
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
      const sel = i === selectedIndex;

      const card = document.createElement("div");
      card.style.cssText = sel ? S.cardSelected : S.card;

      const wrap = document.createElement("div");
      wrap.style.cssText = sel ? S.screenshotWrapSelected : S.screenshotWrap;

      const shot = document.createElement("div");

      if (tab.screenshot) {
        shot.style.cssText = sel ? S.screenshotSelected : S.screenshot;
        const img = document.createElement("img");
        img.src = tab.screenshot;
        img.alt = tab.title || "";
        img.draggable = false;
        img.style.cssText = S.screenshotImg;
        shot.appendChild(img);
      } else {
        shot.style.cssText = S.screenshotEmpty;
        if (sel) shot.style.borderRadius = "10px";
        const ph = document.createElement("div");
        ph.style.cssText = S.placeholder;
        ph.textContent = (tab.title || "?").charAt(0).toUpperCase();
        shot.appendChild(ph);
      }
      wrap.appendChild(shot);

      const meta = document.createElement("div");
      meta.style.cssText = S.meta;

      const fwrap = document.createElement("div");
      fwrap.style.cssText = S.faviconWrap;
      if (tab.favIconUrl) {
        const fi = document.createElement("img");
        fi.style.cssText = S.favicon;
        fi.src = tab.favIconUrl;
        fi.onerror = function () {
          const s = document.createElement("span");
          s.style.cssText = sel ? S.faviconLetterSelected : S.faviconLetter;
          s.textContent = (tab.title || "?").charAt(0).toUpperCase();
          this.replaceWith(s);
        };
        fwrap.appendChild(fi);
      } else {
        const s = document.createElement("span");
        s.style.cssText = sel ? S.faviconLetterSelected : S.faviconLetter;
        s.textContent = (tab.title || "?").charAt(0).toUpperCase();
        fwrap.appendChild(s);
      }

      const text = document.createElement("div");
      text.style.cssText = S.text;
      const t = document.createElement("span");
      t.style.cssText = sel ? S.titleSelected : S.title;
      t.textContent = tab.title || "Untitled";
      const u = document.createElement("span");
      u.style.cssText = sel ? S.urlSelected : S.url;
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
    if (msg.type === "hide") {
      hideSwitcher(false);
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
    // Prevent Ctrl+Q from doing anything else while overlay is open
    if ((e.ctrlKey || e.metaKey) && (e.code === "KeyQ" || e.key === "q")) {
      e.preventDefault();
    }
  }, true);

  // NOTE: No window.blur handler — it kills the overlay
})();
