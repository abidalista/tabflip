# Quick toggle

Quick toggle lets a user tap Ctrl+Q (press and release) to jump to the previously used tab without leaving the overlay on screen.

## Sub-features

- `toggle-previous` switches from the current tab to the previous MRU tab.
- `toggle-back` tapping again returns to the original tab.
- `toggle-no-linger` does not leave `#tabflip-overlay` visible after the tap.

## How to get to it (user POV)

- Tap Ctrl+Q quickly and release both keys on a normal http(s) page with at least two tabs.

## Driving it with control-tabflip

Preconditions:

- TabFlip is healthy (`control-tabflip doctor` → `"ok": true`).
- Fixture tabs Alpha, Beta, Gamma are open. Active title is `Gamma TabFlip fixture`.
- Overlay is not visible.

- **Tap to previous.** Tap Ctrl+Q. Run `control-tabflip keyboard tap-command`. Active title becomes `Beta TabFlip fixture`. Overlay is not visible.
- **Tap back.** Tap Ctrl+Q again. Run `control-tabflip keyboard tap-command`. Active title returns to `Gamma TabFlip fixture`.
- **Proof.** Run `control-tabflip page screenshot --path quick-toggle/after-tap.png` and `control-tabflip overlay snapshot --path quick-toggle/overlay.snapshot.json`. The page shows Beta or Gamma as asserted, and the snapshot has `"visible": false`.

## Gotchas

- A held Ctrl (open-switcher) is a different feature. If the overlay stays visible, the tap released too slowly — cancel and retry.
- Auto-switch at 2s can also confirm a held overlay. That is not a tap.
- One tab only: the command is a no-op (see [MRU order and cap](./mru-and-cap.md)).
