// TabFlip — background service worker (overlay approach)

const MAX_MRU = 5;
const MAX_SCREENSHOTS = 20;

let mruStacks = {};
let screenshots = {};
let switcherOpen = false;
let switcherTabId = null;
let switcherWindowId = null; // fallback popup window for chrome:// pages

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

async function seedMRU() {
  const allTabs = await chrome.tabs.query({});
  const byWindow = {};
  for (const tab of allTabs) {
    if (!byWindow[tab.windowId]) byWindow[tab.windowId] = { active: null, others: [] };
    if (tab.active) byWindow[tab.windowId].active = tab.id;
    else byWindow[tab.windowId].others.push(tab.id);
  }
  for (const [wid, group] of Object.entries(byWindow)) {
    const s = getStack(Number(wid));
    if (s.length > 0) continue;
    if (group.active) s.push(group.active);
    for (const id of group.others) s.push(id);
    if (s.length > MAX_MRU) s.length = MAX_MRU;
  }
  await saveMRU();
}

// ── Build tab list (parallel fetch, max 5) ──────────────────────────

async function buildTabList(wid) {
  if (Object.keys(mruStacks).length === 0) await loadMRU();
  if (getStack(wid).length < 2) await seedMRU();

  const stack = getStack(wid).slice(0, 5);
  const results = await Promise.allSettled(stack.map(id => chrome.tabs.get(id)));
  const out = [];
  const seen = new Set();
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === "fulfilled") {
      const t = results[i].value;
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

  // If MRU didn't have enough tabs, fill from the current window
  if (out.length < 2) {
    const windowTabs = await chrome.tabs.query({ windowId: wid });
    for (const t of windowTabs) {
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

// ── Ensure content script is injected ───────────────────────────────

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "ping" });
    return true;
  } catch (_) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
      await new Promise(r => setTimeout(r, 50));
      return true;
    } catch (_) {
      return false;
    }
  }
}

// ── Fallback: popup window for pages where content scripts can't run ─

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
}

// ── Handle Ctrl+Q command ───────────────────────────────────────────

async function handleCommand() {
  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!activeTab) return;

  // If overlay is open on THIS tab, just cycle
  if (switcherOpen && switcherTabId === activeTab.id) {
    try {
      await chrome.tabs.sendMessage(switcherTabId, { type: "cycle" });
      return;
    } catch (_) {
      switcherOpen = false;
      switcherTabId = null;
    }
  }

  // If overlay was open on a DIFFERENT tab, close it and start fresh
  if (switcherOpen && switcherTabId && switcherTabId !== activeTab.id) {
    try {
      chrome.tabs.sendMessage(switcherTabId, { type: "hide" });
    } catch (_) {}
    switcherOpen = false;
    switcherTabId = null;
  }

  // Capture current tab screenshot if we don't have one (service worker may have restarted)
  if (!screenshots[activeTab.id]) {
    try {
      screenshots[activeTab.id] = await chrome.tabs.captureVisibleTab(activeTab.windowId, { format: "jpeg", quality: 50 });
    } catch (_) {}
  }

  // If on a page where content scripts can't run, use fallback popup window
  const canInject = activeTab.url && /^https?:\/\//.test(activeTab.url);
  if (!canInject) {
    await openFallbackSwitcher(activeTab.windowId);
    return;
  }

  const tabs = await buildTabList(activeTab.windowId);
  if (tabs.length < 2) return;

  const ok = await ensureContentScript(activeTab.id);
  if (!ok) {
    // Content script injection failed — use fallback
    await openFallbackSwitcher(activeTab.windowId);
    return;
  }

  try {
    await chrome.tabs.sendMessage(activeTab.id, { type: "showSwitcher", tabs });
    switcherOpen = true;
    switcherTabId = activeTab.id;
  } catch (_) {}
}

// ── Tab events ──────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  // If switcher was open on a different tab, close it there
  if (switcherOpen && switcherTabId && switcherTabId !== tabId) {
    try {
      chrome.tabs.sendMessage(switcherTabId, { type: "hide" });
    } catch (_) {}
    switcherOpen = false;
    switcherTabId = null;
  }
  pushTab(windowId, tabId);
  saveMRU();
  setTimeout(() => captureScreenshot(windowId, tabId), 800);
});

chrome.tabs.onRemoved.addListener((tabId) => {
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
  await seedMRU();
});

chrome.runtime.onInstalled.addListener(async () => {
  await loadMRU();
  await seedMRU();
  // Inject content script into existing tabs
  const allTabs = await chrome.tabs.query({});
  for (const tab of allTabs) {
    if (!tab.url || !/^https?:\/\//.test(tab.url)) continue;
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    } catch (_) {}
  }
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
