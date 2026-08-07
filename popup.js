// TabFlip — popup settings logic

const leaveOpenCheckbox = document.getElementById("leaveOpen");

chrome.storage.sync.get({ leaveSwitcherOpen: false }, (res) => {
  leaveOpenCheckbox.checked = res.leaveSwitcherOpen === true;
});

leaveOpenCheckbox.addEventListener("change", () => {
  chrome.storage.sync.set({ leaveSwitcherOpen: leaveOpenCheckbox.checked });
});
