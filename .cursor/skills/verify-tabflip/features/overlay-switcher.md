# Overlay switcher

The overlay switcher shows the current window's recent tabs as cards on the page. Holding Ctrl and pressing Q opens it, further Q presses move the selection, releasing Ctrl (or Enter, or clicking a card) switches to the selected tab, and Escape closes it without switching.

## Sub-features

- `overlay-open` opens the overlay from Ctrl+Q on an http(s) page with at least two tabs.
- `overlay-cycle` moves the selection one card to the right and wraps.
- `overlay-confirm-release` switches to the selected tab when Ctrl is released.
- `overlay-confirm-enter` switches immediately on Enter.
- `overlay-confirm-click` switches by clicking a card.
- `overlay-cancel` closes on Escape and leaves the active tab unchanged.

## How to get to it (user POV)

- Hold Ctrl and press Q on a normal http(s) page.
- While the overlay is open, press Q again (Ctrl still held) to cycle.
- Release Ctrl, press Enter, or click a card to switch.
- Press Escape to cancel.

## Driving it with control-tabflip

Preconditions:

- TabFlip is healthy (`control-tabflip doctor` → `"ok": true`).
- Fixture tabs Alpha, Beta, Gamma are open. Active title is `Gamma TabFlip fixture`.
- Overlay is not visible.

- **Open overlay.** Hold Ctrl and press Q. Run `control-tabflip keyboard open-switcher`. `#tabflip-overlay` is visible (`opacity` 1). Three cards appear. Selected card title is `Beta TabFlip fixture`. Card 0 title is `Gamma TabFlip fixture`.
- **Cycle.** Press Q again while Ctrl is held. Run `control-tabflip keyboard cycle`. Selected card title is `Alpha TabFlip fixture`.
- **Proof of open+cycle.** Capture the cycled overlay. Run `control-tabflip overlay snapshot --path overlay-switcher/overlay.snapshot.json` and `control-tabflip overlay screenshot --path overlay-switcher/overlay-cycled.png`. Both artifacts identify TabFlip cards, the Gamma page behind them, and `Alpha TabFlip fixture` selected.
- **Cancel.** Press Escape. Run `control-tabflip keyboard cancel`. Overlay is hidden. Active title remains `Gamma TabFlip fixture`.
- **Confirm by release.** Re-seed if needed (`control-tabflip tabs seed --count 3`), activate Gamma, open the overlay, cycle once so Alpha is selected, then release Ctrl. Run `control-tabflip keyboard open-switcher`, `control-tabflip keyboard cycle`, `control-tabflip keyboard confirm`. Overlay is hidden. Active title is `Alpha TabFlip fixture`.
- **Confirm by click.** Restore seed, open overlay, click the Beta card. Run `control-tabflip overlay click --index 1`. Active title is `Beta TabFlip fixture`.
- **Proof of switch.** Run `control-tabflip page screenshot --path overlay-switcher/after-switch.png` and `control-tabflip tabs list`. The active title matches the card that was selected.

## Gotchas

- Playwright `page.keyboard` does not fire `chrome.commands`. Only `control-tabflip keyboard *` (xdotool) is a valid Ctrl+Q proof.
- Selected index starts at 1 (previous tab), not the current tab.
- Releasing Ctrl within the same key event as Q (a tap) is quick-toggle, not a held overlay. Keep Ctrl down until cancel or confirm.
- Auto-switch fires 2 seconds after the last Q. Capture screenshots immediately; do not sleep past that window while proving a held overlay.
- The overlay force-closes after 8 seconds. Restart the journey if it vanished.
- Content scripts do not run on `chrome://` pages. That path is [restricted-page fallback](./restricted-fallback.md), not this feature.
- Evaluating `handleCommand()` in the service worker is not proof of this feature.
