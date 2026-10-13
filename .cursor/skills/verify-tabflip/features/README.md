# TabFlip verification map

This directory is the maintained source for verifying the user-facing behavior of TabFlip. Read the index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch TabFlip with `control-tabflip launch --run-id $TABFLIP_RUN_ID` so Chromium uses `/tmp/tabflip-verify-$TABFLIP_RUN_ID/profile`.
- Seed fixture tabs **Alpha TabFlip fixture**, **Beta TabFlip fixture**, and **Gamma TabFlip fixture** (launch already does this). MRU order after seed is Gamma (current), Beta, Alpha.
- Put `control-tabflip` on PATH or invoke `.cursor/skills/verify-tabflip/bin/control-tabflip`.
- Run `control-tabflip doctor` and require `"ok": true`, version `1.4.1`, shortcut `Ctrl+Q`, and `overlayVisible` false.
- `DISPLAY` must point at a real X session (`:1` on Cloud Agent). Headed Chromium is required; `xdotool` sends Ctrl+Q.
- Never drive a Chrome instance that was not started by this verification run.

## Driving conventions

- Start every recipe from the baseline state unless its preconditions say otherwise.
- Prefer `#tabflip-overlay`, `#tabflip-cards > div[data-idx]`, `.tf-title`, `.name`, and `a.coffee` over coordinates.
- Treat every command as literal. Keep quoted titles and flags unchanged.
- Run overlay and tab actions through `control-tabflip keyboard` / `overlay` / `tabs`.
- Restore seeded tabs (re-run `control-tabflip tabs seed --count 3`) after a mutation. Do not remove proof artifacts during cleanup.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- Overlay proof includes a JSON snapshot (`overlay snapshot`) and a screenshot with fixture titles visible.
- Popup proof includes the rendered name, shortcut rows, tip, and coffee `href`.
- Mutation proof includes the active tab URL/title after confirm or cancel.
- Record the feature ID and entry point used with every artifact.
- Report an unreachable path with the attempted command and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with <harness>` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Overlay switcher](./overlay-switcher.md) covers Ctrl+Q open, cycle, confirm, cancel, and click-to-switch.
- [Quick toggle](./quick-toggle.md) covers tap-and-release Ctrl+Q swapping to the previous tab.
- [Toolbar popup](./toolbar-popup.md) covers the action popup copy, shortcuts, tip, and coffee link.
- [Restricted-page fallback](./restricted-fallback.md) covers the `switcher.html` window on `chrome://` pages.
- [MRU order and cap](./mru-and-cap.md) covers recency order, the five-tab cap, and the single-tab no-op.
