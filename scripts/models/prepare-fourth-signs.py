"""Build fourth-canteen texture assets from the user's original reference photos.

Usage: python scripts/models/prepare-fourth-signs.py --source-dir <photo-folder>
Requires Pillow and NumPy, as does prepare-minzu-signs.py. Coordinates below use
the 1824 x 1368 review image, TL/TR/BR/BL; the original-resolution pixels are
sampled after EXIF orientation. Only signboards are extracted, never full scenes.
Exposure control belongs to the model's material, not the source photographs.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps


SIGNS = [
    ('maijindi', '优品麦选', 5, 1536, 312,
     [(123, 529), (793, 500), (795, 628), (123, 644)],
     [(147, 653), (795, 641), (799, 692), (162, 700)]),
    ('zhongyuan', '中原风味', 5, 1536, 312,
     [(858, 506), (1623, 475), (1627, 598), (859, 623)],
     [(857, 638), (1624, 616), (1630, 681), (858, 692)]),
    ('fujian', '福建风味', 4, 1536, 312,
     [(104, 487), (811, 476), (814, 605), (104, 608)],
     [(105, 631), (818, 630), (819, 678), (106, 678)]),
    ('xiang-egang', '湘鄂赣风味', 4, 1536, 312,
     [(887, 477), (1711, 469), (1711, 603), (887, 603)],
     [(886, 624), (1706, 621), (1703, 689), (886, 689)]),
    ('chuanyu', '川渝风味', 3, 1280, 260,
     [(215, 648), (742, 621), (749, 716), (216, 737)],
     [(219, 749), (748, 728), (750, 778), (221, 795)]),
    ('xibei', '西北风味', 3, 1280, 260,
     [(809, 620), (1385, 594), (1390, 684), (812, 713)],
     [(809, 727), (1391, 698), (1393, 746), (812, 774)]),
    ('guangshi', '广式风味', 2, 1024, 208,
     [(310, 582), (737, 583), (736, 652), (310, 648)],
     [(310, 665), (739, 667), (738, 697), (309, 696)]),
    ('dongbei', '东北风味', 2, 1024, 208,
     [(783, 576), (1236, 574), (1237, 659), (783, 656)],
     [(783, 664), (1237, 664), (1238, 703), (783, 700)]),
    ('chuangyi', '创意融合', 1, 768, 260,
     [(736, 538), (984, 526), (987, 622), (736, 627)],
     [(743, 635), (986, 628), (987, 672), (744, 674)]),
    ('jitang-mixian', '蒙自源鸡汤米线', 1, 1024, 246,
     [(993, 524), (1341, 506), (1343, 610), (994, 622)],
     [(1003, 631), (1342, 618), (1345, 666), (1004, 674)]),
    ('maijindi-side', '酱香醇厚', 6, 1536, 312,
     [(600, 413), (1124, 222), (1129, 516), (601, 599)],
     [(609, 613), (1096, 545), (1121, 669), (631, 696)]),
    ('jinling', '金陵风味', 7, 1024, 208,
     [(772, 654), (1197, 645), (1206, 737), (773, 749)],
     [(777, 763), (1204, 755), (1205, 798), (776, 804)]),
    ('shuijiao-huntun', '京兜水饺馄饨', 7, 1024, 208,
     [(319, 651), (756, 648), (757, 748), (319, 755)],
     [(328, 767), (757, 759), (759, 802), (336, 810)]),
]


def project(photo: Image.Image, quad: list, size: tuple) -> Image.Image:
    destination = [(0, 0), (size[0] - 1, 0), (size[0] - 1, size[1] - 1), (0, size[1] - 1)]
    rows, values = [], []
    for (x, y), (u, v) in zip(destination, quad):
        u, v = u * photo.width / 1824, v * photo.height / 1368
        rows.extend([(x, y, 1, 0, 0, 0, -u*x, -u*y), (0, 0, 0, x, y, 1, -v*x, -v*y)])
        values.extend([u, v])
    coefficients = np.linalg.solve(np.array(rows, dtype=float), np.array(values, dtype=float))
    return photo.transform(size, Image.Transform.PERSPECTIVE, coefficients, Image.Resampling.BICUBIC)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', required=True, type=Path)
    parser.add_argument('--output-dir', type=Path,
                        default=Path(__file__).resolve().parents[2] / 'src/assets/fourth-canteen')
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    manifest = []
    for key, name, source, width, height, sign_quad, menu_quad in SIGNS:
        with Image.open(args.source_dir / f'{source}.jpg') as original:
            photo = ImageOps.exif_transpose(original).convert('RGB')
            expected = (4000, 3000) if source == 7 else (4096, 3072)
            if photo.size != expected:
                raise ValueError(f'{source}.jpg: expected {expected}, got {photo.size}')
            for band, quad, size in [('sign', sign_quad, (width, height)),
                                      ('menu', menu_quad, (width, 128))]:
                texture = project(photo, quad, size)
                output = args.output_dir / f'{key}-{band}.webp'
                texture.save(output, 'WEBP', quality=93, method=6)
                manifest.append(dict(key=key, name=name, band=band, source=f'{source}.jpg',
                                     sourceSize=expected, reviewSize=[1824, 1368], quad=quad,
                                     output=output.name, size=size, bytes=output.stat().st_size))
                print(f'{output.name}: {size[0]}x{size[1]}, {output.stat().st_size} bytes')
    (args.output_dir / 'source-manifest.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
