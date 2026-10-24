"""Extract the photographed Minzu canteen sign artwork without redrawing lettering.

Usage: python scripts/models/prepare-minzu-signs.py --source-dir <reference-photo-folder>
Requires Pillow and NumPy for this offline asset preparation only. The browser uses
the committed WebP files, never the local reference-photo directory.

The quads below are original-image pixel coordinates in TL, TR, BR, BL order.
Only the sign artwork is sampled. Reflections and printed food illustrations are
retained as photographed; these are decoration textures, not menu/dish photos.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps


SIGNS = [
    {
        "source": "1.jpg",
        "source_size": (4096, 3072),
        "output": "bianchui-fengqing.webp",
        "quad": ((683, 981), (3712, 1022), (3721, 1401), (672, 1368)),
        "size": (2048, 260),
    },
    {
        "source": "2.jpg",
        "source_size": (4096, 3072),
        "output": "minzu-fengwei.webp",
        "quad": ((58, 272), (3858, 716), (3876, 1186), (43, 1069)),
        "size": (2048, 380),
    },
    {
        "source": "3.jpg",
        "source_size": (4000, 3000),
        "output": "meishi-paidang.webp",
        "quad": ((351, 739), (3546, 610), (3553, 1112), (360, 1182)),
        "size": (2048, 320),
    },
    {
        "source": "4.jpg",
        "source_size": (4000, 3000),
        "output": "lanzhou-lamian.webp",
        "quad": ((211, 1031), (3235, 754), (3268, 1296), (175, 1443)),
        "size": (2048, 320),
    },
    {
        "source": "4.jpg",
        "source_size": (4000, 3000),
        "output": "student-special.webp",
        # Isolate the main caption/whale, below the tiny branding line and above people.
        "quad": ((2952, 1447), (3866, 1419), (3881, 1583), (2952, 1632)),
        "size": (1024, 200),
    },
    {
        "source": "1.jpg",
        "source_size": (4096, 3072),
        "output": "breakfast.webp",
        # Only the clean main lettering; the lower/right heart plate is occluded.
        "quad": ((1051, 1466), (1457, 1466), (1457, 1576), (1051, 1576)),
        "size": (768, 208),
    },
]


def perspective_coefficients(quad: tuple, size: tuple[int, int]) -> np.ndarray:
    """Pillow maps each destination pixel to its exact source-photo position."""
    width, height = size
    destination = ((0, 0), (width - 1, 0), (width - 1, height - 1), (0, height - 1))
    rows, values = [], []
    for (x, y), (u, v) in zip(destination, quad):
        rows.extend(((x, y, 1, 0, 0, 0, -u * x, -u * y), (0, 0, 0, x, y, 1, -v * x, -v * y)))
        values.extend((u, v))
    return np.linalg.solve(np.asarray(rows, dtype=float), np.asarray(values, dtype=float))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", required=True, type=Path)
    parser.add_argument(
        "--output-dir", type=Path,
        default=Path(__file__).resolve().parents[2] / "src" / "assets" / "minzu-canteen",
    )
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for sign in SIGNS:
        with Image.open(args.source_dir / sign["source"]) as source:
            photo = ImageOps.exif_transpose(source).convert("RGB")
            if photo.size != sign["source_size"]:
                raise ValueError(f"Unexpected dimensions for {sign['source']}: {photo.size}")
            texture = photo.transform(
                sign["size"], Image.Transform.PERSPECTIVE,
                perspective_coefficients(sign["quad"], sign["size"]),
                Image.Resampling.BICUBIC,
            )
            output = args.output_dir / sign["output"]
            texture.save(output, "WEBP", quality=92, method=6)
            print(f"{output.name}: {texture.width}x{texture.height}, {output.stat().st_size} bytes")


if __name__ == "__main__":
    main()
