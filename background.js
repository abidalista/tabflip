// TabFlip — background service worker

const MAX_MRU = 10;
const MAX_SCREENSHOTS = 20;

let mruStacks = {};    // { windowId: [tabId, ...] }
let screenshots = {};  // { tabId: dataUrl }

// ── Persistence (survives service worker restarts) ──────────────────

async function saveMRU() {
  try { await chrome.storage.session.set({ mruStacks }); } catch (_) {}
}

async function loadMRU() {
  try {
    const data = await chrome.storage.session.get("mruStacks");
    if (data.mruStacks) mruStacks = data.mruStacks;
  } catch (_) {}
}

// ── MRU helpers ──────────────────────────────────────────────────────

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
  try {
    screenshots[tid] = await chrome.tabs.captureVisibleTab(wid, { format: "jpeg", quality: 50 });
    // Prune if over limit
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
  // Group tabs by window
  const byWindow = {};
  for (const tab of allTabs) {
    if (!byWindow[tab.windowId]) byWindow[tab.windowId] = { active: null, others: [] };
    if (tab.active) byWindow[tab.windowId].active = tab.id;
    else byWindow[tab.windowId].others.push(tab.id);
  }
  for (const [wid, group] of Object.entries(byWindow)) {
    const s = getStack(Number(wid));
    // Only seed if stack is empty (don't overwrite real MRU order)
    if (s.length > 0) continue;
    if (group.active) s.push(group.active);
    for (const id of group.others) s.push(id);
    if (s.length > MAX_MRU) s.length = MAX_MRU;
  }
  await saveMRU();
  console.log("[TabFlip] seeded MRU:", JSON.stringify(mruStacks));
}

// ── Tab events ───────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  pushTab(windowId, tabId);
  saveMRU();
  setTimeout(() => captureScreenshot(windowId, tabId), 400);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  removeTab(tabId);
  saveMRU();
});

// Only capture screenshot on complete — do NOT push to MRU on page updates
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "complete") {
    setTimeout(() => captureScreenshot(tab.windowId, tabId), 500);
  }
});

// ── Startup / Install ────────────────────────────────────────────────

chrome.runtime.onStartup.addListener(async () => {
  await loadMRU();
  await seedMRU();
});

chrome.runtime.onInstalled.addListener(async () => {
  await loadMRU();
  await seedMRU();
  // Re-inject content script into existing http(s) tabs
  const allTabs = await chrome.tabs.query({});
  for (const tab of allTabs) {
    if (!tab.url || !/^https?:\/\//.test(tab.url)) continue;
    try {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["styles.css"] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    } catch (_) {}
  }
  console.log("[TabFlip] content scripts injected into existing tabs");
});

// ── Messaging ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "getMRU") {
    (async () => {
      // Restore state if worker restarted
      if (Object.keys(mruStacks).length === 0) await loadMRU();

      const wid = msg.windowId || (sender.tab && sender.tab.windowId);
      if (!wid) { sendResponse({ tabs: [] }); return; }

      // Seed if still empty after loading
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
      console.log("[TabFlip] getMRU returning", result.length, "tabs for window", wid);
      sendResponse({ tabs: result });
    })();
    return true; // async
  }

  if (msg.type === "switchTab") {
    try {
      chrome.tabs.update(msg.tabId, { active: true });
    } catch (_) {}
    sendResponse({ ok: true });
  }
});
