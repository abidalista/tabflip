# MRU order and cap

TabFlip shows at most five tabs for the current window, ordered by most-recently-used, and does nothing useful when only one tab exists.

## Sub-features

- `mru-order` lists current, then previous, then older tabs.
- `mru-cap` shows exactly two / three cards for two / three tabs, and caps at five when more exist.
- `mru-single` with one tab does not show the overlay.
- `mru-closed` drops a closed tab from the next overlay.
- `mru-previews` shows a screenshot on a card after that tab has been visited, or a letter placeholder if not.

## How to get to it (user POV)

- Visit tabs in a known order, then hold Ctrl+Q.
- Close a tab that was in the list, then reopen the overlay.
- Open a sixth tab, visit it, then open the overlay.

## Driving it with control-tabflip

Preconditions:

- TabFlip is healthy (`control-tabflip doctor` → `"ok": true`).

- **Three-tab order.** Seed three fixtures. Run `control-tabflip tabs seed --count 3`, activate Gamma, then `control-tabflip keyboard open-switcher`. Card titles in order are `Gamma TabFlip fixture`, `Beta TabFlip fixture`, `Alpha TabFlip fixture`. Selected is Beta.
- **Five-tab cap.** Seed five fixtures. Run `control-tabflip tabs seed --count 5` then `keyboard open-switcher`. `cardCount` is `5`. Titles include Epsilon (current) and do not grow past five.
- **Two tabs.** Seed by closing down to Alpha and Beta only, open the overlay. `cardCount` is `2`.
- **Single tab.** Leave only Alpha. Run `control-tabflip keyboard open-switcher` and expect a failure to become visible (command no-op). Overlay stays hidden. Record that as the proven empty path, not a harness bug.
- **Closed tab.** From a three-tab seed, close Beta, open the overlay. No card title is `Beta TabFlip fixture`.
- **Proof.** Snapshot and screenshot each asserted overlay to `mru-and-cap/<case>.snapshot.json` and `mru-and-cap/<case>.png`.

## Gotchas

- Screenshots are captured ~800ms after a tab becomes active. Opening the overlay immediately after a visit can still show a letter placeholder. Wait, or treat a placeholder as valid for a never-shown tab.
- MRU is per window. Extra Chromium windows from a previous failed run invalidate order — `stop` and relaunch.
- `tabs seed --count 5` visits Alpha through Epsilon in that order. Do not invent a different visit sequence and still assert the baseline order.
