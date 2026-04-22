#!/usr/bin/env bash
# Re-subset Noto Sans SC Variable to the GB2312 + common-punctuation glyph set
# while preserving the wght variation axis (100..900).
#
# Previous output (plan 04-01) was subset WITHOUT --retain-variation-axes-style
# flags, dropping fvar/gvar so Chinese text always rendered at a single weight —
# causing mixed Latin/CJK titles to look half-bold / half-regular.
#
# Requires: python3 + fonttools (pip install fonttools brotli).
# Run from repo root: bash scripts/subset-noto-sc.sh
set -euo pipefail

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "→ downloading NotoSansSC-VF.ttf (~17MB source)"
curl -fsSL -o "$TMP/NotoSansSC-VF.ttf" \
  "https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/Variable/TTF/Subset/NotoSansSC-VF.ttf"

echo "→ generating GB2312 + punctuation char set"
python3 - <<'PY'
import os
TMP = os.environ.get('TMP', '/tmp')
chars = set()
for hi in range(0xA1, 0xFE):
    for lo in range(0xA1, 0xFF):
        try:
            c = bytes([hi, lo]).decode('gb2312')
            if c.strip() and len(c) == 1:
                chars.add(c)
        except UnicodeDecodeError:
            pass
for c in range(0x20, 0x7F):      chars.add(chr(c))   # ASCII
for c in range(0x3000, 0x3040):  chars.add(chr(c))   # CJK punctuation
for c in range(0xFF00, 0xFFF0):  chars.add(chr(c))   # Fullwidth/halfwidth
for c in range(0x2000, 0x2070):  chars.add(chr(c))   # General punctuation
for c in range(0xA0, 0x100):     chars.add(chr(c))   # Latin-1 supplement
with open(f'{TMP}/chars.txt', 'w', encoding='utf-8') as f:
    f.write(''.join(sorted(chars)))
print(f'chars: {len(chars)}')
PY

echo "→ subsetting (keeping wght axis + all OpenType layout features)"
TMP="$TMP" pyftsubset "$TMP/NotoSansSC-VF.ttf" \
  --text-file="$TMP/chars.txt" \
  --layout-features='*' \
  --drop-tables-=MVAR,cvar,STAT,avar \
  --flavor=woff2 \
  --output-file="public/fonts/NotoSansSC-Variable.woff2"

echo "→ verifying axis preservation"
python3 - <<'PY'
from fontTools.ttLib import TTFont
f = TTFont('public/fonts/NotoSansSC-Variable.woff2')
assert 'fvar' in f, 'fvar missing — subset dropped variable axes'
assert 'gvar' in f, 'gvar missing — subset dropped glyph variations'
for axis in f['fvar'].axes:
    print(f'  axis {axis.axisTag}: {axis.minValue}..{axis.maxValue}, default={axis.defaultValue}')
import os
size_mb = os.path.getsize('public/fonts/NotoSansSC-Variable.woff2') / 1024 / 1024
print(f'  size: {size_mb:.2f} MB')
PY
echo "✓ done"
