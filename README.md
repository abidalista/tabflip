# TabFlip

Arc-style tab switcher for Chrome. Cycle through your 5 most recent tabs with visual previews using a single shortcut.

## How it works

1. **Hold Ctrl and press Q** — the switcher overlay appears on the page
2. **Keep holding Ctrl, press Q again** — cycle through your recent tabs
3. **Release Ctrl** — switch to the selected tab
4. **Esc** — cancel

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

## Shortcut

| OS      | Shortcut        |
|---------|-----------------|
| Mac     | `Ctrl+Q`        |
| Windows | `Ctrl+Q`        |
| Linux   | `Ctrl+Q`        |

You can change the shortcut at `chrome://extensions/shortcuts`.

## Files

```
manifest.json    — Extension config (Manifest V3)
background.js    — Service worker: MRU tracking, screenshots, command handling
content.js       — Overlay UI injected into web pages (all styles inline)
switcher.html/js — Fallback popup window for chrome:// pages
popup.html/css   — Extension icon popup with shortcut instructions
styles.css       — Legacy (unused, kept for reference)
icons/           — 16, 48, 128px extension icons
```

## Privacy

TabFlip runs entirely in your browser. It does not collect, transmit, or store any personal data. See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## Support

[Buy me a coffee](https://buymeacoffee.com/abidalista)

## License

MIT
