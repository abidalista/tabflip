// Platform-aware popup init
const isMac = navigator.platform.toUpperCase().includes("MAC");
const modKey = isMac ? "Option" : "Alt";

document.getElementById("shortcut-text").innerHTML =
  `Hold <kbd>${modKey}</kbd> + press <kbd>Q</kbd> to cycle tabs`;

document.getElementById("mod-key").textContent = modKey;
document.getElementById("mod-key-2").textContent = modKey;

document.getElementById("customize-link").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});
