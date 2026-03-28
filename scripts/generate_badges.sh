#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INPUT_DIR="$ROOT_DIR/original"
OUT_PUBLIC_BASE="$ROOT_DIR/public/badges"
OUT_TRANSPARENT="$ROOT_DIR/.tmp/badges/transparent"
OUT_MASTER="$ROOT_DIR/assets/badges/master"
OUT_64="$OUT_PUBLIC_BASE/64"
OUT_32="$OUT_PUBLIC_BASE/32"

mkdir -p "$OUT_TRANSPARENT" "$OUT_MASTER" "$OUT_64" "$OUT_32"

to_output_name() {
  local filename="$1"
  local stem="${filename%.png}"

  if [[ "$stem" =~ ^secret_(.+)$ ]]; then
    echo "badge_secret_${BASH_REMATCH[1]}.png"
    return 0
  fi

  if [[ "$stem" =~ ^subject_master_([a-z]+)_([0-9]+)$ ]]; then
    echo "badge_subject_master_${BASH_REMATCH[1]}_l${BASH_REMATCH[2]}.png"
    return 0
  fi

  if [[ "$stem" =~ ^([a-z_]+)_([0-9]+)$ ]]; then
    echo "badge_${BASH_REMATCH[1]}_l${BASH_REMATCH[2]}.png"
    return 0
  fi

  return 1
}

processed=0
failed=0

shopt -s nullglob
for src in "$INPUT_DIR"/*.png; do
  base="$(basename "$src")"

  if ! out_name="$(to_output_name "$base")"; then
    echo "[WARN] skip (unknown naming): $base"
    failed=$((failed + 1))
    continue
  fi

  width="$(magick identify -format '%w' "$src" 2>/dev/null || true)"
  height="$(magick identify -format '%h' "$src" 2>/dev/null || true)"
  if [[ -z "$width" || -z "$height" ]]; then
    echo "[ERROR] identify failed: $base"
    failed=$((failed + 1))
    continue
  fi

  max_x=$((width - 1))
  max_y=$((height - 1))

  transparent_path="$OUT_TRANSPARENT/$out_name"
  master_path="$OUT_MASTER/$out_name"
  out64_path="$OUT_64/$out_name"
  out32_path="$OUT_32/$out_name"

  if ! magick "$src" \
    -alpha set \
    -fuzz 12% \
    -fill none -draw "color 0,0 floodfill" \
    -fill none -draw "color ${max_x},0 floodfill" \
    -fill none -draw "color 0,${max_y} floodfill" \
    -fill none -draw "color ${max_x},${max_y} floodfill" \
    -trim +repage \
    "$transparent_path"; then
    echo "[ERROR] transparent failed: $base"
    failed=$((failed + 1))
    continue
  fi

  if ! magick "$transparent_path" \
    -resize 480x480 \
    -gravity center \
    -background none \
    -extent 512x512 \
    "$master_path"; then
    echo "[ERROR] master failed: $base"
    failed=$((failed + 1))
    continue
  fi

  if ! magick "$master_path" -resize 64x64 "$out64_path"; then
    echo "[ERROR] 64px failed: $base"
    failed=$((failed + 1))
    continue
  fi

  if ! magick "$master_path" -resize 32x32 "$out32_path"; then
    echo "[ERROR] 32px failed: $base"
    failed=$((failed + 1))
    continue
  fi

  processed=$((processed + 1))
  echo "[OK] $base -> $out_name"
done

echo "processed=$processed failed=$failed"
