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
- [ ] Release `Ctrl` immediately after cycling. Does it switch right away (not after a delay)?
- [ ] Pause for a few seconds while holding `Ctrl` and looking at a card before releasing. Does it wait for you indefinitely (no premature switch), then switch on release as normal?

## Backward Cycling & Arrow Keys
- [ ] Hold `Ctrl`, press `Q` a few times to move forward, then hold `Shift` and press `Q`. Does the selection move back one?
- [ ] Open overlay, press `→` or `↓`. Does the selection move forward, same as `Q`?
- [ ] Open overlay, press `←` or `↑`. Does the selection move backward?
- [ ] Cycle backward past the first card. Does it wrap around to the last card?
- [ ] Cycle forward past the last card. Does it still wrap around to the first (unchanged behavior)?
- [ ] Trigger the `chrome://` fallback popup (see Restricted Pages) and repeat the above — do `Shift+Q` and arrow keys work there too?

## Manual Confirm
- [ ] Open overlay, press `Enter`. Does it switch to the selected tab immediately?
- [ ] Open overlay, click a card. Does it switch to that tab immediately?

## Leave Switcher Open Setting
- [ ] In the popup, confirm "Leave switcher open on release" is unchecked by default. Release `Ctrl` after cycling — does it switch immediately (default behavior)?
- [ ] Check the setting. Hold `Ctrl+Q`, cycle, then release `Ctrl`. Does the overlay stay open instead of switching?
- [ ] With the setting on, wait a few seconds after releasing/cycling. Does it stay open indefinitely (no delayed auto-switch at all)?
- [ ] With the setting off (default), open the overlay and use only arrow keys (no `Q`) to browse for a couple seconds while still holding `Ctrl`. Does it stay open the whole time instead of auto-switching mid-browse?
- [ ] With the setting on, press `Enter`. Does it switch to the selected tab?
- [ ] With the setting on, click a card. Does it switch immediately regardless of the setting?
- [ ] With the setting on, press `Ctrl+Q` again after releasing (without switching). Does it resume cycling from where you left off, instead of resetting?
- [ ] Repeat the above in the `chrome://` fallback popup — same checkbox, same behavior?

## Custom Shortcuts
- [ ] At `chrome://extensions/shortcuts`, rebind "Cycle through recent tabs" to `Alt+T`, leave backward as default.
- [ ] Hold `Alt`, press `T`. Does the overlay open?
- [ ] While still holding `Alt`, press `T` again (repeat, not just the first press). Does the selection keep advancing each time? (Known issue: on some Brave configs this intermittently misses a press — an occasional Chromium/Brave active-tab reporting quirk, not fixable from extension code. Arrow keys aren't affected and are the reliable fallback if hit.)
- [ ] Release `Alt`. Does it switch (not requiring Enter)?
- [ ] With a text field focused on the page (e.g. a search box), hold `Alt` and press `T` a few times. Does no "t" get typed into the field?
- [ ] Rebind backward to `Alt+Shift+T` to match. Hold `Alt`, press `Shift+T`. Does it cycle backward?
- [ ] Repeat rebinding + release test with the `chrome://` fallback popup (trigger via a restricted page).
- [ ] Restore both shortcuts to their defaults (`Ctrl+Q` / `Ctrl+Shift+Q`) and confirm everything still works as before.

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
- [ ] Open overlay, do nothing for 8 seconds. Does it auto-close (without switching to any tab)?
- [ ] Open overlay, switch to another app (Cmd+Tab), come back. Is overlay gone or closeable?
- [ ] Repeat the 8s no-interaction case in the `chrome://` fallback popup — does the window close itself too?

## Popup
- [ ] Click TabFlip icon in toolbar. Does popup appear?
- [ ] Are the shortcuts displayed correctly (Ctrl+Q)?
- [ ] Does the "buy me a coffee" link open in a new tab?
- [ ] Is the tip text about tab previews visible?
