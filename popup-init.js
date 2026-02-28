const isMac = navigator.platform.toUpperCase().includes("MAC");
const mod = isMac ? "Option" : "Alt";

document.getElementById("shortcut-text").innerHTML =
  `Hold <kbd>${mod}</kbd> + press <kbd>Q</kbd> to cycle tabs`;
document.getElementById("k-mod").textContent = mod;
document.getElementById("k-mod2").textContent = mod;

document.getElementById("customize-link").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

// Test button — trigger overlay on active tab via background
document.getElementById("test-btn").addEventListener("click", async () => {
  const btn = document.getElementById("test-btn");
  btn.textContent = "Triggering…";
  try {
    const response = await chrome.runtime.sendMessage({ type: "testOverlay" });
    if (response && response.ok) {
      btn.textContent = "Sent! Check your tab";
      window.close(); // close popup so user sees the overlay
    } else {
      btn.textContent = response?.error || "Failed";
    }
  } catch (err) {
    btn.textContent = "Error: " + err.message;
  }
  setTimeout(() => { btn.textContent = "Test switcher on active tab"; }, 3000);
});
