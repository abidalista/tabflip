# TabFlip — Manual Test Checklist

## Setup
- [ ] Load unpacked extension at `chrome://extensions` (Developer mode ON)
- [ ] Open 5 different tabs: google.com, github.com, youtube.com, reddit.com, wikipedia.org
- [ ] Click through each tab once (so screenshots get captured)

## Core Switching
- [ ] Press `Ctrl+Q` (`MacCtrl+Q` on Mac). Does the overlay appear?
- [ ] While holding Ctrl, press `Q` again. Does the selection move to the next card?
- [ ] Keep pressing `Q` — does it cycle through all tabs and wrap around?
- [ ] Release `Ctrl`. Does it switch to the highlighted tab?
- [ ] If release doesn't work, wait ~1 second. Does the auto-switch fire?

## Cancel
- [ ] Open overlay with `Ctrl+Q`, press `Esc`. Does it close without switching?
- [ ] Open overlay, click anywhere outside the cards. Does it stay open (no accidental dismiss)?

## Card Click
- [ ] Open overlay, click on a card. Does it switch to that tab immediately?

## Tab Count
- [ ] With 2 tabs open, press `Ctrl+Q`. Does the overlay show exactly 2 cards?
- [ ] With 3 tabs open, does it show 3 cards?
- [ ] With 5+ tabs open, does it show max 5 cards?

## MRU Order
- [ ] Switch between tabs in order: A → B → C → A. Open overlay. Is the order A (current), B (previous), C?
- [ ] Close a tab that was in the MRU list. Open overlay. Is the closed tab gone?

## Idle / Service Worker Restart
- [ ] Stay on one tab for 2+ minutes without touching anything. Press `Ctrl+Q`. Does the overlay still open?
- [ ] Go to `chrome://extensions`, click the service worker "Inspect" link, then close DevTools. Press `Ctrl+Q`. Does it still work?

## Restricted Pages (Fallback Popup Window)
- [ ] Navigate to `chrome://extensions`. Press `Ctrl+Q`. Does the fallback popup window appear?
- [ ] Navigate to `chrome://newtab`. Press `Ctrl+Q`. Does it fail gracefully (fallback or no error)?

## Strict CSP Sites
- [ ] Test on github.com. Does the overlay render? (all styles are inline, no external CSS)
- [ ] Test on twitter.com/x.com. Does the overlay render?

## Multi-Window
- [ ] Open two Chrome windows, each with different tabs. Press `Ctrl+Q` in Window A. Does it only show Window A's tabs?
- [ ] Switch to Window B. Press `Ctrl+Q`. Does it only show Window B's tabs?
- [ ] After switching, does it stay in the same window (no jumping to the other window)?

## Popup (Extension Icon)
- [ ] Click the TabFlip extension icon. Does the popup appear with shortcut instructions?
- [ ] Does the "buy me a coffee" link work?
- [ ] Is the tip text visible?

## Screenshots
- [ ] After visiting tabs, do screenshot previews appear in the overlay?
- [ ] For tabs without screenshots, does a letter placeholder show?

## Debugging
Open DevTools console to verify:
- **Background** (`chrome://extensions` → TabFlip → "Inspect" service worker):
  - `[TF] MRU updated` logs on every tab switch with the tab list
  - `[TF] handleCommand` logs when Ctrl+Q fires
- **Content** (F12 on any website):
  - `[TF] overlay shown` when switcher appears
  - `[TF] overlay hidden` when switcher closes
  - `[TF] keydown` / `[TF] keyup` for key events while overlay is visible
