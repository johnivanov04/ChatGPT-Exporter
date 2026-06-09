#!/usr/bin/env bash
# Build a Chrome Web Store upload ZIP of the extension/ folder.
#
# Usage:   bash extension/scripts/build-zip.sh
# Output:  dist/chatvault-extension-v{version}.zip
#
# The version is read from extension/manifest.json so the filename
# always tracks the manifest.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
EXT="$ROOT/extension"
DIST="$ROOT/dist"

VERSION=$(grep -E '"version"' "$EXT/manifest.json" | head -1 | sed -E 's/.*"version": *"([^"]+)".*/\1/')
if [ -z "$VERSION" ]; then
  echo "could not read version from extension/manifest.json" >&2
  exit 1
fi

OUT="$DIST/chatvault-extension-v${VERSION}.zip"
mkdir -p "$DIST"
rm -f "$OUT"

cd "$EXT"
zip -r "$OUT" . \
  -x "scripts/*" \
  -x "scripts" \
  -x "README.md" \
  -x ".DS_Store" \
  -x "*/.DS_Store" \
  -x "*.zip" \
  > /dev/null

echo "wrote $OUT ($(du -h "$OUT" | awk '{print $1}'))"
echo
echo "Contents:"
unzip -l "$OUT" | awk 'NR>3 && !/^-+$/ && !/files$/'
