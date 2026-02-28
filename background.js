// TabFlip — background service worker

const mruStacks = {};   // { windowId: [tabId, ...] }
const screenshots = {}; // { tabId: dataUrl }
const MAX_MRU = 5;
const MAX_SCREENSHOTS = 20;

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
  for (const tab of allTabs) {
    const s = getStack(tab.windowId);
    if (tab.active) s.unshift(tab.id);
    else s.push(tab.id);
  }
  for (const wid of Object.keys(mruStacks)) {
    if (mruStacks[wid].length > MAX_MRU) mruStacks[wid].length = MAX_MRU;
  }
  console.log("[TabFlip] seeded MRU:", JSON.stringify(mruStacks));
}

// ── Tab events ───────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  pushTab(windowId, tabId);
  setTimeout(() => captureScreenshot(windowId, tabId), 400);
});

chrome.tabs.onRemoved.addListener((tabId) => removeTab(tabId));

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "complete" || info.title || info.url) {
    pushTab(tab.windowId, tabId);
    if (info.status === "complete") setTimeout(() => captureScreenshot(tab.windowId, tabId), 500);
  }
});

// ── Startup / Install ────────────────────────────────────────────────

chrome.runtime.onStartup.addListener(() => seedMRU());

chrome.runtime.onInstalled.addListener(async () => {
  await seedMRU();
  // Re-inject content script into existing http(s) tabs so the extension
  // works immediately without the user having to refresh each tab.
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
      const wid = msg.windowId || (sender.tab && sender.tab.windowId);
      if (!wid) { sendResponse({ tabs: [] }); return; }
      // Re-seed if worker restarted and lost state
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
    chrome.tabs.update(msg.tabId, { active: true });
    sendResponse({ ok: true });
  }
});
