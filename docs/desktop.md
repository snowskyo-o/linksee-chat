# Desktop Shell

## Current State

The project now includes a minimal Electron shell in `apps/desktop`.

- `main.cjs`: starts the local API server and opens a browser window
- `preload.cjs`: exposes a tiny safe bridge for desktop metadata

## Development Command

```bash
npm run dev:desktop
```

This command:

1. builds the Vue frontend
2. launches the local API server through Electron
3. opens `http://127.0.0.1:3010/chat/login.html` inside a desktop window

## Next Recommended Desktop Work

- add app icon and product metadata
- add window state persistence
- add tray / notification support
- add packaging workflow
- optionally evaluate Tauri later for smaller bundle size
