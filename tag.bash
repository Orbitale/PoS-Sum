#!/usr/bin/env bash

set -e

tag=$(echo "$1" | sed 's/^v//g')

sed -i -E "s~^version *= *\"[^\"]*\"~version = \"$tag\"~gi" ./src-tauri/Cargo.toml
sed -i -E "s~^\"version\" *: *\"[^\"]*\"~\"version\": \"$tag\"~gi" ./src-tauri/Cargo.toml
json=$(cat package.json)
echo "$json" | jq ".version=\"$tag\"" | sed 's/  /\t/g' > package.json
pnpm tauri build

echo "v$tag-dev" > release-name
git add .
git cm -m "v$tag" --allow-empty
git tag -m "v$tag" "v$tag"
git push origin main --tags
gh release create "v$tag" --prerelease --title "v$tag" --notes ""
