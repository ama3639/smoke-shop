"""Encode lighter WebP copies, preserving original PNG files and dimensions."""
import argparse
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'frontend/public/images/products/winston')
    source = parser.parse_args().source
    target = source / 'optimized'
    target.mkdir(exist_ok=True)
    originals = sorted(source.glob('*.png'))
    for path in originals:
        with Image.open(path) as image:
            image.save(target / f'{path.stem}.webp', format='WEBP', quality=90, method=6, icc_profile=image.info.get('icc_profile', b''))
    print(f'Prepared {len(originals)} WebP copies. Original PNG files and dimensions preserved.')


if __name__ == '__main__':
    main()
