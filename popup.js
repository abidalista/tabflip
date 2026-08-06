// TabFlip — popup settings logic

const DEFAULT_MAX_TABS = 5;

const select = document.getElementById("maxTabs");

chrome.storage.sync.get({ maxTabs: DEFAULT_MAX_TABS }, (res) => {
  select.value = String(res.maxTabs);
});

select.addEventListener("change", () => {
  const maxTabs = parseInt(select.value, 10);
  chrome.storage.sync.set({ maxTabs });
});
