// TabFlip — switcher popup window logic

let tabs = [];
let selectedIndex = 1;
let leaveSwitcherOpen = false;

chrome.storage.sync.get({ leaveSwitcherOpen: false }, (res) => {
  leaveSwitcherOpen = res.leaveSwitcherOpen === true;
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.leaveSwitcherOpen) {
    leaveSwitcherOpen = changes.leaveSwitcherOpen.newValue === true;
  }
});

// ── Configured shortcut keys ─────────────────────────────────────────
// While this window has focus, background.js deliberately ignores
// chrome.commands (see handleCommand) so we handle Q/arrows/etc entirely
// on our own here — meaning we need to know the *actual* configured key
// for each command ourselves, whatever the user has rebound them to.

function shortcutKeyToEventKey(token) {
  const map = {
    Comma: ",", Period: ".", Space: " ",
    Up: "ArrowUp", Down: "ArrowDown", Left: "ArrowLeft", Right: "ArrowRight",
    Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown",
    Insert: "Insert", Delete: "Delete", Tab: "Tab",
  };
  if (map[token]) return map[token].toLowerCase();
  if (/^F([1-9]|1[0-2])$/.test(token)) return token.toLowerCase();
  if (/^[A-Za-z0-9]$/.test(token)) return token.toLowerCase();
  return null;
}

// Track Shift alongside the key — the default config binds both commands
// to the same base key ("Q"), distinguished only by whether Shift is also
// held, so matching on the key alone isn't enough to tell them apart.
let cycleKeys = {
  forward: { key: "q", shift: false },
  backward: { key: "q", shift: true },
};
chrome.commands.getAll((commands) => {
  for (const cmd of commands || []) {
    if (!cmd.shortcut) continue;
    const parts = cmd.shortcut.split("+");
    const key = shortcutKeyToEventKey(parts[parts.length - 1]);
    if (!key) continue;
    const shift = parts.slice(0, -1).includes("Shift");
    if (cmd.name === "cycle-tab") cycleKeys.forward = { key, shift };
    else if (cmd.name === "cycle-tab-backward") cycleKeys.backward = { key, shift };
  }
});

function render() {
  const container = document.getElementById("cards");
  container.innerHTML = "";

  tabs.forEach((tab, i) => {
    const card = document.createElement("div");
    card.className = "card" + (i === selectedIndex ? " selected" : "");
    card.onclick = () => { selectedIndex = i; switchTo(); };

    const swrap = document.createElement("div");
    swrap.className = "screenshot-wrap";
    const shot = document.createElement("div");
    shot.className = "screenshot" + (tab.screenshot ? "" : " empty");

    if (tab.screenshot) {
      const img = document.createElement("img");
      img.src = tab.screenshot;
      img.draggable = false;
      shot.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "placeholder";
      ph.textContent = (tab.title || "?").charAt(0).toUpperCase();
      shot.appendChild(ph);
    }
    swrap.appendChild(shot);

    const meta = document.createElement("div");
    meta.className = "meta";

    const fwrap = document.createElement("div");
    fwrap.className = "favicon-wrap";
    if (tab.favIconUrl) {
      const fi = document.createElement("img");
      fi.className = "favicon";
      fi.src = tab.favIconUrl;
      fi.onerror = function () {
        const s = document.createElement("span");
        s.className = "favicon-letter";
        s.textContent = (tab.title || "?").charAt(0).toUpperCase();
        this.replaceWith(s);
      };
      fwrap.appendChild(fi);
    } else {
      const s = document.createElement("span");
      s.className = "favicon-letter";
      s.textContent = (tab.title || "?").charAt(0).toUpperCase();
      fwrap.appendChild(s);
    }

    const text = document.createElement("div");
    text.className = "text";
    const t = document.createElement("span");
    t.className = "title";
    t.textContent = tab.title || "Untitled";
    const u = document.createElement("span");
    u.className = "url";
    try { u.textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (_) { u.textContent = ""; }

    text.appendChild(t);
    text.appendChild(u);
    meta.appendChild(fwrap);
    meta.appendChild(text);
    card.appendChild(swrap);
    card.appendChild(meta);
    container.appendChild(card);
  });
}

function switchTo() {
  if (selectedIndex >= 0 && selectedIndex < tabs.length) {
    chrome.runtime.sendMessage({ type: "switchTab", tabId: tabs[selectedIndex].id }, () => {
      window.close();
    });
  } else {
    window.close();
  }
}

// Safety net: close (without switching) if the window sits untouched for
// 8s, in case it somehow gets stuck. Never auto-switches on its own, so it
// can't race ahead of the user actually deciding.
let stuckTimer = null;
function resetStuckTimer() {
  if (stuckTimer) clearTimeout(stuckTimer);
  stuckTimer = setTimeout(() => window.close(), 8000);
}

function cycle(direction) {
  selectedIndex = direction === "backward"
    ? (selectedIndex - 1 + tabs.length) % tabs.length
    : (selectedIndex + 1) % tabs.length;
  render();
  resetStuckTimer();
}

// ── Keyboard ──────────────────────────────────────────────────────────

document.addEventListener("keyup", (e) => {
  // Chrome commands can be rebound to Ctrl, Alt, or Command/MacCtrl as the
  // primary modifier — watch for release of whichever one was used.
  if (e.key === "Control" || e.key === "Meta" || e.key === "Alt") {
    if (!leaveSwitcherOpen) switchTo();
    // else: leave the window open — user confirms with Enter or a click
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    window.close();
  }
  if (e.key === "Enter") {
    e.preventDefault();
    switchTo();
    return;
  }
  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
    e.preventDefault();
    cycle("forward");
    return;
  }
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    e.preventDefault();
    cycle("backward");
    return;
  }
  if (!(e.ctrlKey || e.altKey || e.metaKey)) return;
  const key = e.key.toLowerCase();
  if (key === cycleKeys.backward.key && e.shiftKey === cycleKeys.backward.shift) {
    e.preventDefault();
    cycle("backward");
  } else if (key === cycleKeys.forward.key && e.shiftKey === cycleKeys.forward.shift) {
    e.preventDefault();
    cycle("forward");
  }
});

// ── Init: get tabs from background ───────────────────────────────────

chrome.runtime.sendMessage({ type: "getMRU" }, (res) => {
  if (res && res.tabs && res.tabs.length >= 2) {
    tabs = res.tabs;
    selectedIndex = 1;
    render();
    resetStuckTimer();
  } else {
    window.close();
  }
});
