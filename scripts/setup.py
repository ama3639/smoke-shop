"""Repeatable local setup on Windows, macOS and Linux; no Docker required."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import venv

ROOT = Path(__file__).resolve().parents[1]


def main():
    if sys.version_info < (3, 12):
        raise SystemExit('Python 3.12+ is required.')
    npm = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
    if not npm:
        raise SystemExit('Install Node.js 22+ (LTS recommended) first.')
    target = ROOT / 'backend' / '.venv'
    if not target.exists():
        venv.create(target, with_pip=True)
    python = target / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    subprocess.run([str(python), '-m', 'pip', 'install', '-r', str(ROOT / 'backend/requirements.txt')], check=True)
    subprocess.run([npm, 'ci', '--no-fund'], cwd=ROOT / 'frontend', check=True)
    for command in [('migrate', '--noinput'), ('seed_roles',), ('seed_demo',), ('check',)]:
        subprocess.run([str(python), 'manage.py', *command], cwd=ROOT / 'backend', check=True)
    print('Setup complete. Run: python scripts/dev.py')


if __name__ == '__main__':
    main()
