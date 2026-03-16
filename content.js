// TabFlip — content script (fast overlay, all styles inline)

(() => {
  // Prevent duplicate listeners on extension reload
  if (window.__tabflipLoaded) {
    const old = document.getElementById("tabflip-overlay");
    if (old) old.remove();
    return;
  }
  window.__tabflipLoaded = true;

  const old = document.getElementById("tabflip-overlay");
  if (old) old.remove();

  let overlayEl = null;
  let cardEls = [];
  let tabs = [];
  let selectedIndex = 0;
  let overlayVisible = false;
  let stuckTimer = null;

  // ── Styles ────────────────────────────────────────────────────────

  const S = {
    overlay: `
      position:fixed;top:0;left:0;width:100vw;height:100vh;
      z-index:2147483647;display:flex;align-items:center;justify-content:center;
      background:rgba(0,0,0,0.45);pointer-events:none;opacity:0;
      transition:opacity 0.12s ease;margin:0;padding:0;
      font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    `,
    overlayShow: `opacity:1;pointer-events:auto;`,
    container: `
      position:relative;padding:24px 28px;border-radius:18px;
      background:rgba(15,15,35,0.88);backdrop-filter:blur(40px) saturate(1.5);
      -webkit-backdrop-filter:blur(40px) saturate(1.5);
      border:1px solid rgba(255,255,255,0.08);
      box-shadow:0 32px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.05);
    `,
    cards: `display:flex;align-items:center;gap:16px;`,
    card: `display:flex;flex-direction:column;gap:8px;width:160px;cursor:pointer;flex-shrink:0;opacity:0.45;transform:scale(0.92);transition:transform 0.1s,opacity 0.1s,width 0.1s;`,
    cardSel: `display:flex;flex-direction:column;gap:8px;width:200px;cursor:pointer;flex-shrink:0;opacity:1;transform:scale(1.08);z-index:10;transition:transform 0.1s,opacity 0.1s,width 0.1s;`,
    wrap: `border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);box-shadow:0 4px 16px rgba(0,0,0,0.3);`,
    wrapSel: `padding:3px;border-radius:13px;overflow:hidden;border:none;background:linear-gradient(135deg,#7B61FF,#d946ef,#E040FB);box-shadow:0 0 30px rgba(123,97,255,0.4),0 0 60px rgba(224,64,251,0.15);`,
    shot: `position:relative;width:100%;aspect-ratio:4/3;background:#1a1a2e;overflow:hidden;`,
    shotSel: `position:relative;width:100%;aspect-ratio:4/3;background:#1a1a2e;overflow:hidden;border-radius:10px;`,
    shotImg: `width:100%;height:100%;object-fit:cover;display:block;`,
    shotEmpty: `position:relative;width:100%;aspect-ratio:4/3;overflow:hidden;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1a1a2e,#252545);`,
    ph: `font-size:28px;font-weight:800;color:rgba(255,255,255,0.15);user-select:none;`,
    meta: `display:flex;align-items:center;gap:6px;padding:0 2px;min-width:0;`,
    fwrap: `width:20px;height:20px;background:#1e1e2e;border:1px solid rgba(255,255,255,0.08);border-radius:5px;display:flex;align-items:center;justify-content:center;flex-shrink:0;`,
    fav: `width:12px;height:12px;border-radius:2px;`,
    fl: `font-size:10px;font-weight:700;color:#888;`,
    flSel: `font-size:10px;font-weight:700;color:#7B61FF;`,
    txt: `display:flex;flex-direction:column;min-width:0;`,
    t: `font-size:11px;font-weight:600;color:#c8c8d8;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`,
    tSel: `font-size:12px;font-weight:600;color:#fff;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`,
    u: `font-size:9px;font-weight:400;color:#666680;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`,
    uSel: `font-size:9px;font-weight:400;color:#8888a8;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`,
  };

  // ── Build overlay once ────────────────────────────────────────────

  function createOverlay() {
    overlayEl = document.createElement("div");
    overlayEl.id = "tabflip-overlay";
    overlayEl.style.cssText = S.overlay;

    const c = document.createElement("div");
    c.id = "tabflip-container";
    c.style.cssText = S.container;

    const cards = document.createElement("div");
    cards.id = "tabflip-cards";
    cards.style.cssText = S.cards;

    c.appendChild(cards);
    overlayEl.appendChild(c);
    (document.body || document.documentElement).appendChild(overlayEl);
  }

  // ── Build cards (only on open, not on cycle) ──────────────────────

  function buildCards() {
    const container = overlayEl.querySelector("#tabflip-cards");
    container.innerHTML = "";
    cardEls = [];

    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      const sel = i === selectedIndex;

      const card = document.createElement("div");
      card.style.cssText = sel ? S.cardSel : S.card;
      card.dataset.idx = i;

      const wrap = document.createElement("div");
      wrap.className = "tf-wrap";
      wrap.style.cssText = sel ? S.wrapSel : S.wrap;

      const shot = document.createElement("div");
      shot.className = "tf-shot";
      if (tab.screenshot) {
        shot.style.cssText = sel ? S.shotSel : S.shot;
        const img = document.createElement("img");
        img.src = tab.screenshot;
        img.alt = tab.title || "Tab screenshot";
        img.draggable = false;
        img.style.cssText = S.shotImg;
        shot.appendChild(img);
      } else {
        shot.style.cssText = S.shotEmpty;
        if (sel) shot.style.borderRadius = "10px";
        const p = document.createElement("div");
        p.style.cssText = S.ph;
        p.textContent = (tab.title || "?").charAt(0).toUpperCase();
        shot.appendChild(p);
      }
      wrap.appendChild(shot);

      const meta = document.createElement("div");
      meta.style.cssText = S.meta;

      const fw = document.createElement("div");
      fw.style.cssText = S.fwrap;
      if (tab.favIconUrl) {
        const fi = document.createElement("img");
        fi.style.cssText = S.fav;
        fi.src = tab.favIconUrl;
        fi.onerror = function () {
          const s = document.createElement("span");
          s.className = "tf-fl";
          s.style.cssText = sel ? S.flSel : S.fl;
          s.textContent = (tab.title || "?").charAt(0).toUpperCase();
          this.replaceWith(s);
        };
        fw.appendChild(fi);
      } else {
        const s = document.createElement("span");
        s.className = "tf-fl";
        s.style.cssText = sel ? S.flSel : S.fl;
        s.textContent = (tab.title || "?").charAt(0).toUpperCase();
        fw.appendChild(s);
      }

      const txt = document.createElement("div");
      txt.style.cssText = S.txt;
      const t = document.createElement("span");
      t.className = "tf-title";
      t.style.cssText = sel ? S.tSel : S.t;
      t.textContent = tab.title || "Untitled";
      const u = document.createElement("span");
      u.className = "tf-url";
      u.style.cssText = sel ? S.uSel : S.u;
      try { u.textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (_) { u.textContent = ""; }

      txt.appendChild(t);
      txt.appendChild(u);
      meta.appendChild(fw);
      meta.appendChild(txt);
      card.appendChild(wrap);
      card.appendChild(meta);
      card.addEventListener("click", ((idx) => () => {
        selectedIndex = idx;
        switchToSelected();
      })(i));
      container.appendChild(card);

      cardEls.push(card);
    }
  }

  // ── Fast style swap on cycle (no DOM rebuild) ─────────────────────

  function updateSelection(prev, next) {
    if (cardEls[prev]) {
      const p = cardEls[prev];
      p.style.cssText = S.card;
      const pw = p.querySelector(".tf-wrap");
      if (pw) pw.style.cssText = S.wrap;
      const ps = p.querySelector(".tf-shot");
      if (ps) ps.style.cssText = tabs[prev]?.screenshot ? S.shot : S.shotEmpty;
      const pt = p.querySelector(".tf-title");
      if (pt) pt.style.cssText = S.t;
      const pu = p.querySelector(".tf-url");
      if (pu) pu.style.cssText = S.u;
      const pf = p.querySelector(".tf-fl");
      if (pf) pf.style.cssText = S.fl;
    }
    if (cardEls[next]) {
      const n = cardEls[next];
      n.style.cssText = S.cardSel;
      const nw = n.querySelector(".tf-wrap");
      if (nw) nw.style.cssText = S.wrapSel;
      const ns = n.querySelector(".tf-shot");
      if (ns) {
        ns.style.cssText = tabs[next]?.screenshot ? S.shotSel : S.shotEmpty;
        if (!tabs[next]?.screenshot) ns.style.borderRadius = "10px";
      }
      const nt = n.querySelector(".tf-title");
      if (nt) nt.style.cssText = S.tSel;
      const nu = n.querySelector(".tf-url");
      if (nu) nu.style.cssText = S.uSel;
      const nf = n.querySelector(".tf-fl");
      if (nf) nf.style.cssText = S.flSel;
    }
  }

  // ── Show / hide / cycle ───────────────────────────────────────────

  function resetStuckTimer() {
    if (stuckTimer) clearTimeout(stuckTimer);
    // Auto-close after 8 seconds if no input (prevents stuck overlay)
    stuckTimer = setTimeout(() => { if (overlayVisible) hideSwitcher(true); }, 15000);
  }

  function showSwitcher(tabData) {
    tabs = tabData;
    selectedIndex = 1;
    if (!overlayEl) createOverlay();
    buildCards();
    overlayEl.offsetHeight;
    overlayEl.style.cssText = S.overlay + S.overlayShow;
    overlayVisible = true;
    resetStuckTimer();
  }

  function hideSwitcher(notify) {
    if (stuckTimer) { clearTimeout(stuckTimer); stuckTimer = null; }
    if (overlayEl) overlayEl.style.cssText = S.overlay;
    overlayVisible = false;
    if (notify) {
      try { chrome.runtime.sendMessage({ type: "switcherClosed" }); } catch (_) {}
    }
  }

  function cycleForward() {
    if (!overlayVisible || tabs.length < 2) return;
    const prev = selectedIndex;
    selectedIndex = (selectedIndex + 1) % tabs.length;
    updateSelection(prev, selectedIndex);
    resetStuckTimer();
  }

  function switchToSelected() {
    if (!overlayVisible) return;
    const tab = tabs[selectedIndex];
    if (tab) {
      try { chrome.runtime.sendMessage({ type: "switchTab", tabId: tab.id }); } catch (_) {}
    }
    hideSwitcher(false);
  }

  // ── Messages ──────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "showSwitcher" && msg.tabs) {
      showSwitcher(msg.tabs);
      sendResponse({ ok: true });
    } else if (msg.type === "cycle") {
      cycleForward();
      sendResponse({ ok: true });
    } else if (msg.type === "hide") {
      hideSwitcher(false);
      sendResponse({ ok: true });
    } else if (msg.type === "ping") {
      sendResponse({ ok: true });
    }
  });

  // ── Keyboard ──────────────────────────────────────────────────────

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
})();
