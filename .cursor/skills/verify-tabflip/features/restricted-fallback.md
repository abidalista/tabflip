# Restricted-page fallback

On pages where Chrome blocks content scripts (`chrome://`, `chrome-extension://`), TabFlip opens a small popup window (`switcher.html`, titled `TabFlip`) instead of the in-page overlay.

## Sub-features

- `fallback-open` opens the fallback window from Ctrl+Q on a `chrome://` page when two or more tabs exist.
- `fallback-cards` renders the same MRU titles as the overlay would.
- `fallback-cycle` moves `.card.selected` on Ctrl+Q.
- `fallback-cancel` closes the window on Escape without switching tabs.

## How to get to it (user POV)

- Navigate to `chrome://version` or `chrome://newtab` and press Ctrl+Q.
- Navigate to a `chrome-extension://` page and press Ctrl+Q.

## Driving it with control-tabflip

Preconditions:

- TabFlip is healthy (`control-tabflip doctor` → `"ok": true`).
- Fixture tabs Alpha, Beta, Gamma remain open in the same window.

- **Open restricted tab.** Run `control-tabflip tabs open --url chrome://version`. Active URL starts with `chrome://version`.
- **Open fallback.** Press Ctrl+Q. Run `control-tabflip keyboard open-switcher`. `control-tabflip windows list` includes a page whose URL ends with `/switcher.html` and whose title is `TabFlip`. `#tabflip-overlay` is **not** injected into `chrome://version`.
- **Cards.** The fallback document `#cards` contains `.card` nodes; one has class `selected`. Titles include the fixture names.
- **Proof.** Screenshot the fallback window to `restricted-fallback/fallback.png` and snapshot card titles to `restricted-fallback/fallback.snapshot.json`.
- **Cancel.** Press Escape. The `switcher.html` page closes. The active tab is still `chrome://version`.

## Gotchas

- If fewer than two tabs exist in the window, the fallback does not open. That is expected, not a harness failure.
- The fallback is a separate window titled `TabFlip`. Do not look for `#tabflip-overlay` on the `chrome://` page.
- `chrome://newtab` and `chrome://extensions` are the same class of restricted page. Proving one restricted URL does not prove the others; list any skipped URL.
- Auto-focus can land in the fallback window. Subsequent Ctrl+Q is ignored while the active tab's window is the switcher itself (`background.js` bails if `activeTab.windowId === switcherWindowId`).
