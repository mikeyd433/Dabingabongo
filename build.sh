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

echo "==> Building The Delve (separate repo, pnpm)..."
# The Delve's source lives in its own repo — mikeyd433/PhoneDungeonBuilder — but
# it is served from this site at /delve, so it is fetched and built here rather
# than proxied from a second Netlify site. The repo is public, so no deploy key
# or token is needed.
#
# Cloned fresh each build rather than vendored as a submodule: a submodule would
# need a pointer-bump commit here every time The Delve changes, which is easy to
# forget and shows up as "I pushed but nothing deployed".
#
# The whole block is non-fatal on purpose. This site is mostly a music archive,
# and a broken commit in The Delve must not stop downloads.html and the song
# pages from deploying. A failed Delve build leaves the previous /delve in place.
(
  set -e
  rm -rf .delve-src
  # Defaults to main. Set DELVE_REF in the Netlify UI to build a branch instead
  # — needed until the build branch is merged, since main has no app on it yet.
  git clone --depth 1 --branch "${DELVE_REF:-main}" \
    https://github.com/mikeyd433/PhoneDungeonBuilder.git .delve-src
  cd .delve-src
  if ! command -v pnpm >/dev/null 2>&1; then
    corepack enable || npm install -g pnpm@10.33.0
  fi
  pnpm install --frozen-lockfile
  pnpm build
  cd ..
  mkdir -p dist/delve
  cp -r .delve-src/dist/. dist/delve/
  rm -rf .delve-src
) || echo "!! The Delve failed to build — skipping it and deploying the rest of the site."

echo "==> Done. Output in dist/"
