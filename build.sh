#!/usr/bin/env bash
set -e

echo "==> Copying static site files..."
mkdir -p dist
cp index.html convert.html adventure.html login.html downloads.html style.css songs.json adventure.json downloads.json dist/ 2>/dev/null || true
[ -d images ]     && cp -r images     dist/
[ -d downloads ]  && cp -r downloads  dist/
[ -d songs ]      && cp -r songs      dist/
[ -d adventure ]  && cp -r adventure  dist/
[ -d touchsynth ] && cp -r touchsynth dist/

echo "==> Building React brainstorm app..."
cd brainstorm
npm install
npm run build
cd ..

echo "==> Building React harmony app..."
cd harmony
npm install
npm run build
cd ..

echo "==> Building Stroke Off app (pnpm)..."
cd strokeoff
# Stroke Off uses pnpm (see packageManager in package.json). Netlify's build image
# ships corepack with Node; enable it so the pinned pnpm is on PATH. Falls back to a
# global install if corepack can't be enabled. Vite emits straight to ../dist/strokeoff.
if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable || npm install -g pnpm@10.33.0
fi
pnpm install --frozen-lockfile
pnpm build
cd ..

echo "==> Done. Output in dist/"
