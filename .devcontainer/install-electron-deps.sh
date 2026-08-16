#!/usr/bin/env bash
# Electron ships its own Chromium but links against the host's GTK/X11 stack. A stock
# Codespaces container has none of it, which surfaces as:
#   electron: error while loading shared libraries: libatk-1.0.so.0: cannot open shared object file
#
# Package names differ across Debian/Ubuntu releases (the ...t64 variants landed with the
# 64-bit time_t transition), so each candidate is tried and only genuinely missing ones fail.
set -euo pipefail

sudo apt-get update

# Present under the same name on every current release.
sudo apt-get install -y --no-install-recommends \
  libnss3 \
  libxss1 \
  libxtst6 \
  libgbm1 \
  libdrm2 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libxkbcommon0 \
  libpango-1.0-0 \
  libcairo2 \
  libx11-xcb1 \
  libsecret-1-0 \
  xdg-utils

# Renamed between releases: install whichever name this release actually provides.
for pkg in libatk1.0-0 libatk-bridge2.0-0 libatspi2.0-0 libgtk-3-0 libcups2 libasound2; do
  if ! sudo apt-get install -y --no-install-recommends "$pkg" 2>/dev/null; then
    sudo apt-get install -y --no-install-recommends "${pkg}t64"
  fi
done

echo "Electron runtime libraries installed."
