// TabFlip — MRU tab tracker + screenshot cache (service worker)

// mruStacks: { windowId: [tabId, ...] } — index 0 is most recent
const mruStacks = {};
// screenshots: { tabId: dataUrl }
const screenshots = {};
const MAX_MRU = 5;
const MAX_SCREENSHOTS = 20;

// ── Helpers ──────────────────────────────────────────────────────────

function getStack(windowId) {
  if (!mruStacks[windowId]) mruStacks[windowId] = [];
  return mruStacks[windowId];
}

function pushTab(windowId, tabId) {
  const stack = getStack(windowId);
  const idx = stack.indexOf(tabId);
  if (idx !== -1) stack.splice(idx, 1);
  stack.unshift(tabId);
  if (stack.length > MAX_MRU) stack.length = MAX_MRU;
}

function removeTab(tabId) {
  for (const wid of Object.keys(mruStacks)) {
    const stack = mruStacks[wid];
    const idx = stack.indexOf(tabId);
    if (idx !== -1) stack.splice(idx, 1);
  }
  delete screenshots[tabId];
}

function pruneScreenshots() {
  const keys = Object.keys(screenshots);
  if (keys.length > MAX_SCREENSHOTS) {
    // Keep only tabs that are in some MRU stack; drop oldest extras
    const mruIds = new Set(Object.values(mruStacks).flat());
    for (const key of keys) {
      if (!mruIds.has(Number(key))) {
        delete screenshots[key];
        if (Object.keys(screenshots).length <= MAX_SCREENSHOTS) break;
      }
    }
  }
}

async function captureScreenshot(windowId, tabId) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
      format: "jpeg",
      quality: 50
    });
    screenshots[tabId] = dataUrl;
    pruneScreenshots();
  } catch (_) {
    // Tab may not be capturable (chrome://, devtools, etc.) — ignore
  }
}

// ── Tab events ───────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const { tabId, windowId } = activeInfo;
  pushTab(windowId, tabId);

  // Small delay to let the page render before capturing
  setTimeout(() => captureScreenshot(windowId, tabId), 350);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  removeTab(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.title || changeInfo.url) {
    pushTab(tab.windowId, tabId);
    // Re-capture on load complete
    if (changeInfo.status === "complete") {
      setTimeout(() => captureScreenshot(tab.windowId, tabId), 500);
    }
  }
});

// Seed MRU on startup with all open tabs
chrome.runtime.onStartup.addListener(seedMRU);
chrome.runtime.onInstalled.addListener(seedMRU);

async function seedMRU() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    const stack = getStack(tab.windowId);
    if (tab.active) {
      stack.unshift(tab.id);
    } else {
      stack.push(tab.id);
    }
  }
  // Trim
  for (const wid of Object.keys(mruStacks)) {
    if (mruStacks[wid].length > MAX_MRU) mruStacks[wid].length = MAX_MRU;
  }
}

// ── Messaging ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "getMRU") {
    handleGetMRU(msg, sender).then(sendResponse);
    return true; // async
  }
  if (msg.type === "switchTab") {
    chrome.tabs.update(msg.tabId, { active: true });
    sendResponse({ ok: true });
  }
});

async function handleGetMRU(msg, sender) {
  const windowId = msg.windowId || (sender.tab && sender.tab.windowId);
  const stack = getStack(windowId);

  // Resolve tab info for each id in the stack
  const tabs = [];
  for (const id of stack) {
    try {
      const tab = await chrome.tabs.get(id);
      tabs.push({
        id: tab.id,
        title: tab.title || "Untitled",
        url: tab.url || "",
        favIconUrl: tab.favIconUrl || "",
        screenshot: screenshots[tab.id] || null
      });
    } catch (_) {
      // Tab no longer exists
      removeTab(id);
    }
  }
  return { tabs };
}
