# Toolbar popup

The toolbar popup tells the user how TabFlip works: the name, the Ctrl+Q shortcuts, a tip about tab previews, and a coffee link.

## Sub-features

- `popup-open` opens the action popup document.
- `popup-shortcuts` shows three shortcut rows for open, cycle, and release.
- `popup-tip` shows the tab-preview tip.
- `popup-coffee` exposes the buy-me-a-coffee link with `target=_blank`.

## How to get to it (user POV)

- Click the TabFlip icon in the Chrome toolbar.

## Driving it with control-tabflip

Preconditions:

- TabFlip is healthy (`control-tabflip doctor` → `"ok": true`).
- No need to mutate fixture tabs.

- **Open popup.** Open the action popup document. Run `control-tabflip popup open`. The page URL ends with `/popup.html`. An element `.name` reads `TabFlip`.
- **Shortcuts.** Read the three rows. Run `control-tabflip popup snapshot --path toolbar-popup/popup.snapshot.json`. The snapshot `shortcuts` list contains labels `open switcher`, `cycle tabs`, and `switch to tab`, and the keys mention `Ctrl` and `Q`.
- **Tip.** The snapshot `tip` is `Tip: Tab previews load after you visit each tab once.`
- **Coffee link.** The snapshot `coffeeHref` is `https://buymeacoffee.com/abidalista` and `coffeeTarget` is `_blank`. Do not navigate that URL as proof — asserting the href is enough and avoids a production third-party hit.
- **Proof.** Run `control-tabflip popup screenshot --path toolbar-popup/popup.png`. The screenshot shows the TabFlip name, shortcut rows, tip, and coffee link.

## Gotchas

- This recipe opens `chrome-extension://$ID/popup.html`, the same document as the toolbar action. It does not click the browser-chrome puzzle-piece menu. If a run needs the real toolbar click and `popup open` is insufficient, report that entry point unreached rather than claiming the icon was clicked.
- Do not rewrite or visit the coffee URL as a "fix".
