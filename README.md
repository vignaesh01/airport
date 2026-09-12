# Airport

Airport is a desktop app for running Claude Code, Codex, Devin, and other AI coding agents side by side in organized terminal sessions.

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- On Linux only: a C/C++ toolchain (`build-essential`, `python3`) — `node-pty` ships prebuilt native binaries for Windows and macOS (x64/arm64), but not Linux, so it compiles from source there during `npm install`.

## Getting started

```sh
npm install
npm run dev
```

Other useful scripts:

```sh
npm run build      # build the app for production
npm test           # run the test suite
npm run typecheck  # type-check the main and renderer processes
```

## Packaging a release

Airport is distributed as a plain zip/tar.gz per platform (no installer, no npm publish), built with [electron-builder](https://www.electron.build/):

```sh
npm run dist:win     # produces dist/*.zip  (Windows)
npm run dist:mac     # produces dist/*.zip  (macOS)
npm run dist:linux   # produces dist/*.tar.gz (Linux)
```

You can only build for the platform you're on (macOS builds require a Mac). Pushing a `v*` tag runs `.github/workflows/release.yml`, which builds all three platforms on GitHub-hosted runners and drops a draft GitHub Release with the artifacts attached — use this instead of trying to cross-build locally.

The output is unsigned. On first run, expect Windows SmartScreen and macOS Gatekeeper warnings ("Windows protected your PC" / "app is damaged" — on Mac, right-click → Open, or run `xattr -cr Airport.app`).
