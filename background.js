// TabFlip — background service worker (bulletproof edition)

const MAX_MRU = 5;
const MAX_SCREENSHOTS = 20;

let mruStacks = {};
let screenshots = {};
let switcherOpen = false;
let switcherTabId = null;
let switcherWindowId = null;
let commandLock = false; // prevent race conditions

// ── Persistence ─────────────────────────────────────────────────────

async function saveMRU() {
  try { await chrome.storage.session.set({ mruStacks }); } catch (_) {}
}

async function loadMRU() {
  try {
    const data = await chrome.storage.session.get("mruStacks");
    if (data.mruStacks) mruStacks = data.mruStacks;
  } catch (_) {}
}

// ── Ensure state is loaded (call at every entry point) ──────────────

async function ensureState() {
  if (Object.keys(mruStacks).length === 0) {
    await loadMRU();
  }
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

// ── Build tab list — ALWAYS returns tabs if the window has them ─────

async function buildTabList(wid) {
  await ensureState();

  // Step 1: try MRU stack
  const stack = getStack(wid).slice(0, 5);
  const results = await Promise.allSettled(stack.map(id => chrome.tabs.get(id)));
  const out = [];
  const seen = new Set();

  for (let i = 0; i < results.length; i++) {
    if (results[i].status === "fulfilled") {
      const t = results[i].value;
      // Only include tabs from this window (stale cross-window IDs)
      if (t.windowId !== wid) { removeTab(stack[i]); continue; }
      seen.add(t.id);
      out.push({
        id: t.id,
        title: t.title || "Untitled",
        url: t.url || "",
        favIconUrl: t.favIconUrl || "",
        screenshot: screenshots[t.id] || null
      });
    } else {
      removeTab(stack[i]);
    }
  }

  // Step 2: if MRU didn't give us enough, query the actual window tabs
  if (out.length < 5) {
    const windowTabs = await chrome.tabs.query({ windowId: wid });
    // Put active tab first if it's not already in the list
    const active = windowTabs.find(t => t.active);
    const others = windowTabs.filter(t => !t.active);
    const ordered = active ? [active, ...others] : others;

    for (const t of ordered) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      pushTab(wid, t.id);
      out.push({
        id: t.id,
        title: t.title || "Untitled",
        url: t.url || "",
        favIconUrl: t.favIconUrl || "",
        screenshot: screenshots[t.id] || null
      });
      if (out.length >= 5) break;
    }
    saveMRU();
  }

  return out;
}

// ── Ensure content script (with re-injection for stale contexts) ────

async function ensureContentScript(tabId) {
  // Always re-inject to avoid stale context from extension reload
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    await new Promise(r => setTimeout(r, 50));
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

  const cardWidth = 180;
  const gap = 16;
  const padding = 48;
  const width = Math.min(tabs.length * (cardWidth + gap) + padding, 1200);
  const height = 240;

  try {
    const currentWindow = await chrome.windows.get(windowId);
    const left = Math.round(currentWindow.left + (currentWindow.width - width) / 2);
    const top = Math.round(currentWindow.top + (currentWindow.height - height) / 2);

    const win = await chrome.windows.create({
      url: "switcher.html",
      type: "popup",
      width, height, left, top,
      focused: true
    });
    switcherWindowId = win.id;
  } catch (_) {
    // Last resort: open without positioning
    try {
      const win = await chrome.windows.create({
        url: "switcher.html",
        type: "popup",
        width, height,
        focused: true
      });
      switcherWindowId = win.id;
    } catch (_) {}
  }
}

// ── Handle Ctrl+Q command (the main entry point) ────────────────────

async function handleCommand() {
  // Prevent overlapping calls from rapid key presses
  if (commandLock) return;
  commandLock = true;

  try {
    await ensureState();

    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!activeTab) return;

    // If overlay is open on THIS tab, just cycle
    if (switcherOpen && switcherTabId === activeTab.id) {
      try {
        const response = await chrome.tabs.sendMessage(switcherTabId, { type: "cycle" });
        if (response && response.ok) return;
      } catch (_) {}
      // Cycle failed — overlay is dead, reset and reopen
      switcherOpen = false;
      switcherTabId = null;
    }

    // If overlay was open on a DIFFERENT tab, close it
    if (switcherOpen && switcherTabId && switcherTabId !== activeTab.id) {
      try { chrome.tabs.sendMessage(switcherTabId, { type: "hide" }); } catch (_) {}
      switcherOpen = false;
      switcherTabId = null;
    }

    // Capture current tab screenshot if missing
    if (!screenshots[activeTab.id]) {
      try {
        screenshots[activeTab.id] = await chrome.tabs.captureVisibleTab(
          activeTab.windowId, { format: "jpeg", quality: 50 }
        );
      } catch (_) {}
    }

    // Can we inject a content script on this page?
    const canInject = activeTab.url && /^https?:\/\//.test(activeTab.url);

    if (!canInject) {
      await openFallbackSwitcher(activeTab.windowId);
      return;
    }

    const tabs = await buildTabList(activeTab.windowId);
    if (tabs.length < 2) return; // genuinely only 1 tab in the window

    // Inject content script (always re-inject to handle stale contexts)
    const ok = await ensureContentScript(activeTab.id);
    if (!ok) {
      await openFallbackSwitcher(activeTab.windowId);
      return;
    }

    // Send the tab list to the overlay
    try {
      const response = await chrome.tabs.sendMessage(activeTab.id, { type: "showSwitcher", tabs });
      if (response && response.ok) {
        switcherOpen = true;
        switcherTabId = activeTab.id;
        return;
      }
    } catch (_) {}

    // If sendMessage failed, fall back to popup window
    await openFallbackSwitcher(activeTab.windowId);

  } finally {
    commandLock = false;
  }
}

// ── Tab events ──────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  await ensureState();

  // Close overlay on the old tab
  if (switcherOpen && switcherTabId && switcherTabId !== tabId) {
    try { chrome.tabs.sendMessage(switcherTabId, { type: "hide" }); } catch (_) {}
    switcherOpen = false;
    switcherTabId = null;
  }

  pushTab(windowId, tabId);
  saveMRU();
  setTimeout(() => captureScreenshot(windowId, tabId), 800);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await ensureState();
  removeTab(tabId);
  saveMRU();
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "complete") {
    setTimeout(() => captureScreenshot(tab.windowId, tabId), 500);
  }
});

// Clean up fallback popup window
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === switcherWindowId) {
    switcherWindowId = null;
  }
});

// ── Startup / Install ───────────────────────────────────────────────

chrome.runtime.onStartup.addListener(async () => {
  await loadMRU();
});

chrome.runtime.onInstalled.addListener(async () => {
  await loadMRU();
  // Pre-inject content script into all http tabs
  const allTabs = await chrome.tabs.query({});
  for (const tab of allTabs) {
    if (!tab.url || !/^https?:\/\//.test(tab.url)) continue;
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    } catch (_) {}
    // Seed MRU with all tabs
    pushTab(tab.windowId, tab.id);
  }
  await saveMRU();
});

// ── Command (Ctrl+Q) ───────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "cycle-tab") {
    await handleCommand();
  }
});

// ── Messaging ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "getMRU") {
    (async () => {
      await ensureState();
      const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!activeTab) { sendResponse({ tabs: [] }); return; }
      let wid = activeTab.windowId;
      if (wid === switcherWindowId) {
        const allWindows = await chrome.windows.getAll({ windowTypes: ["normal"] });
        if (allWindows.length > 0) wid = allWindows[0].id;
      }
      const tabs = await buildTabList(wid);
      sendResponse({ tabs });
    })();
    return true;
  }

  if (msg.type === "switchTab") {
    try {
      chrome.tabs.update(msg.tabId, { active: true });
      chrome.tabs.get(msg.tabId, (tab) => {
        if (tab && tab.windowId) {
          chrome.windows.update(tab.windowId, { focused: true });
        }
      });
    } catch (_) {}
    switcherOpen = false;
    switcherTabId = null;
    switcherWindowId = null;
    sendResponse({ ok: true });
  }

  if (msg.type === "switcherClosed") {
    switcherOpen = false;
    switcherTabId = null;
    sendResponse({ ok: true });
  }
});
