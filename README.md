# Airport

A cross-platform desktop app for running multiple AI coding agents in managed terminal tabs.

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- On Windows: [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the "Desktop development with C++" workload installed. This is required to rebuild the native `node-pty` module during `npm install`.

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
