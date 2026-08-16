# Running in a browser (Codespaces, or any machine without a desktop)

`npm start` launches the real Electron desktop app. That needs a GUI stack, so in a
browser-based Codespace it fails with:

```
electron: error while loading shared libraries: libatk-1.0.so.0: cannot open shared object file
```

Two ways forward, depending on what you need.

## 1. Browser preview — recommended for demos

```bash
npm run dev:web
```

Codespaces forwards port 5173 and the preview opens at `/`. No Electron, no display, no
VNC.

`dev/web/mock-bridge.ts` stands in for the Electron preload bridge. **Only persistence is
faked** — reconciliation, metrics, and the anomaly check run the real domain code against
the real fixtures, so what you see matches the desktop app. Differences:

| | Desktop (`npm start`) | Browser preview (`npm run dev:web`) |
| --- | --- | --- |
| Reconciliation, metrics, anomaly | real | real (same code) |
| Runs, reviews, comments, mismatch reasons | SQLite | `localStorage`, survives reload |
| Verified report | writes an `.xlsx` | reports a path, writes no file |

To clear preview state, run `localStorage.clear()` in the browser console.

## 2. The real Electron app over noVNC

`.devcontainer/` installs Electron's runtime libraries and a lightweight desktop. Rebuild
the container (**Dev Containers: Rebuild Container**), then:

```bash
npm run start:codespace
```

Open the forwarded port **6080** to watch the window (password `vscode`). This is the only
option that exercises SQLite and real workbook output.

Use `start:codespace` rather than `start`: it adds `--no-sandbox`, because Chromium's SUID
sandbox helper needs privileges a Codespaces container does not grant. Plain `npm start`
is still the right command on a normal desktop.

The desktop starts with the container. If port 6080 shows nothing, start it by hand with
`sudo /usr/local/share/desktop-init.sh`.

If you would rather not rebuild the container, install the libraries into the running one:

```bash
bash .devcontainer/install-electron-deps.sh
```

That alone fixes the `libatk-1.0.so.0` error, but Electron still needs a display — either
use the desktop feature above or run it headless with `xvfb-run -a npm start`.
