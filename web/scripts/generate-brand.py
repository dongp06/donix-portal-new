#!/usr/bin/env python3
"""
thuebot.org brand generator.

Source of truth:
  - logo.svg       512x512 square app mark (blue shield + bot + trust check)
  - wordmark.svg   horizontal logo, text converted to real vector paths
                    (variable Manrope / Space Grotesk flattened to static)

Then rasterized to favicon.png/ico and apple-touch-icon via sharp.

Usage:  python web/scripts/generate-brand.py
Output: web/public/{logo,wordmark,favicon}.svg
        web/public/{logo.png,favicon-512.png,favicon-192.png,favicon-32.png,
                    apple-touch-icon.png,favicon.ico}
"""
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
TEMP = Path(tempfile.gettempdir())

FONT_MANROPE = TEMP / "manrope-latin.woff2"
FONT_GROTESK = TEMP / "grotesk-latin.woff2"

# ── Brand tokens ─────────────────────────────────────────────────────────────
BLUE = "#1677FF"
BLUE_DEEP = "#0B57D0"
NAVY = "#082B5C"
GREEN = "#10C98A"
GREEN_DEEP = "#00B978"

# ── 1. Mark (source of truth, 512x512) ───────────────────────────────────────
# Content bbox: x [106,406] y [31,406] (shield path ± 9px stroke, antenna,
# ears, face, check). viewBox is cropped to that bbox (squared, with a small
# margin) so the drawing is horizontally AND vertically centered and fills the
# frame at small favicon sizes instead of floating high in empty padding.

MARK_SVG = f"""<svg width="512" height="512" viewBox="56 19 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="thuebot.org">
  <defs>
    <linearGradient id="shieldGradient" x1="108" y1="40" x2="404" y2="392" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{BLUE}"/>
      <stop offset="1" stop-color="{BLUE_DEEP}"/>
    </linearGradient>
    <linearGradient id="faceGradient" x1="184" y1="150" x2="328" y2="232" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0C2F63"/>
      <stop offset="1" stop-color="#061D42"/>
    </linearGradient>
    <linearGradient id="checkGradient" x1="219" y1="284" x2="297" y2="327" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{GREEN}"/>
      <stop offset="1" stop-color="{GREEN_DEEP}"/>
    </linearGradient>
  </defs>

  <!-- EXTRA WIDE / STRONGLY BULGED SHIELD -->
  <path d="M256 40 C305 68 356 85 397 98 V178 C397 225 386 267 365 303 C343 340 308 369 256 397 C204 369 169 340 147 303 C126 267 115 225 115 178 V98 C156 85 207 68 256 40 Z"
    fill="white" stroke="url(#shieldGradient)" stroke-width="18" stroke-linejoin="round"/>

  <!-- Antenna -->
  <rect x="249" y="98" width="14" height="35" rx="7" fill="{BLUE_DEEP}"/>
  <circle cx="256" cy="92" r="14" fill="{BLUE_DEEP}"/>

  <!-- Bot shell -->
  <rect x="173" y="132" width="166" height="118" rx="51" fill="white" stroke="{BLUE_DEEP}" stroke-width="8"/>

  <!-- Ears -->
  <rect x="155" y="163" width="31" height="56" rx="15.5" fill="{BLUE_DEEP}"/>
  <rect x="326" y="163" width="31" height="56" rx="15.5" fill="{BLUE_DEEP}"/>

  <!-- Face -->
  <rect x="191" y="154" width="130" height="72" rx="30" fill="url(#faceGradient)"/>

  <!-- Eyes -->
  <circle cx="229" cy="190" r="10" fill="{GREEN}"/>
  <circle cx="283" cy="190" r="10" fill="{GREEN}"/>

  <!-- Trust check -->
  <path d="M218 298 L244 324 L298 270" stroke="url(#checkGradient)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
"""


# ── 2. Wordmark with real font paths ─────────────────────────────────────────
class OutlineCollector:
    """Collect glyph outline into a list of ('M'|'L'|'C'|'Q'|'Z', *points)."""

    def __init__(self):
        self.ops = []
        self.pen = self._Pen(self.ops)
    class _Pen:
        def __init__(self, ops):
            self.ops = ops
        def moveTo(self, p):
            self.ops.append(("M", p))
        def lineTo(self, p):
            self.ops.append(("L", p))
        def curveTo(self, *pts):
            self.ops.append(("C", pts))
        def qCurveTo(self, *pts):
            self.ops.append(("Q", pts))
        def closePath(self):
            self.ops.append(("Z", None))
        def endPath(self):
            pass
def load_instanced(path, weight):
    f = TTFont(str(path))
    instantiateVariableFont(f, {"wght": weight}, inplace=True)
    for tag in ("fvar", "gvar", "avar", "STAT", "MVAR"):
        if tag in f:
            del f[tag]
    return f
def measure_text(font, text, size, tracking):
    cmap = font.getBestCmap()
    gs = font.getGlyphSet()
    upem = font["head"].unitsPerEm
    track_units = tracking * upem / size  # letter-spacing px → font units
    total = 0.0
    for ch in text:
        gname = cmap.get(ord(ch))
        if gname is None:
            total += 0.6 * upem
            continue
        total += gs[gname].width + track_units
    return total * (size / upem)
def text_path(font, text, size, x, y, tracking):
    """Return svg path `d` drawing `text` at baseline (x,y).
    x/y are in px; glyph outlines are in font units. Convert x,y to font units
    so they can be added directly to glyph coordinates before scaling.
    """
    cmap = font.getBestCmap()
    gs = font.getGlyphSet()
    upem = font["head"].unitsPerEm
    scale = size / upem
    track_units = tracking * upem / size
    x_units = x / scale  # px → font units
    y_units = y / scale
    parts = []
    cursor = 0.0
    def t(v):
        r = v * scale
        return format(round(r, 2), ".2f")
    for ch in text:
        gname = cmap.get(ord(ch))
        if gname is None:
            cursor += 0.6 * upem
            continue
        coll = OutlineCollector()
        gs[gname].draw(coll.pen)
        for op, pts in coll.ops:
            if op == "M":
                parts.append(f"M {t(x_units+cursor+pts[0])} {t(y_units-pts[1])}")
            elif op == "L":
                parts.append(f"L {t(x_units+cursor+pts[0])} {t(y_units-pts[1])}")
            elif op == "C":
                parts.append(
                    f"C {t(x_units+cursor+pts[0][0])} {t(y_units-pts[0][1])} "
                    f"{t(x_units+cursor+pts[1][0])} {t(y_units-pts[1][1])} "
                    f"{t(x_units+cursor+pts[2][0])} {t(y_units-pts[2][1])}"
                )
            elif op == "Q":
                parts.append(
                    f"Q {t(x_units+cursor+pts[0][0])} {t(y_units-pts[0][1])} "
                    f"{t(x_units+cursor+pts[1][0])} {t(y_units-pts[1][1])}"
                )
            elif op == "Z":
                parts.append("Z")
        cursor += gs[gname].width + track_units
    return " ".join(parts)


def path_bbox(d):
    """True bounding box of a path `d` (decimal coords already in px)."""
    nums = [float(x) for x in re.findall(r"-?[\d.]+", d)]
    xs = nums[0::2]
    ys = nums[1::2]
    return (min(xs), min(ys), max(xs), max(ys))


def build_wordmark():
    manrope = load_instanced(FONT_MANROPE, 800)
    grotesk = load_instanced(FONT_GROTESK, 700)

    M_SIZE = 104
    G_SIZE = 48
    M_TRACK = -4.6
    G_TRACK = -1.4
    PAD_X = 12
    H = 150

    m_adv = measure_text(manrope, "thuebot", M_SIZE, M_TRACK)

    # Compose at baseline y=0 first, then translate to vertical center.
    p_main = text_path(manrope, "thuebot", M_SIZE, 0, 0, M_TRACK)
    p_org = text_path(grotesk, ".org", G_SIZE, m_adv, 0, G_TRACK)

    # Global bbox → normalize position and fit width.
    x0, y0, x1, y1 = path_bbox(p_main + " " + p_org)
    bw, bh = x1 - x0, y1 - y0

    scale = min(1.0, (H - 8) / bh)  # leave a little breathing room top/bottom
    if bw * scale > 640:
        scale = min(scale, 640 / bw)

    W = bw * scale + 2 * PAD_X
    PAD_Y = (H - bh * scale) / 2

    # Translation: every X coord (even idx) and Y coord (odd idx) in the raw
    # path string is transformed; command letters are preserved verbatim.
    def transform(d):
        out2 = []
        nums = [float(x) for x in re.findall(r"-?[\d.]+", d)]
        for i, v in enumerate(nums):
            if i % 2 == 0:
                out2.append(format(round((v - x0) * scale + PAD_X, 2), ".2f"))
            else:
                out2.append(format(round((v - y0) * scale + PAD_Y, 2), ".2f"))
        res = []
        token_i = 0
        for mch in re.finditer(r"[A-Za-z]|-?[\d.]+", d):
            tok = mch.group(0)
            if tok[0].isdigit() or tok[0] == "-":
                res.append(out2[token_i])
                token_i += 1
            else:
                res.append(tok)
        return " ".join(res)

    p_main_t = transform(p_main)
    p_org_t = transform(p_org)
    W_i, H_i = int(round(W)), int(round(H))
    return W_i, H_i, p_main_t, p_org_t
def build_wordmark_svg(main_color, org_color):
    W_i, H_i, p_main_t, p_org_t = build_wordmark()
    return (
        f'<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg width="{W_i}" height="{H_i}" viewBox="0 0 {W_i} {H_i}" '
        f'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="thuebot.org">\n'
        f'  <path fill="{main_color}" d="{p_main_t}"/>\n'
        f'  <path fill="{org_color}" d="{p_org_t}"/>\n'
        f'</svg>\n'
    )
# ── main ─────────────────────────────────────────────────────────────────────
def main():
    PUBLIC.mkdir(parents=True, exist_ok=True)
    if not (FONT_MANROPE.exists() and FONT_GROTESK.exists()):
        sys.exit("Variable woff2 missing. Run `cd web && npx next dev` once first.")
    # SVGs
    (PUBLIC / "logo.svg").write_text(MARK_SVG, encoding="utf-8")
    (PUBLIC / "favicon.svg").write_text(MARK_SVG, encoding="utf-8")
    # wordmark.svg — navy "thuebot" + green ".org" for light backgrounds
    (PUBLIC / "wordmark.svg").write_text(build_wordmark_svg(NAVY, GREEN), encoding="utf-8")
    # wordmark-white.svg — white "thuebot" + green ".org" for dark navbar/footer
    (PUBLIC / "wordmark-white.svg").write_text(build_wordmark_svg("#FFFFFF", GREEN), encoding="utf-8")
    print("wrote logo.svg favicon.svg wordmark.svg wordmark-white.svg")
    # Rasterize mark with sharp (SVG→PNG→downscale chain)
    import json
    node = r"C:\Program Files\nodejs\node.exe"
    sharp_path = str(ROOT.parent / "node_modules" / "sharp").replace("\\", "/")
    pub = str(PUBLIC).replace("\\", "/")
    code = r"""
const sharp = require(__SHARP__);
const path = require('path');
const fs = require('fs');
const out = (n) => path.join(__PUB__, n);
(async () => {
  const svg = fs.readFileSync(out('logo.svg'), 'utf8');
  const files = {512:'favicon-512.png',192:'favicon-192.png',180:'apple-touch-icon.png',32:'favicon-32.png'};
  for (const [s, name] of Object.entries(files)) {
    await sharp(Buffer.from(svg)).resize(+s, +s).png().toFile(out(name));
  }
  await sharp(Buffer.from(svg)).resize(512, 512).png().toFile(out('logo.png'));
  // Build a real multi-size .ico (PNG-compressed entries; supported by
  // modern Chrome/Edge/Firefox and Windows thumbnailer).
  const icoSizes = [16, 32, 48];
  const pngs = [];
  for (const s of icoSizes) {
    pngs.push(await sharp(Buffer.from(svg), {density: 300}).resize(s, s).png().toBuffer());
  }
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);     // reserved
  header.writeUInt16LE(1, 2);     // type: icon
  header.writeUInt16LE(icoSizes.length, 4);
  let offset = 6 + 16 * icoSizes.length;
  const entries = [];
  for (let i = 0; i < icoSizes.length; i++) {
    const s = icoSizes[i];
    const e = Buffer.alloc(16);
    e[0] = s === 256 ? 0 : s;   // width
    e[1] = s === 256 ? 0 : s;   // height
    e[2] = 0;                    // palette
    e[3] = 0;                    // reserved
    e.writeUInt16LE(1, 4);       // planes
    e.writeUInt16LE(32, 6);      // bpp
    e.writeUInt32LE(pngs[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += pngs[i].length;
    entries.push(e);
  }
  fs.writeFileSync(out('favicon.ico'), Buffer.concat([header, ...entries, ...pngs]));
  console.log('rasters ok');
})().catch(e=>{console.error(e);process.exit(1)});
"""
    code = code.replace("__SHARP__", json.dumps(sharp_path)).replace("__PUB__", json.dumps(pub))
    tmp_js = TEMP / "brand-raster.cjs"
    tmp_js.write_text(code, encoding="utf-8")
    subprocess.run([node, str(tmp_js)], check=True)
    print("wrote favicon-512/192/32.png apple-touch-icon.png logo.png favicon.ico")
if __name__ == "__main__":
    main()