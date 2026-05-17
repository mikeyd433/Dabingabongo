#!/usr/bin/env bash
set -e

echo "==> Copying static site files..."
mkdir -p dist
cp index.html convert.html adventure.html login.html style.css songs.json adventure.json dist/ 2>/dev/null || true
[ -d images ]    && cp -r images    dist/
[ -d songs ]     && cp -r songs     dist/
[ -d adventure ] && cp -r adventure dist/

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

echo "==> Done. Output in dist/"
