# TabFlip — Manual Test Checklist

## Setup
- [ ] Load unpacked extension at `chrome://extensions` (Developer mode ON)
- [ ] Open 5 different tabs: google.com, github.com, youtube.com, reddit.com, wikipedia.org
- [ ] Click through each tab once so MRU stack populates and screenshots get captured

## Quick Toggle (tap and release)
- [ ] Tap `Ctrl+Q` quickly and release. Does it switch to your last visited tab?
- [ ] Tap again. Does it toggle back to the original tab?

## Overlay Cycling (hold and repeat)
- [ ] Hold `Ctrl`, press `Q`. Does the overlay appear with tab cards?
- [ ] While still holding `Ctrl`, press `Q` again. Does the selection move right?
- [ ] Keep pressing `Q`. Does it cycle through all tabs and wrap around?
- [ ] Release `Ctrl`. Does it switch to the highlighted tab and close the overlay?
- [ ] If release doesn't trigger, wait 2 seconds. Does the auto-switch fire?

## Manual Confirm
- [ ] Open overlay, press `Enter`. Does it switch to the selected tab immediately?
- [ ] Open overlay, click a card. Does it switch to that tab immediately?

## Cancel
- [ ] Open overlay with `Ctrl+Q`, press `Esc`. Does it close without switching tabs?

## Tab Count
- [ ] With 2 tabs open, hold `Ctrl+Q`. Does it show exactly 2 cards?
- [ ] With 3 tabs, does it show 3?
- [ ] With 5+ tabs, does it cap at 5 cards?
- [ ] With only 1 tab open, press `Ctrl+Q`. Does it do nothing or fail gracefully?

## MRU Order
- [ ] Visit tabs in order: A → B → C → A. Open overlay. Is the order A (current), C, B?
- [ ] Close a tab that was in the MRU list. Open overlay. Is the closed tab gone?
- [ ] Open a brand new tab, visit a site. Open overlay. Is the new tab now first in the stack?

## Screenshots
- [ ] After visiting tabs, do screenshot previews appear on the cards?
- [ ] For tabs without screenshots (never visited since extension installed), does a fallback placeholder show?
- [ ] Navigate to a new page on an existing tab. Open overlay. Does the screenshot update?

## Restricted Pages
- [ ] Navigate to `chrome://extensions`. Press `Ctrl+Q`. Does the fallback popup window appear?
- [ ] Navigate to `chrome://newtab`. Press `Ctrl+Q`. Same graceful behavior?
- [ ] Navigate to `chrome-extension://` page. Press `Ctrl+Q`. No crash?

## Strict CSP Sites
- [ ] Test on github.com. Does the overlay render?
- [ ] Test on twitter.com / x.com. Does the overlay render?

## Multi Window
- [ ] Open two Chrome windows with different tabs. Press `Ctrl+Q` in window A. Shows only window A tabs?
- [ ] Switch to window B. Press `Ctrl+Q`. Shows only window B tabs?
- [ ] After switching via overlay, does it stay in the same window (no jumping)?

## Service Worker Recovery
- [ ] Leave browser idle for 2+ minutes. Press `Ctrl+Q`. Does it still work?
- [ ] Go to `chrome://extensions` → TabFlip → click "service worker" inspect link, close devtools. Press `Ctrl+Q`. Still works?

## Overlay Stuck Prevention
- [ ] Open overlay, do nothing for 8 seconds. Does it auto-close?
- [ ] Open overlay, switch to another app (Cmd+Tab), come back. Is overlay gone or closeable?

## Popup
- [ ] Click TabFlip icon in toolbar. Does popup appear?
- [ ] Are the shortcuts displayed correctly (Ctrl+Q)?
- [ ] Does the "buy me a coffee" link open in a new tab?
- [ ] Is the tip text about tab previews visible?
