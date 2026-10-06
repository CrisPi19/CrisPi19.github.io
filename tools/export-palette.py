"""
Exporta la paleta de js/engine/palette.js a formatos para herramientas de dibujo.

Uso (desde la raíz del proyecto):
    python tools/export-palette.py

Genera:
    assets/palette/crispianist.gpl  -> paleta GIMP: la cargan Aseprite, Piskel y GIMP
    assets/palette/crispianist.png  -> muestras de 16x16 px (8 columnas)
    css/palette.css                 -> las mismas variables CSS para el HTML

Solo usa la biblioteca estándar de Python (el PNG se escribe a mano con zlib).
"""
import re
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "js" / "engine" / "palette.js"
OUT_DIR = ROOT / "assets" / "palette"
CSS_OUT = ROOT / "css" / "palette.css"

SWATCH = 16
COLUMNS = 8


def read_palette():
    text = SOURCE.read_text(encoding="utf-8")
    entries = re.findall(r"name:\s*'([^']+)',\s*hex:\s*'#([0-9a-fA-F]{6})'", text)
    if not entries:
        raise SystemExit(f"No se encontraron colores en {SOURCE}")
    return [(name, tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))) for name, h in entries]


def write_gpl(colors, path):
    lines = ["GIMP Palette", "Name: CrisPianist", f"Columns: {COLUMNS}", "#"]
    for name, (r, g, b) in colors:
        lines.append(f"{r:3d} {g:3d} {b:3d}\t{name}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def png_chunk(kind, data):
    chunk = kind + data
    return struct.pack(">I", len(data)) + chunk + struct.pack(">I", zlib.crc32(chunk) & 0xFFFFFFFF)


def write_png(colors, path):
    rows = (len(colors) + COLUMNS - 1) // COLUMNS
    width, height = COLUMNS * SWATCH, rows * SWATCH
    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filtro "None" para cada fila
        for x in range(width):
            i = (y // SWATCH) * COLUMNS + (x // SWATCH)
            raw.extend(colors[i][1] if i < len(colors) else (0, 0, 0))
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # 8 bits, RGB
    png = b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", header)
    png += png_chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + png_chunk(b"IEND", b"")
    path.write_bytes(png)


def write_css(colors, path):
    lines = [
        "/* Generado por tools/export-palette.py desde js/engine/palette.js. No editar a mano. */",
        ":root {",
    ]
    lines += [f"  --{name}: #{r:02x}{g:02x}{b:02x};" for name, (r, g, b) in colors]
    lines.append("}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    colors = read_palette()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    write_gpl(colors, OUT_DIR / "crispianist.gpl")
    write_png(colors, OUT_DIR / "crispianist.png")
    write_css(colors, CSS_OUT)
    print(f"{len(colors)} colores exportados a {OUT_DIR.relative_to(ROOT)} y {CSS_OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
