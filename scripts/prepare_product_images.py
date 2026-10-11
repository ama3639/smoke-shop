"""Encode lighter WebP copies, preserving original PNG files and dimensions."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def main():
    source = ROOT / 'frontend/public/images/products/winston'
    target = source / 'optimized'
    target.mkdir(exist_ok=True)
    originals = sorted(source.glob('[0-9][0-9].png'))
    for path in originals:
        with Image.open(path) as image:
            image.save(target / f'{path.stem}.webp', format='WEBP', quality=90, method=6)
    print(f'Prepared {len(originals)} WebP copies. Original PNG files and dimensions preserved.')


if __name__ == '__main__':
    main()
