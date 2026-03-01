# KroqviaRetouchry

KroqviaRetouchry is a GPLv3 open source Linux image editor built with Tauri 2, React, and Rust.

## Features in v1

- Open PNG/JPEG/WebP
- Non-destructive operation stack with undo/redo
- Crop with drag handles and numeric controls
- Transform tools: rotate, flip, resize (fit/fill/stretch)
- Adjust tools: brightness, contrast, saturation
- Debounced preview rendering (80 ms)
- Export to PNG/JPEG/WebP
- Offline-only operation (no telemetry/network)

## Keyboard shortcuts

- `Ctrl+O` open image
- `Ctrl+Shift+S` export image
- `Ctrl+Z` undo
- `Ctrl+Y` redo
- `Ctrl+0` reset zoom
- `Ctrl++` zoom in
- `Ctrl+-` zoom out

## Development

### Prerequisites

- Node.js 20+
- Rust stable
- Linux packages for Tauri builds:
  - `libwebkit2gtk-4.1-dev`
  - `libappindicator3-dev`
  - `librsvg2-dev`
  - `patchelf`

### Run locally

```bash
npm install
npm run tauri dev
```

### Tests

```bash
npm run test:run
cargo test --manifest-path src-tauri/Cargo.toml
```

### Build AppImage

```bash
npm run tauri build -- --target x86_64-unknown-linux-gnu --bundles appimage
```

AppImage output path:

`src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/appimage/`
