#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_DIR="$PROJECT_ROOT/notifier"
NODE_MAJOR=20

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "Please run this script with sudo so it can install system packages." >&2
  exit 1
fi

command -v apt-get >/dev/null 2>&1 || {
  echo "This script currently supports Debian-based systems with apt-get (e.g., Raspberry Pi OS)." >&2
  exit 1
}

echo "Updating package index..."
apt-get update

echo "Installing base utilities..."
apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  gnupg \
  lsb-release

echo "Setting up NodeSource repository for Node.js ${NODE_MAJOR}."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
fi

echo "Installing Node.js and npm..."
apt-get install -y --no-install-recommends nodejs

echo "Installing Chromium (or chromium-browser) and libraries required by Puppeteer..."
if ! apt-get install -y --no-install-recommends chromium; then
  apt-get install -y --no-install-recommends chromium-browser
fi

apt-get install -y --no-install-recommends \
  fonts-liberation \
  libasound2 \
  libatk1.0-0 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgbm1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  xdg-utils

if [ ! -d "$APP_DIR" ]; then
  echo "Cannot find application directory at $APP_DIR." >&2
  exit 1
fi

OWNER="${SUDO_USER:-root}"

if [ "$OWNER" = "root" ]; then
  INSTALL_USER="root"
  INSTALL_HOME="/root"
else
  INSTALL_USER="$OWNER"
  INSTALL_HOME="$(eval echo "~$OWNER")"
fi

echo "Installing Node.js dependencies with npm..."
sudo -u "$INSTALL_USER" HOME="$INSTALL_HOME" npm install --prefix "$APP_DIR"

echo "All dependencies installed successfully."
