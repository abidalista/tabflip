---
name: verify-tabflip
description: Drive TabFlip (Chrome extension overlay + toolbar popup + chrome:// fallback) the way a user does. Use when proving tab-switcher behavior, overlay cycling, MRU order, or popup copy.
---

# Verify TabFlip

TabFlip is a Manifest V3 Chrome extension. The user-facing surface is the in-page overlay (`#tabflip-overlay`) opened by **Ctrl+Q**, plus a toolbar popup (`popup.html`) and a fallback popup window (`switcher.html`) on `chrome://` pages. There is no web server and no CLI product.

This skill launches a **disposable Chrome for Testing** profile with the unpacked checkout loaded. Do not attach to the user's everyday Chrome, and do not drive a shared profile.

Branded Chrome 137+ removed `--load-extension`. The harness uses Playwright's Chromium (Chrome for Testing), where that flag still works. Playwright `page.keyboard` does **not** fire `chrome.commands`; OS-level `xdotool` against the focused Chromium window does.

## Launch

From the repo root, with `DISPLAY` set (Cloud Agent VMs already have `:1`):

```bash
export TABFLIP_RUN_ID="${TABFLIP_RUN_ID:-$RANDOM}"
export DISPLAY="${DISPLAY:-:1}"
.cursor/skills/verify-tabflip/bin/control-tabflip launch --run-id "$TABFLIP_RUN_ID"
```

Ready when `control-tabflip doctor` prints `"ok": true` with:

- `extensionVersion` equal to `1.4.1` (from `manifest.json`)
- `commandShortcut` equal to `Ctrl+Q`
- `httpTabCount` at least `2`
- `fixtureOrigin` on `127.0.0.1`
- `overlayVisible` false

Launch starts a fixture HTTP server, Chromium with `--load-extension=<repo root>`, and seeds **Alpha / Beta / Gamma** fixture tabs (visit order Alpha → Beta → Gamma, so MRU is Gamma current, Beta previous, Alpha older). First launch may `npm install` `playwright-core` under the skill directory and download Playwright Chromium; that is verification scaffolding, not extension runtime.

Two instances can run side by side if each has its own `TABFLIP_RUN_ID` (separate `/tmp/tabflip-verify-$RUN_ID` profiles, fixture ports, and RPC ports). Never point two runs at the same profile.

Teardown:

```bash
.cursor/skills/verify-tabflip/bin/control-tabflip stop --run-id "$TABFLIP_RUN_ID"
```

## Doctor

Read-only health check. Run this first whenever anything looks off:

```bash
.cursor/skills/verify-tabflip/bin/control-tabflip doctor
```

It confirms the daemon PID is the instance this run started, the service worker answers, the loaded manifest is TabFlip `1.4.1`, `cycle-tab` is bound to `Ctrl+Q`, fixture tabs exist, and the overlay is not already stuck visible. If `ok` is false, **stop and relaunch** — do not drive a sick instance.

## Drive

Put the helper on your mental PATH as `control-tabflip` (invoke via the path above). Stable handles from this repo:

| Surface | Handle |
| --- | --- |
| Overlay root | `#tabflip-overlay` |
| Card row | `#tabflip-cards > div[data-idx="N"]` |
| Card title / host | `.tf-title` / `.tf-url` |
| Selected card | card whose computed `opacity` is `1` (selectedIndex starts at **1**, the previous tab) |
| Toolbar popup | `chrome-extension://$ID/popup.html` — `.name`, `kbd`, `a.coffee` |
| Fallback window | page titled `TabFlip` at `switcher.html`, cards `.card` / `.card.selected` / `.title` |

Keyboard (real `chrome.commands` path via xdotool):

```bash
control-tabflip keyboard open-switcher   # hold Ctrl, press Q; overlay stays up
control-tabflip keyboard cycle           # another Q while Ctrl is held
control-tabflip keyboard confirm         # release Ctrl → switch to selected tab
control-tabflip keyboard cancel          # Escape, no switch
control-tabflip keyboard tap-command     # press-and-release Ctrl+Q (quick toggle)
```

Overlay observe / click:

```bash
control-tabflip overlay state
control-tabflip overlay wait --visible
control-tabflip overlay snapshot --path overlay-switcher/overlay.snapshot.json
control-tabflip overlay screenshot --path overlay-switcher/overlay.png
control-tabflip overlay click --index 1
control-tabflip page screenshot --path overlay-switcher/page.png
```

Popup:

```bash
control-tabflip popup open
control-tabflip popup snapshot --path toolbar-popup/popup.snapshot.json
control-tabflip popup screenshot --path toolbar-popup/popup.png
```

Relative `--path` values land under `.cursor/skills/verify-tabflip/artifacts/`.

Feature recipes live in [`features/`](features/README.md). Drive the mapped entry points; do not call `handleCommand()` in the service worker as a substitute for Ctrl+Q.

## Evidence

Proof artifacts go to `.cursor/skills/verify-tabflip/artifacts/<feature-id>/` and **survive** `stop`.

Standards:

- Exercise Ctrl+Q / overlay cards / popup document the way a user does. Do not treat a service-worker `handleCommand()` eval as proof of the keyboard path.
- Capture the action **and** the resulting state: overlay screenshot while it is visible, plus a snapshot of card titles and which card is selected, plus the active tab URL after confirm or cancel.
- Side effects: confirming a card must change the active tab URL/title; cancel must leave the active tab unchanged; creating no network calls (TabFlip does not talk to the network).
- Mocks are not used. Fixture pages are local HTTP seed data so titles are deterministic; they are still real tabs the extension reads through `chrome.tabs`.
- Record the feature ID and entry point with every artifact.

## Cleanup

```bash
control-tabflip stop
```

Kills the **daemon PID recorded at launch** (that process closes the Chromium it started and the fixture server). If the browser PID is still alive after SIGTERM, the helper signals that PID only. Never `pkill -f chrome` / `chromium`.

Removes `/tmp/tabflip-verify-$RUN_ID/profile`. Does **not** delete `.cursor/skills/verify-tabflip/artifacts/`. After stop, confirm the artifacts you captured are still on disk.

Release Ctrl if a failed run left it held (`stop` sends `keyup ctrl`). If an overlay is stuck mid-run, `keyboard cancel` first.

## Helpers

`bin/control-tabflip` is executable. From repo root:

```bash
.cursor/skills/verify-tabflip/bin/control-tabflip launch
.cursor/skills/verify-tabflip/bin/control-tabflip doctor
.cursor/skills/verify-tabflip/bin/control-tabflip keyboard open-switcher
.cursor/skills/verify-tabflip/bin/control-tabflip overlay screenshot --path overlay-switcher/overlay.png
.cursor/skills/verify-tabflip/bin/control-tabflip stop
```

`npm install` and Playwright Chromium download happen inside the skill directory on first launch. `node_modules/` is gitignored. The helper is not part of the shipped extension.
