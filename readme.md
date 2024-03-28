### M3U8 Downloader
Yet another m3u8 downloader built with vue3/vite, element-plus & electron.

#### Dependencies
- Vite 5+: Node 18+ is required, and CJS Node API is deprecated.
- Electron 28+: It enables ESM support.
- `patch-package` is used to workaround a `fluent-ffmpeg` path resolve bug.

#### Notes
- `NODE_ENV` is a node environment variable, see [here](https://nodejs.org/en/learn/getting-started/nodejs-the-difference-between-development-and-production).
- Vite has a similar but different `mode` concept, see [here](https://vitejs.dev/guide/env-and-mode.html#node-env-and-modes).
- In development environment, esbuild is used for:
  - pre-bundle dependencies to convert them to ESM.
  - transpile typescript to javascript, so that HMR can reflect in the browser.
  - ESM are requested and loaded directly in browsers.
  - see [here](https://vitejs.dev/guide/features).
- In production environment, rollup is used for bundling for its flexibility. see [here](https://vitejs.dev/guide/why.html#why-not-bundle-with-esbuild).
