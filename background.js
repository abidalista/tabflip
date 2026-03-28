// TabFlip — background service worker (fast & reliable)

const MAX_MRU = 5;
const MAX_SCREENSHOTS = 20;

let mruStacks = {};
let screenshots = {};
let switcherOpen = false;
let switcherTabId = null;
let switcherWindowId = null;
let stateLoaded = false;
let autoSwitchTimer = null; // fires when user stops pressing Q

// ── Persistence ─────────────────────────────────────────────────────

async function saveMRU() {
  try { await chrome.storage.session.set({ mruStacks }); } catch (_) {}
}

async function loadMRU() {
  if (stateLoaded) return;
  try {
    const data = await chrome.storage.session.get("mruStacks");
    if (data.mruStacks) mruStacks = data.mruStacks;
  } catch (_) {}
  stateLoaded = true;
}

// ── MRU helpers ─────────────────────────────────────────────────────

function getStack(wid) {
  if (!mruStacks[wid]) mruStacks[wid] = [];
  return mruStacks[wid];
}

function pushTab(wid, tid) {
  const s = getStack(wid);
  const i = s.indexOf(tid);
  if (i !== -1) s.splice(i, 1);
  s.unshift(tid);
  if (s.length > MAX_MRU) s.length = MAX_MRU;
}

function removeTab(tid) {
  for (const wid of Object.keys(mruStacks)) {
    const s = mruStacks[wid];
    const i = s.indexOf(tid);
    if (i !== -1) s.splice(i, 1);
  }
  delete screenshots[tid];
}

async function captureScreenshot(wid, tid) {
  if (switcherOpen) return;
  try {
    screenshots[tid] = await chrome.tabs.captureVisibleTab(wid, { format: "jpeg", quality: 50 });
    const keys = Object.keys(screenshots);
    if (keys.length > MAX_SCREENSHOTS) {
      const keep = new Set(Object.values(mruStacks).flat());
      for (const k of keys) {
        if (!keep.has(Number(k))) { delete screenshots[k]; }
        if (Object.keys(screenshots).length <= MAX_SCREENSHOTS) break;
      }
    }
  } catch (_) {}
}

// ── Build tab list — single fast query, no individual tab gets ──────

async function buildTabList(wid) {
  await loadMRU();

  // One query gets everything we need
  const windowTabs = await chrome.tabs.query({ windowId: wid });
  if (windowTabs.length < 2) return [];

  const maxTabs = Math.min(5, windowTabs.length);

  const tabMap = new Map();
  for (const t of windowTabs) {
    tabMap.set(t.id, {
      id: t.id,
      title: t.title || "Untitled",
      url: t.url || "",
      favIconUrl: t.favIconUrl || "",
      screenshot: screenshots[t.id] || null
    });
  }

  // Build ordered list: MRU first, then remaining tabs
  const out = [];
  const seen = new Set();
  const stack = getStack(wid);

  for (const id of stack) {
    if (tabMap.has(id) && out.length < maxTabs) {
      out.push(tabMap.get(id));
      seen.add(id);
    }
  }

  // Fill with remaining window tabs (active first)
  if (out.length < maxTabs) {
    const active = windowTabs.find(t => t.active);
    if (active && !seen.has(active.id)) {
      out.unshift(tabMap.get(active.id));
      seen.add(active.id);
    }
    for (const t of windowTabs) {
      if (out.length >= maxTabs) break;
      if (seen.has(t.id)) continue;
      out.push(tabMap.get(t.id));
      seen.add(t.id);
    }
  }

  // Update MRU with what we found
  if (out.length > 0) {
    mruStacks[wid] = out.map(t => t.id);
    saveMRU();
  }

  return out;
}

// ── Ensure content script ───────────────────────────────────────────

async function ensureContentScript(tabId) {
  // Try ping first (fast path — script already injected)
  try {
    const r = await chrome.tabs.sendMessage(tabId, { type: "ping" });
    if (r && r.ok) return true;
  } catch (_) {}

  // Inject fresh
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    return true;
  } catch (_) {
    return false;
  }
}

// ── Fallback: popup window for restricted pages ─────────────────────

async function openFallbackSwitcher(windowId) {
  if (switcherWindowId) {
    try {
      await chrome.windows.get(switcherWindowId);
      await chrome.windows.update(switcherWindowId, { focused: true });
      return;
    } catch (_) {
      switcherWindowId = null;
    }
  }

  const tabs = await buildTabList(windowId);
  if (tabs.length < 2) return;

  const width = Math.min(tabs.length * 196 + 48, 1200);
  const height = 240;

  try {
    const cw = await chrome.windows.get(windowId);
    const win = await chrome.windows.create({
      url: "switcher.html", type: "popup",
      width, height,
      left: Math.round(cw.left + (cw.width - width) / 2),
      top: Math.round(cw.top + (cw.height - height) / 2),
      focused: true
    });
    switcherWindowId = win.id;
  } catch (_) {
    try {
      const win = await chrome.windows.create({
        url: "switcher.html", type: "popup", width, height, focused: true
      });
      switcherWindowId = win.id;
    } catch (_) {}
  }
}

// ── Handle Ctrl+Q ───────────────────────────────────────────────────

// ── Auto-switch: fires 2s after last Q press (fallback for keyup) ──

function resetAutoSwitch() {
  if (autoSwitchTimer) clearTimeout(autoSwitchTimer);
  autoSwitchTimer = setTimeout(() => {
    if (switcherOpen && switcherTabId) {
      console.log("[TF] auto-switch firing (2s since last Q press)");
      try {
        chrome.tabs.sendMessage(switcherTabId, { type: "autoSwitch" });
      } catch (_) {}
      switcherOpen = false;
      switcherTabId = null;
    }
    autoSwitchTimer = null;
  }, 2000);
}

function clearAutoSwitch() {
  if (autoSwitchTimer) { clearTimeout(autoSwitchTimer); autoSwitchTimer = null; }
}

async function handleCommand() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!activeTab) return;
    console.log("[TF] handleCommand — tab:", activeTab.id, "window:", activeTab.windowId, "url:", activeTab.url?.slice(0, 60));

    // Don't operate on the switcher popup window itself
    if (activeTab.windowId === switcherWindowId) return;

    // ── Already open on THIS tab? Just cycle ──
    if (switcherOpen && switcherTabId === activeTab.id) {
      try {
        chrome.tabs.sendMessage(switcherTabId, { type: "cycle" });
      } catch (_) {
        switcherOpen = false;
        switcherTabId = null;
      }
      // Reset auto-switch: 2s after last Q press, switch automatically
      resetAutoSwitch();
      return;
    }

    // ── Was open on different tab? Kill it ──
    if (switcherOpen && switcherTabId) {
      try { chrome.tabs.sendMessage(switcherTabId, { type: "hide" }); } catch (_) {}
      switcherOpen = false;
      switcherTabId = null;
    }

    // ── Can we inject? ──
    const canInject = activeTab.url && /^https?:\/\//.test(activeTab.url);
    if (!canInject) {
      await openFallbackSwitcher(activeTab.windowId);
      return;
    }

    // ── Build tab list and inject in parallel ──
    const [tabs, scriptOk] = await Promise.all([
      buildTabList(activeTab.windowId),
      ensureContentScript(activeTab.id)
    ]);

    if (tabs.length < 2) return;

    if (!scriptOk) {
      await openFallbackSwitcher(activeTab.windowId);
      return;
    }

    // ── Show overlay ──
    try {
      const r = await chrome.tabs.sendMessage(activeTab.id, { type: "showSwitcher", tabs });
      if (r && r.ok) {
        switcherOpen = true;
        switcherTabId = activeTab.id;
        resetAutoSwitch();
        return;
      }
    } catch (_) {}

    // Overlay failed — fallback
    await openFallbackSwitcher(activeTab.windowId);

  } catch (_) {}
}

// ── Tab events ──────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  if (switcherOpen && switcherTabId && switcherTabId !== tabId) {
    try { chrome.tabs.sendMessage(switcherTabId, { type: "hide" }); } catch (_) {}
    switcherOpen = false;
    switcherTabId = null;
  }
  loadMRU().then(() => {
    pushTab(windowId, tabId);
    saveMRU();
    console.log("[TF] MRU updated — window:", windowId, "stack:", getStack(windowId));
  });
  setTimeout(() => captureScreenshot(windowId, tabId), 800);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  loadMRU().then(() => { removeTab(tabId); saveMRU(); });
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "complete") {
    // Page navigated while overlay was open — reset state
    if (tabId === switcherTabId) {
      switcherOpen = false;
      switcherTabId = null;
    }
    setTimeout(() => captureScreenshot(tab.windowId, tabId), 500);
  }
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === switcherWindowId) switcherWindowId = null;
});

// ── Startup / Install ───────────────────────────────────────────────

chrome.runtime.onStartup.addListener(() => loadMRU());

chrome.runtime.onInstalled.addListener(async () => {
  await loadMRU();
  const allTabs = await chrome.tabs.query({});
  for (const tab of allTabs) {
    pushTab(tab.windowId, tab.id);
    if (tab.url && /^https?:\/\//.test(tab.url)) {
      try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }); } catch (_) {}
    }
  }
  await saveMRU();
});

// ── Command ─────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener((command) => {
  if (command === "cycle-tab") handleCommand();
});

// ── Messaging ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "getMRU") {
    (async () => {
      const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!activeTab) { sendResponse({ tabs: [] }); return; }
      let wid = activeTab.windowId;
      if (wid === switcherWindowId) {
        const ws = await chrome.windows.getAll({ windowTypes: ["normal"] });
        if (ws.length > 0) wid = ws[0].id;
      }
      sendResponse({ tabs: await buildTabList(wid) });
    })();
    return true;
  }

  if (msg.type === "switchTab") {
    clearAutoSwitch();
    chrome.tabs.update(msg.tabId, { active: true }).catch(() => {});
    switcherOpen = false;
    switcherTabId = null;
    switcherWindowId = null;
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === "switcherClosed") {
    clearAutoSwitch();
    switcherOpen = false;
    switcherTabId = null;
    sendResponse({ ok: true });
  }
});
