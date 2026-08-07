# TabFlip

Arc-style tab switcher for Chrome. Cycle through your 5 most recent tabs with visual previews using a keyboard shortcut.

## How it works

1. **Hold Ctrl and press Q** — the switcher overlay appears on the page
2. **Keep holding Ctrl, press Q again (or use the arrow keys)** — cycle through your recent tabs
3. **Add Shift** (`Ctrl+Shift+Q`) — cycle backward instead
4. **Release Ctrl** — switch to the selected tab
5. **Enter** or click a card — switch immediately, without releasing
6. **Esc** — cancel

Arrow keys (`←`/`→`/`↑`/`↓`) work as soon as the overlay is open and don't require holding `Ctrl` — only releasing `Ctrl` (or pressing `Enter`/clicking) actually switches.

Tab previews (screenshots) load automatically after you visit each tab once.

## Install

### Chrome Web Store
Coming soon.

### Manual (developer mode)
1. Clone or download this repo
2. Go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the `tabflip` folder
5. Open a few tabs, click through them, then try **Ctrl+Q**

## Notes

- Works on any website. On `chrome://` pages (where Chrome blocks extensions), a fallback popup window is used instead.
- Shows your 5 most recently used tabs per window.
- Screenshots are captured in the background as you browse — JPEG, quality 50, stored in memory only.
- No data leaves your browser. No analytics, no tracking, no external requests.
- **"Leave switcher open on release"** (in the popup): off by default, so release always switches immediately as described above. Turn it on if you'd rather browse the cards without releasing `Ctrl` triggering a switch, and confirm explicitly with `Enter` or a click instead.

## Shortcut

| OS      | Shortcut        | Cycle backward   |
|---------|-----------------|------------------|
| Mac     | `Ctrl+Q`        | `Ctrl+Shift+Q`   |
| Windows | `Ctrl+Q`        | `Ctrl+Shift+Q`   |
| Linux   | `Ctrl+Q`        | `Ctrl+Shift+Q`   |

You can rebind either shortcut at `chrome://extensions/shortcuts` — any modifier (`Ctrl`, `Alt`, or `Command`/`MacCtrl`) plus any key. Whichever modifier you choose, release still triggers the switch.

**Known limitation**: on some Brave configurations, repeated presses of the activation key can intermittently fail to register — this is caused by an occasional Chromium/Brave quirk where the browser briefly reports the wrong active tab (most likely tied to service-worker wake timing), not by anything specific to a chosen shortcut. It resolves itself in a press or two. Arrow keys aren't affected — they cycle entirely within the page and are the more reliable option if you hit this.

## Files

```
manifest.json      — Extension config (Manifest V3)
background.js      — Service worker: MRU tracking, screenshots, command handling
content.js         — Overlay UI injected into web pages (all styles inline)
switcher.html/js   — Fallback popup window for chrome:// pages
popup.html/js/css  — Extension icon popup with shortcut instructions and settings
styles.css         — Legacy (unused, kept for reference)
icons/             — 16, 48, 128px extension icons
```

## Privacy

TabFlip runs entirely in your browser. It does not collect, transmit, or store any personal data. See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## Support

[Buy me a coffee](https://buymeacoffee.com/abidalista)

## License

MIT
