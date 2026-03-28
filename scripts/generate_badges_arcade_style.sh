#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INPUT_DIR="$ROOT_DIR/original"
OUT_SVG_DIR="$ROOT_DIR/assets/badges/arcade_style/svg"
OUT_PUBLIC_SVG_DIR="$ROOT_DIR/public/badges-arcade/svg"
OUT_64_DIR="$ROOT_DIR/public/badges-arcade/64"
GENERATE_PNG="${GENERATE_PNG:-0}"

mkdir -p "$OUT_SVG_DIR" "$OUT_PUBLIC_SVG_DIR" "$OUT_64_DIR"

to_output_name() {
  local filename="$1"
  local stem="${filename%.png}"

  if [[ "$stem" =~ ^secret_(.+)$ ]]; then
    echo "badge_secret_${BASH_REMATCH[1]}"
    return 0
  fi

  if [[ "$stem" =~ ^subject_master_([a-z]+)_([0-9]+)$ ]]; then
    echo "badge_subject_master_${BASH_REMATCH[1]}_l${BASH_REMATCH[2]}"
    return 0
  fi

  if [[ "$stem" =~ ^([a-z_]+)_([0-9]+)$ ]]; then
    echo "badge_${BASH_REMATCH[1]}_l${BASH_REMATCH[2]}"
    return 0
  fi

  return 1
}

set_level_palette() {
  local level="$1"
  case "$level" in
    1)
      LV_MAIN="#3DDCBE"; LV_DARK="#0E8A74"; LV_LIGHT="#C7FFF3"; LV_SYMBOL="#064E3B"; LV_MARK="#34D399" ;;
    2)
      LV_MAIN="#1DB8D6"; LV_DARK="#166E9A"; LV_LIGHT="#D6F6FF"; LV_SYMBOL="#0C4A6E"; LV_MARK="#38BDF8" ;;
    3)
      LV_MAIN="#B8C5DD"; LV_DARK="#62708E"; LV_LIGHT="#EEF4FF"; LV_SYMBOL="#334155"; LV_MARK="#94A3B8" ;;
    4)
      LV_MAIN="#FFCB54"; LV_DARK="#B06B00"; LV_LIGHT="#FFF3B8"; LV_SYMBOL="#92400E"; LV_MARK="#F59E0B" ;;
    5)
      LV_MAIN="#A855F7"; LV_DARK="#5B21B6"; LV_LIGHT="#F3E8FF"; LV_SYMBOL="#3B0764"; LV_MARK="#C084FC" ;;
    *)
      LV_MAIN="#B8C5DD"; LV_DARK="#62708E"; LV_LIGHT="#EEF4FF"; LV_SYMBOL="#334155"; LV_MARK="#94A3B8" ;;
  esac
}

set_family_symbol() {
  local family="$1"
  case "$family" in
    streak_days)
      SYMBOL='<path d="M34 18 L25 34 H33 L28 46 L41 30 H33 Z"/>' ;;
    genre_explorer)
      SYMBOL='<path d="M32 18 L37 30 L32 27 L27 30 Z"/><circle cx="32" cy="31" r="8" fill="none" stroke="currentColor" stroke-width="2.6"/>' ;;
    perfect_sessions)
      SYMBOL='<path d="M24 32 L30 38 L41 25" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>' ;;
    subject_master_math)
      SYMBOL='<path d="M24 24 H30 M27 21 V27" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M34 24 H40" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M24 37 L30 31 M30 37 L24 31" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M34 34 H40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="37" cy="30.6" r="1.1" fill="currentColor"/><circle cx="37" cy="37.4" r="1.1" fill="currentColor"/>' ;;
    subject_master_science)
      SYMBOL='<path d="M30 18 V26 L24 40 C23 42.5 24.5 44 27 44 H37 C39.5 44 41 42.5 40 40 L34 26 V18" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M26 36 H38" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="29" cy="32" r="1.3" fill="currentColor"/><circle cx="35" cy="34" r="1.1" fill="currentColor"/>' ;;
    subject_master_social)
      SYMBOL='<circle cx="32" cy="30" r="8" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M24 30 H40 M32 22 C35 24 35 36 32 38 C29 36 29 24 32 22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M26 26 C28 27.3 36 27.3 38 26 M26 34 C28 32.7 36 32.7 38 34" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>' ;;
    subject_master_japanese)
      SYMBOL='<path d="M22 24 H42" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><path d="M27 18 V44" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><path d="M35 24 C39 26 41 30 41 35 C41 41 36 44 31 44 C27 44 24 41 24 37 C24 33 27 30 31 30 C34 30 37 32 37 35 C37 38 35 40 32 40 C30 40 28.5 39 27.8 37.2" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>' ;;
    secret_comeback)
      SYMBOL='<polygon points="32,18 35.5,28.5 46,32 35.5,35.5 32,46 28.5,35.5 18,32 28.5,28.5" fill="currentColor"/><polygon points="46,19 47.4,23.1 51.5,24.5 47.4,25.9 46,30 44.6,25.9 40.5,24.5 44.6,23.1" fill="currentColor"/><polygon points="22,41 23.4,45.1 27.5,46.5 23.4,47.9 22,52 20.6,47.9 16.5,46.5 20.6,45.1" fill="currentColor"/>' ;;
    secret_perfect_recovery)
      SYMBOL='<path d="M32 22 V40 M23 31 H41" fill="none" stroke="currentColor" stroke-width="4.6" stroke-linecap="round"/><circle cx="32" cy="31" r="11" fill="none" stroke="currentColor" stroke-width="3.2"/>' ;;
    *)
      SYMBOL='<circle cx="32" cy="31" r="10" fill="none" stroke="currentColor" stroke-width="3.2"/>' ;;
  esac
}

petal_layer() {
  local cx="$1"
  local cy="$2"
  local ring="$3"
  local r="$4"
  local fill="$5"
  cat <<EOF
<circle cx="$cx" cy="$cy" r="$r" fill="$fill"/>
<circle cx="$((cx+ring))" cy="$cy" r="$r" fill="$fill"/>
<circle cx="$((cx-ring))" cy="$cy" r="$r" fill="$fill"/>
<circle cx="$cx" cy="$((cy+ring))" r="$r" fill="$fill"/>
<circle cx="$cx" cy="$((cy-ring))" r="$r" fill="$fill"/>
<circle cx="$((cx+10))" cy="$((cy+10))" r="$r" fill="$fill"/>
<circle cx="$((cx-10))" cy="$((cy+10))" r="$r" fill="$fill"/>
<circle cx="$((cx+10))" cy="$((cy-10))" r="$r" fill="$fill"/>
<circle cx="$((cx-10))" cy="$((cy-10))" r="$r" fill="$fill"/>
EOF
}

frame_default() {
  cat <<EOF
<g>
  $(petal_layer 32 32 14 13 "#101418")
</g>
<g>
  $(petal_layer 32 32 14 11.2 "#FFFFFF")
</g>
<g>
  $(petal_layer 32 32 14 9.8 "url(#g_${out_stem})")
</g>
<path d="M23 16 C23 12 26 9 29 8 C30 11 31 12 32 14 C33 12 34 11 35 8 C38 9 41 12 41 16 C39 18 37 20 32 20 C27 20 25 18 23 16 Z" fill="#101418"/>
<path d="M24 16 C24 12.8 26.4 10.3 29 9.4 C30 11.7 31 13 32 14.9 C33 13 34 11.7 35 9.4 C37.6 10.3 40 12.8 40 16 C38.4 17.7 36.4 19.2 32 19.2 C27.6 19.2 25.6 17.7 24 16 Z" fill="#FFFFFF"/>
<path d="M25 16 C25 13.4 27 11.4 29 10.8 C30 13 31.2 14.2 32 16 C32.8 14.2 34 13 35 10.8 C37 11.4 39 13.4 39 16 C37.6 17.4 35.8 18.5 32 18.5 C28.2 18.5 26.4 17.4 25 16 Z" fill="url(#g_${out_stem})"/>
EOF
}

frame_perfect_sessions() {
  cat <<EOF
<path d="M32 4 L52 14 L57 35 L44 53 L20 53 L7 35 L12 14 Z" fill="#101418"/>
<path d="M32 7 L49 16 L53 34 L42 50 L22 50 L11 34 L15 16 Z" fill="#FFFFFF"/>
<path d="M32 10 L46 18 L49 33 L40 47 L24 47 L15 33 L18 18 Z" fill="url(#g_${out_stem})"/>
<path d="M32 11 L36 17 L43 18 L38 23 L39 30 L32 27 L25 30 L26 23 L21 18 L28 17 Z" fill="#FFFFFF" opacity="0.35"/>
EOF
}

frame_subject_master() {
  cat <<EOF
<path d="M32 4 L52 12 V28 C52 41 44 50 32 56 C20 50 12 41 12 28 V12 Z" fill="#101418"/>
<path d="M32 7 L49 14 V28 C49 39 42 47 32 52 C22 47 15 39 15 28 V14 Z" fill="#FFFFFF"/>
<path d="M32 10 L46 16 V28 C46 37 40 44 32 48 C24 44 18 37 18 28 V16 Z" fill="url(#g_${out_stem})"/>
<path d="M24 16 C24 12.8 26.4 10.3 29 9.4 C30 11.7 31 13 32 14.9 C33 13 34 11.7 35 9.4 C37.6 10.3 40 12.8 40 16 C38.4 17.7 36.4 19.2 32 19.2 C27.6 19.2 25.6 17.7 24 16 Z" fill="#FFFFFF" opacity="0.85"/>
EOF
}

level_marks() {
  local level="$1"
  local out=""
  local i
  local x=20
  for i in 1 2 3 4 5; do
    if (( i <= level )); then
      out="${out}<circle cx=\"${x}\" cy=\"54\" r=\"2.1\" fill=\"${LV_MARK}\" stroke=\"#111827\" stroke-width=\"0.7\"/>"
    else
      out="${out}<circle cx=\"${x}\" cy=\"54\" r=\"2.1\" fill=\"#FFFFFF\" opacity=\"0.7\" stroke=\"#111827\" stroke-width=\"0.7\"/>"
    fi
    x=$((x + 6))
  done
  echo "$out"
}

l5_effect() {
  local level="$1"
  if (( level == 5 )); then
    cat <<EOF
<g stroke="#E9D5FF" stroke-width="1.6" stroke-linecap="round" opacity="0.9">
  <line x1="32" y1="3" x2="32" y2="8"/>
  <line x1="54" y1="12" x2="50" y2="15"/>
  <line x1="60" y1="32" x2="55" y2="32"/>
  <line x1="54" y1="52" x2="50" y2="49"/>
  <line x1="10" y1="12" x2="14" y2="15"/>
  <line x1="4" y1="32" x2="9" y2="32"/>
  <line x1="10" y1="52" x2="14" y2="49"/>
</g>
<g fill="#F5D0FE" stroke="#6B21A8" stroke-width="0.6">
  <polygon points="48,8 49,10 51,10.2 49.5,11.6 49.9,13.6 48,12.6 46.1,13.6 46.5,11.6 45,10.2 47,10"/>
  <polygon points="16,8 17,10 19,10.2 17.5,11.6 17.9,13.6 16,12.6 14.1,13.6 14.5,11.6 13,10.2 15,10"/>
</g>
EOF
  fi
}

processed=0
failed=0

shopt -s nullglob
for src in "$INPUT_DIR"/*.png; do
  base="$(basename "$src")"
  if ! out_stem="$(to_output_name "$base")"; then
    continue
  fi

  family=""
  level="3"
  if [[ "$out_stem" =~ ^badge_secret_(.+)$ ]]; then
    family="secret_${BASH_REMATCH[1]}"
    level="5"
  elif [[ "$out_stem" =~ ^badge_subject_master_([a-z]+)_l([0-9]+)$ ]]; then
    family="subject_master_${BASH_REMATCH[1]}"
    level="${BASH_REMATCH[2]}"
  elif [[ "$out_stem" =~ ^badge_([a-z_]+)_l([0-9]+)$ ]]; then
    family="${BASH_REMATCH[1]}"
    level="${BASH_REMATCH[2]}"
  fi

  set_level_palette "$level"
  set_family_symbol "$family"
  level_mark_svg="$(level_marks "$level")"
  l5_svg="$(l5_effect "$level")"

  if [[ "$family" == "perfect_sessions" ]]; then
    frame_svg="$(frame_perfect_sessions)"
  elif [[ "$family" == subject_master_* ]]; then
    frame_svg="$(frame_subject_master)"
  else
    frame_svg="$(frame_default)"
  fi

  svg_path="$OUT_SVG_DIR/${out_stem}.svg"
  public_svg_path="$OUT_PUBLIC_SVG_DIR/${out_stem}.svg"
  png64_path="$OUT_64_DIR/${out_stem}.png"

  cat > "$svg_path" <<EOF
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs>
    <radialGradient id="g_${out_stem}" cx="36%" cy="30%" r="72%">
      <stop offset="0%" stop-color="$LV_LIGHT"/>
      <stop offset="65%" stop-color="$LV_MAIN"/>
      <stop offset="100%" stop-color="$LV_DARK"/>
    </radialGradient>
  </defs>
  $frame_svg
  $l5_svg
  <circle cx="32" cy="32" r="14.5" fill="#FFFFFF" opacity="0.96"/>
  <circle cx="32" cy="32" r="12.6" fill="$LV_LIGHT" opacity="0.5"/>
  <g fill="$LV_SYMBOL" stroke="$LV_SYMBOL" color="$LV_SYMBOL">
    $SYMBOL
  </g>
  <g>
    $level_mark_svg
  </g>
</svg>
EOF

  cp "$svg_path" "$public_svg_path"

  if [[ "$GENERATE_PNG" == "1" ]]; then
    if ! magick -background none -density 512 "$svg_path" -resize 64x64 "$png64_path"; then
      echo "[ERROR] convert failed: $out_stem"
      failed=$((failed + 1))
      continue
    fi
  fi

  processed=$((processed + 1))
done

echo "processed=$processed failed=$failed generate_png=$GENERATE_PNG"
