// TabFlip — background service worker

const MAX_MRU = 10;
const MAX_SCREENSHOTS = 20;

let mruStacks = {};
let screenshots = {};
let switcherOpen = false;
let switcherTabId = null;

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

async function buildTabList(wid) {
  if (Object.keys(mruStacks).length === 0) await loadMRU();
  if (getStack(wid).length === 0) await seedMRU();

  const result = [];
  for (const id of getStack(wid)) {
    try {
      const t = await chrome.tabs.get(id);
      result.push({
        id: t.id,
        title: t.title || "Untitled",
        url: t.url || "",
        favIconUrl: t.favIconUrl || "",
        screenshot: screenshots[t.id] || null
      });
    } catch (_) { removeTab(id); }
  }
  return result;
}

// ── Ensure content script ───────────────────────────────────────────

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "ping" });
    return true;
  } catch (_) {
    try {
      await chrome.scripting.insertCSS({ target: { tabId }, files: ["styles.css"] });
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
      // Small delay for script to initialize
      await new Promise(r => setTimeout(r, 50));
      return true;
    } catch (_) {
      return false;
    }
  }
}

// ── Handle Ctrl+Q command ───────────────────────────────────────────

async function handleCommand() {
  // If switcher is already open, just cycle
  if (switcherOpen && switcherTabId) {
    try {
      await chrome.tabs.sendMessage(switcherTabId, { type: "cycle" });
      return;
    } catch (_) {
      switcherOpen = false;
      switcherTabId = null;
    }
  }

  // First press: open switcher
  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!activeTab || !activeTab.url || !/^https?:\/\//.test(activeTab.url)) return;

  const tabs = await buildTabList(activeTab.windowId);
  if (tabs.length < 2) return;

  const ok = await ensureContentScript(activeTab.id);
  if (!ok) return;

  try {
    await chrome.tabs.sendMessage(activeTab.id, { type: "showSwitcher", tabs });
    switcherOpen = true;
    switcherTabId = activeTab.id;
  } catch (_) {}
}

// ── Tab events ──────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
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

// ── Startup / Install ───────────────────────────────────────────────

chrome.runtime.onStartup.addListener(async () => {
  await loadMRU();
  await seedMRU();
});

chrome.runtime.onInstalled.addListener(async () => {
  await loadMRU();
  await seedMRU();
  // Inject into existing tabs
  const allTabs = await chrome.tabs.query({});
  for (const tab of allTabs) {
    if (!tab.url || !/^https?:\/\//.test(tab.url)) continue;
    try {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["styles.css"] });
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
  if (msg.type === "switchTab") {
    try {
      chrome.tabs.update(msg.tabId, { active: true });
    } catch (_) {}
    switcherOpen = false;
    switcherTabId = null;
    sendResponse({ ok: true });
  }
  if (msg.type === "switcherClosed") {
    switcherOpen = false;
    switcherTabId = null;
    sendResponse({ ok: true });
  }
});
