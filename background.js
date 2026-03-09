// TabFlip — background service worker

const MAX_MRU = 5;
const MAX_SCREENSHOTS = 20;

let mruStacks = {};    // { windowId: [tabId, ...] }
let screenshots = {};  // { tabId: dataUrl }
let switcherWindowId = null;

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
  if (switcherWindowId) return;
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
  console.log("[TabFlip] seeded MRU:", JSON.stringify(mruStacks));
}

// ── Build tab list ──────────────────────────────────────────────────

async function buildTabList(wid) {
  if (Object.keys(mruStacks).length === 0) await loadMRU();
  if (getStack(wid).length === 0) await seedMRU();

  const stack = getStack(wid).slice(0, 5);
  const results = await Promise.allSettled(stack.map(id => chrome.tabs.get(id)));
  const result = [];
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === "fulfilled") {
      const t = results[i].value;
      result.push({
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
  return result;
}

// ── Open switcher popup window ──────────────────────────────────────

async function openSwitcher() {
  // If already open, just cycle (the popup handles its own keyboard)
  if (switcherWindowId) {
    try {
      await chrome.windows.get(switcherWindowId);
      // Window exists — focus it, it will handle Ctrl+Q internally
      await chrome.windows.update(switcherWindowId, { focused: true });
      return;
    } catch (_) {
      switcherWindowId = null;
    }
  }

  // Calculate window size based on tab count
  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!activeTab) return;

  const tabs = await buildTabList(activeTab.windowId);
  if (tabs.length < 2) return;

  const displayTabs = tabs.slice(0, 5);
  const cardWidth = 180;
  const gap = 16;
  const padding = 48;
  const width = Math.min(displayTabs.length * (cardWidth + gap) + padding, 1200);
  const height = 240;

  // Get the current window to center the popup
  const currentWindow = await chrome.windows.get(activeTab.windowId);
  const left = Math.round(currentWindow.left + (currentWindow.width - width) / 2);
  const top = Math.round(currentWindow.top + (currentWindow.height - height) / 2);

  const win = await chrome.windows.create({
    url: "switcher.html",
    type: "popup",
    width,
    height,
    left,
    top,
    focused: true
  });

  switcherWindowId = win.id;
}

// ── Tab events ──────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  // Don't track the switcher window itself
  if (windowId === switcherWindowId) return;
  pushTab(windowId, tabId);
  saveMRU();
  setTimeout(() => captureScreenshot(windowId, tabId), 800);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  removeTab(tabId);
  saveMRU();
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "complete" && tab.windowId !== switcherWindowId) {
    setTimeout(() => captureScreenshot(tab.windowId, tabId), 500);
  }
});

// Clean up when switcher window is closed
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
  console.log("[TabFlip] installed");
});

// ── Command handler (Ctrl+Q) ────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "cycle-tab") {
    await openSwitcher();
  }
});

// ── Messaging ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "getMRU") {
    (async () => {
      const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!activeTab) { sendResponse({ tabs: [] }); return; }
      // Use the parent window, not the switcher popup
      let wid = activeTab.windowId;
      if (wid === switcherWindowId) {
        // Find the last focused non-popup window
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
      // Focus the window containing the tab
      chrome.tabs.get(msg.tabId, (tab) => {
        if (tab && tab.windowId) {
          chrome.windows.update(tab.windowId, { focused: true });
        }
      });
    } catch (_) {}
    switcherWindowId = null;
    sendResponse({ ok: true });
  }
});
