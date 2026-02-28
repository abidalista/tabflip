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
    // Tab may not be capturable (chrome://, devtools, etc.)
  }
}

// ── Seed MRU on startup / install ────────────────────────────────────

async function seedMRU() {
  const allTabs = await chrome.tabs.query({});
  for (const tab of allTabs) {
    const stack = getStack(tab.windowId);
    if (tab.active) {
      stack.unshift(tab.id);
    } else {
      stack.push(tab.id);
    }
  }
  for (const wid of Object.keys(mruStacks)) {
    if (mruStacks[wid].length > MAX_MRU) mruStacks[wid].length = MAX_MRU;
  }
  console.log("[TabFlip] MRU seeded:", JSON.stringify(mruStacks));
}

// Re-inject content script into all existing tabs on install/update
async function reinjectContentScripts() {
  const allTabs = await chrome.tabs.query({});
  for (const tab of allTabs) {
    // Skip chrome://, chrome-extension://, edge://, about: etc.
    if (!tab.url || !/^https?:\/\//.test(tab.url)) continue;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["styles.css"]
      });
    } catch (_) {
      // Some tabs can't be injected (PDF viewer, etc.)
    }
  }
  console.log("[TabFlip] Content scripts re-injected");
}

chrome.runtime.onStartup.addListener(() => {
  seedMRU();
});

chrome.runtime.onInstalled.addListener(() => {
  seedMRU();
  reinjectContentScripts();
});

// ── Tab events ───────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const { tabId, windowId } = activeInfo;
  pushTab(windowId, tabId);
  setTimeout(() => captureScreenshot(windowId, tabId), 350);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  removeTab(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.title || changeInfo.url) {
    pushTab(tab.windowId, tabId);
    if (changeInfo.status === "complete") {
      setTimeout(() => captureScreenshot(tab.windowId, tabId), 500);
    }
  }
});

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
  if (msg.type === "ping") {
    sendResponse({ pong: true, mruStacks: Object.keys(mruStacks).map(k => ({ windowId: k, count: mruStacks[k].length })) });
  }
  if (msg.type === "testOverlay") {
    handleTestOverlay().then(sendResponse);
    return true;
  }
});

async function handleTestOverlay() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) return { ok: false, error: "No active tab" };
    if (!/^https?:\/\//.test(activeTab.url)) return { ok: false, error: "Can't run on this page" };

    // Ensure content script + CSS are injected
    try {
      await chrome.scripting.insertCSS({ target: { tabId: activeTab.id }, files: ["styles.css"] });
      await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, files: ["content.js"] });
    } catch (_) {}

    // Seed MRU if empty
    const stack = getStack(activeTab.windowId);
    if (stack.length === 0) await seedMRU();

    // Send trigger message to content script
    await chrome.tabs.sendMessage(activeTab.id, { type: "triggerOverlay" });
    return { ok: true };
  } catch (err) {
    console.error("[TabFlip] testOverlay error:", err);
    return { ok: false, error: err.message };
  }
}

async function handleGetMRU(msg, sender) {
  const windowId = msg.windowId || (sender.tab && sender.tab.windowId);
  if (!windowId) {
    console.warn("[TabFlip] getMRU: no windowId");
    return { tabs: [] };
  }

  const stack = getStack(windowId);
  console.log("[TabFlip] getMRU for window", windowId, "stack:", stack);

  if (stack.length === 0) {
    // Stack might be empty if service worker restarted — reseed
    await seedMRU();
  }

  const resolvedStack = getStack(windowId);
  const tabs = [];
  for (const id of resolvedStack) {
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
      removeTab(id);
    }
  }
  console.log("[TabFlip] Returning", tabs.length, "tabs");
  return { tabs };
}
